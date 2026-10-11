import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import {
  NECROMANCER_SKILL_IDS as NECRO_SKILL,
  NECROMANCER_TRAIT_IDS as NECRO
} from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { RANGER_TRAIT_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { REVENANT_TRAIT_IDS as REVENANT } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';

// Patch the registered trait owner so disconnected declarations cannot satisfy these formula contracts.
function patched(profession, balanceProfiles) {
  return withPatchPreview(profession, {
    id: 'modifier-owners',
    label: 'Modifier owners',
    professions: { [profession.id]: { balanceProfiles } }
  });
}

test('Roiling Mists owns its selected Fury bonus and reads the active profile', () => {
  const family = patched(revenantProfession, { [REVENANT.ROILING_MISTS]: { fields: { criticalChance: 0.3 } } });
  for (const [patchId, bonus] of [
    ['current', 0.25],
    ['modifier-owners', 0.3]
  ]) {
    const profession = family.runtimeFor({ specialization: 'Core', patchId });
    for (const selected of [false, true]) {
      for (const fury of [false, true]) {
        const criticalChanceContributors = [];
        const result = profession.modifyCriticalChance(
          {
            catalog: profession.catalog,
            time: 0,
            event: { actorType: 'player' },
            config: { selectedTraitIds: selected ? [REVENANT.ROILING_MISTS] : [], boons: { fury } },
            criticalChanceContributors
          },
          0.2
        );
        assert.equal(result, 0.2 + (selected && fury ? bonus : 0));
        assert.equal(
          criticalChanceContributors.filter(({ id }) => id === 'revenant.roiling-mists').length,
          selected && fury ? 1 : 0
        );
      }
    }
  }
});

test('Lingering Curse scales only eligible Scepter base duration with selected profile values', () => {
  const family = patched(necromancerProfession, { [NECRO.LINGERING_CURSE]: { fields: { durationMultiplier: 1.75 } } });
  for (const [patchId, factor] of [
    ['current', 1.5],
    ['modifier-owners', 1.75]
  ]) {
    const profession = family.runtimeFor({ specialization: 'Scourge', patchId });
    for (const selected of [false, true]) {
      for (const [skillId, eligible] of [
        [NECRO_SKILL.BLOOD_CURSE, true],
        [NECRO_SKILL.DEVOURING_DARKNESS, false],
        [NECRO_SKILL.NECROTIC_GRASP, false]
      ]) {
        const context = {
          catalog: profession.catalog,
          profession: { catalog: profession.catalog },
          time: 0,
          event: { actorType: 'player', skillId },
          condition: 'Bleeding',
          config: { selectedTraitIds: selected ? [NECRO.LINGERING_CURSE] : [] }
        };
        assert.equal(profession.modifyConditionBaseDuration(context, 2), 2 * (selected && eligible ? factor : 1));
        // The trait changes the base stage, not the ordinary duration-bonus stage.
        assert.equal(profession.modifyConditionDuration(context, 2), 2);
      }
    }
  }
});

test('merged Beastmastery rules preserve selection, ownership, specialization, and accepted buff expiry', () => {
  const family = patched(rangerProfession, {
    [RANGER.LOUD_WHISTLE]: { fields: { playerDamageMultiplier: 1.2 } },
    [RANGER.GO_FOR_THE_THROAT]: { fields: { playerDamageMultiplier: 1.3 } }
  });
  for (const [patchId, whistle, throat] of [
    ['current', 1.1, 1.15],
    ['modifier-owners', 1.2, 1.3]
  ]) {
    for (const specialization of ['Core', 'Soulbeast', 'Untamed']) {
      const profession = family.runtimeFor({ specialization, patchId });
      const buffs = new Map();
      // An admitted grant belongs to the player until expiry, even if the trait or merge state changes.
      recordBuffApplication(buffs, {
        type: 'buff',
        kind: 'lesser-sic-em',
        at: 0,
        duration: 2,
        stacks: 1,
        resolvedAudience: { includesSelf: true }
      });
      for (const selected of [false, true]) {
        for (const merged of [false, true]) {
          for (const time of [1, 2]) {
            for (const actorType of ['player', 'summon']) {
              const damageContributors = [];
              profession.modifyStrikeDamage(
                {
                  catalog: profession.catalog,
                  time,
                  event: { actorType, ...(actorType === 'summon' ? { source: 'ranger-pet', summonOwner: 'pet' } : {}) },
                  config: {
                    specialization,
                    selectedTraitIds: selected ? [RANGER.LOUD_WHISTLE, RANGER.GO_FOR_THE_THROAT] : []
                  },
                  runtime: {
                    buffs,
                    boons: new Map(),
                    profession: {
                      core: {},
                      specialization: { kind: specialization, state: { beastmodeActive: merged } }
                    }
                  },
                  damageContributors
                },
                100
              );
              const value = (id) => damageContributors.find((entry) => entry.id === id)?.value ?? 1;
              assert.equal(
                value('ranger.loud-whistle-player'),
                specialization === 'Soulbeast' && selected && merged && actorType === 'player' ? whistle : 1
              );
              assert.equal(
                value('ranger.lesser-sic-em-player'),
                specialization === 'Soulbeast' && time < 2 && actorType === 'player' ? throat : 1
              );
            }
          }
        }
      }
    }
  }
});
