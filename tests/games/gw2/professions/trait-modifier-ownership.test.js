import assert from 'node:assert/strict';
import test from 'node:test';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import {
  NECROMANCER_SKILL_IDS as NECRO_SKILL,
  NECROMANCER_TRAIT_IDS as NECRO
} from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import {
  GUARDIAN_SKILL_IDS as GUARDIAN_SKILL,
  GUARDIAN_TRAIT_IDS as GUARDIAN
} from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { RANGER_SKILL_IDS as RANGER_SKILL, RANGER_TRAIT_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { REVENANT_TRAIT_IDS as REVENANT } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { RENEGADE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/renegade/profiles.js';

// Patch the registered trait owner so disconnected declarations cannot satisfy these formula contracts.
function patched(profession, balanceProfiles, skills = {}) {
  return withPatchPreview(profession, {
    id: 'modifier-owners',
    label: 'Modifier owners',
    professions: { [profession.id]: { balanceProfiles, skills } }
  });
}

test('Radiance declarations extend only their selected Burning sources at the base-duration stage', () => {
  const family = patched(guardianProfession, {
    [GUARDIAN.RADIANT_FIRE]: { fields: { durationMultiplier: 1.8 } },
    [GUARDIAN.AMPLIFIED_WRATH]: { fields: { durationMultiplier: 1.4 } }
  });
  for (const [patchId, flame, justice] of [
    ['current', 1.5, 1.2],
    ['modifier-owners', 1.8, 1.4]
  ]) {
    const profession = family.runtimeFor({ specialization: 'Core', patchId });
    for (const selectedTraitIds of [
      [],
      [GUARDIAN.RADIANT_FIRE],
      [GUARDIAN.AMPLIFIED_WRATH],
      [GUARDIAN.RADIANT_FIRE, GUARDIAN.AMPLIFIED_WRATH]
    ]) {
      for (const condition of ['Burning', 'Bleeding']) {
        for (const [source, radiant, amplified] of [
          [{ sourceId: GUARDIAN_SKILL.ZEALOTS_FLAME }, true, false],
          [{ event: { skillId: GUARDIAN_SKILL.ZEALOTS_FLAME } }, true, false],
          [{ sourceId: 'guardian.justice-passive' }, false, true],
          [{ event: { sourceId: 'guardian.justice-passive' } }, false, true],
          [{ event: { skillId: GUARDIAN_SKILL.ZEALOTS_FLAME, sourceId: 'guardian.justice-passive' } }, true, true],
          [{}, false, false]
        ]) {
          const context = { catalog: profession.catalog, time: 0, config: { selectedTraitIds }, condition, ...source };
          const factor =
            condition === 'Burning'
              ? (radiant && selectedTraitIds.includes(GUARDIAN.RADIANT_FIRE) ? flame : 1) *
                (amplified && selectedTraitIds.includes(GUARDIAN.AMPLIFIED_WRATH) ? justice : 1)
              : 1;
          assert.equal(profession.modifyConditionBaseDuration(context, 2), 2 * factor);
          assert.equal(profession.modifyConditionDuration(context, 2), 2);
        }
      }
    }
  }
});

test('Brutal Momentum adds only its selected full-endurance increase above the attribute baseline', () => {
  const family = patched(revenantProfession, {
    [RENEGADE_PROFILE_IDS.brutalMomentum]: { fields: { criticalChance: 0.15, fullEnduranceCriticalChance: 0.4 } }
  });
  for (const [patchId, baseline, full] of [
    ['current', 0.1, 0.33],
    ['modifier-owners', 0.15, 0.4]
  ]) {
    const profession = family.runtimeFor({ specialization: 'Renegade', patchId });
    for (const selected of [false, true]) {
      for (const endurance of [0, 99, 100]) {
        const context = {
          catalog: profession.catalog,
          time: 0,
          event: { actorType: 'player' },
          config: { selectedTraitIds: selected ? [REVENANT.BRUTAL_MOMENTUM] : [] },
          runtime: {
            profession: { core: { endurance: { value: endurance } }, specialization: { kind: 'Renegade', state: {} } }
          }
        };
        const input = 0.05 + (selected ? baseline : 0);
        const expected = 0.05 + (selected ? (endurance === 100 ? full : baseline) : 0);
        assert.ok(Math.abs(profession.modifyCriticalChance(context, input) - expected) < 1e-12);
      }
    }
  }
});

test('shortbow intrinsic and selected trait extensions add seconds while traps retain their own factors', () => {
  const family = patched(
    rangerProfession,
    {
      [RANGER.LIGHT_ON_YOUR_FEET]: { fields: { durationPerTier: 3, minimumStacks: 2 } },
      [RANGER.TRAPPERS_EXPERTISE]: { fields: { durationMultiplier: 1.9, coefficientMultiplier: 1.8 } }
    },
    {
      [RANGER_SKILL.CROSSFIRE]: { conditions: { Bleeding: { duration: 4 } } },
      [RANGER_SKILL.POISON_VOLLEY]: { conditions: { Poisoned: { duration: 7 } } },
      [RANGER_SKILL.CRIPPLING_SHOT]: { conditions: { Immobilized: { duration: 2.5 } } }
    }
  );
  for (const [patchId, shortbow, immobilize, trap, flame] of [
    ['current', 2, 1, 1.6, 1.66],
    ['modifier-owners', 3, 2, 1.9, 1.8]
  ]) {
    const profession = family.runtimeFor({ specialization: 'Core', patchId });
    for (const selected of [false, true]) {
      for (const defiant of [false, true]) {
        for (const [skillId, condition, base, intrinsic, extension] of [
          [RANGER_SKILL.CROSSFIRE, 'Bleeding', patchId === 'current' ? 2 : 4, 1, shortbow],
          [RANGER_SKILL.POISON_VOLLEY, 'Poisoned', patchId === 'current' ? 5 : 7, 2, shortbow],
          [RANGER_SKILL.CRIPPLING_SHOT, 'Immobilized', patchId === 'current' ? 1.5 : 2.5, 0, immobilize],
          [RANGER_SKILL.CROSSFIRE, 'Poisoned', 1, 0, 0]
        ]) {
          const context = {
            catalog: profession.catalog,
            profession: { catalog: profession.catalog },
            time: 0,
            event: { actorType: 'player', skillId },
            condition,
            config: { target: { defiant }, selectedTraitIds: selected ? [RANGER.LIGHT_ON_YOUR_FEET] : [] }
          };
          const expected = (2 * (base + (defiant ? intrinsic + (selected ? extension : 0) : 0))) / base;
          assert.ok(
            Math.abs(profession.modifyConditionBaseDuration(context, 2) - expected) < 1e-12,
            `${patchId}, ${skillId}, ${condition}, selected=${selected}, defiant=${defiant}`
          );
          assert.equal(profession.modifyConditionDuration(context, 2), 2);
        }

        for (const [skillId, factor] of [
          [RANGER_SKILL.FLAME_TRAP, flame],
          [RANGER_SKILL.VIPERS_NEST, trap],
          [RANGER_SKILL.CROSSFIRE, 1]
        ]) {
          const context = {
            catalog: profession.catalog,
            profession: { catalog: profession.catalog },
            time: 0,
            event: { actorType: 'player', skillId },
            condition: 'Burning',
            config: { target: { defiant }, selectedTraitIds: selected ? [RANGER.TRAPPERS_EXPERTISE] : [] }
          };
          assert.equal(profession.modifyConditionBaseDuration(context, 2), 2 * (selected ? factor : 1));
        }
      }
    }
  }
});

test('shortbow duration extensions cannot recreate a removed condition effect', () => {
  const family = patched(
    rangerProfession,
    {},
    {
      [RANGER_SKILL.CROSSFIRE]: { removeEffects: [{ type: 'condition', condition: 'Bleeding' }] }
    }
  );
  const profession = family.runtimeFor({ specialization: 'Core', patchId: 'modifier-owners' });
  const context = {
    catalog: profession.catalog,
    profession: { catalog: profession.catalog },
    time: 0,
    event: { actorType: 'player', skillId: RANGER_SKILL.CROSSFIRE },
    condition: 'Bleeding',
    config: { target: { defiant: true }, selectedTraitIds: [RANGER.LIGHT_ON_YOUR_FEET] }
  };
  // Both owners leave an absent base alone instead of manufacturing a duration from their extensions.
  assert.equal(profession.modifyConditionBaseDuration(context, 2), 2);
});

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
