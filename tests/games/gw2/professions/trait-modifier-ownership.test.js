import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import {
  GUARDIAN_TRAIT_IDS as GUARDIAN,
  GUARDIAN_SKILL_IDS as GUARDIAN_SKILL
} from '#gw2/professions/guardian/data/ids.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import {
  NECROMANCER_TRAIT_IDS as NECRO,
  NECROMANCER_SKILL_IDS as NECRO_SKILL
} from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { RANGER_TRAIT_IDS as RANGER, RANGER_SKILL_IDS as RANGER_SKILL } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { REVENANT_TRAIT_IDS as REVENANT } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';

// Each duration trait applies to a specific condition source before ordinary duration bonuses.
for (const [name, family, trait, condition, source, unrelated] of [
  [
    'Radiant Fire',
    guardianProfession,
    GUARDIAN.RADIANT_FIRE,
    'Burning',
    { skillId: GUARDIAN_SKILL.ZEALOTS_FLAME },
    { sourceId: 'guardian.justice-passive' }
  ],
  [
    'Amplified Wrath',
    guardianProfession,
    GUARDIAN.AMPLIFIED_WRATH,
    'Burning',
    { sourceId: 'guardian.justice-passive' },
    { skillId: GUARDIAN_SKILL.ZEALOTS_FLAME }
  ],
  [
    "Trapper's Expertise",
    rangerProfession,
    RANGER.TRAPPERS_EXPERTISE,
    'Burning',
    { skillId: RANGER_SKILL.FLAME_TRAP },
    { skillId: RANGER_SKILL.CROSSFIRE }
  ],
  [
    'Lingering Curse',
    necromancerProfession,
    NECRO.LINGERING_CURSE,
    'Bleeding',
    { skillId: NECRO_SKILL.BLOOD_CURSE },
    { skillId: NECRO_SKILL.NECROTIC_GRASP }
  ]
]) {
  test(`${name} extends the base duration of its own source`, () => {
    const runtime = family.runtimeFor({ specialization: 'Core' });
    const context = (event, selectedTraitIds) => ({
      catalog: runtime.catalog,
      time: 0,
      event: { actorType: 'player', ...event },
      condition,
      config: { selectedTraitIds }
    });
    const duration = (event, traits) => runtime.calculations.modifyConditionBaseDuration(context(event, traits), 1);
    assert.ok(duration(source, [trait]) > duration(source, []));
    assert.equal(duration(unrelated, [trait]), duration(unrelated, []));
    assert.equal(
      runtime.calculations.modifyConditionDuration(context(source, [trait]), 1),
      runtime.calculations.modifyConditionDuration(context(source, []), 1)
    );
  });
}

test('shortbow duration extensions cannot recreate a removed condition', () => {
  const family = withPatchPreview(rangerProfession, {
    id: 'removed',
    label: 'Removed condition',
    professions: {
      ranger: {
        skills: {
          [RANGER_SKILL.CROSSFIRE]: { removeEffects: [{ type: 'condition', condition: 'Bleeding' }] }
        }
      }
    }
  });
  const runtime = family.runtimeFor({ specialization: 'Core', patchId: 'removed' });
  const context = {
    catalog: runtime.catalog,
    time: 0,
    event: { actorType: 'player', skillId: RANGER_SKILL.CROSSFIRE },
    condition: 'Bleeding',
    config: { target: { defiant: true }, selectedTraitIds: [RANGER.LIGHT_ON_YOUR_FEET] }
  };
  assert.equal(runtime.calculations.modifyConditionBaseDuration(context, 1), 1);
});

// Spending endurance removes the Renegade bonus until endurance returns to full.
test('Brutal Momentum only adds critical chance at full endurance', () => {
  const runtime = revenantProfession.runtimeFor({ specialization: 'Renegade' });
  function chance(endurance, selectedTraitIds) {
    return runtime.calculations.modifyCriticalChance(
      {
        catalog: runtime.catalog,
        time: 0,
        event: { actorType: 'player' },
        config: { selectedTraitIds },
        runtime: {
          profession: { core: { endurance: { value: endurance } }, specialization: { kind: 'Renegade', state: {} } }
        }
      },
      0.2
    );
  }

  assert.ok(chance(100, [REVENANT.BRUTAL_MOMENTUM]) > chance(99, [REVENANT.BRUTAL_MOMENTUM]));
  assert.equal(chance(99, [REVENANT.BRUTAL_MOMENTUM]), chance(99, []));
  assert.equal(chance(100, []), chance(99, []));
});
