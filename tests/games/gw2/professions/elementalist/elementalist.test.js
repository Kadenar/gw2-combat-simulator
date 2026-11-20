import assert from 'node:assert/strict';
import test from 'node:test';

import { createCombatEngagement } from '#gw2/platform/combat/engagement.js';
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  validateElementalistBuild
} from '#gw2/professions/elementalist/build/build.js';
import { elementalistAttunementRechargeDuration } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { flowStateAttunementReduction } from '#gw2/professions/elementalist/specializations/weaver/traits/attunements.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { enteredCombat } from '#tests/helpers/engagement.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Training reductions must recognize numeric trait IDs without depending on catalog-name aliases.
test('elemental training reduces only matching weapon recharge with ID-only trait sets', () => {
  for (const [attunement, traitId] of [
    ['Fire', TRAIT.PYROMANCERS_TRAINING],
    ['Air', TRAIT.AEROMANCERS_TRAINING],
    ['Earth', TRAIT.GEOMANCERS_TRAINING],
    ['Water', TRAIT.AQUAMANCERS_TRAINING]
  ]) {
    const skill = { id: 'fixture.weapon', type: 'Weapon', attunement };
    // Compiled trait rules own training discounts; query each build through its assembled runtime.
    for (const selected of [false, true]) {
      const config = { specialization: 'Core', selectedTraitIds: selected ? [traitId] : [] };
      const result = runElementalist([], config);
      assert.deepEqual(result.warnings, []);
      const context = observedRuntime(result);
      const native = elementalistProfession.runtimeFor(config);
      assert.equal(native.rechargeWork(context, skill, 10), selected ? 8 : 10, attunement);
      assert.equal(native.rechargeWork(context, { ...skill, attunement: 'None' }, 10), 10);
      assert.equal(native.rechargeWork(context, { ...skill, type: 'Utility' }, 10), 10);
    }
  }
});

// Flat Flow State reduction follows Elemental Enchantment's multiplier and precedes Alacrity's recharge rate.
test('attunement recharge applies trait reductions in order and stays free before combat', () => {
  const context = {
    helpers: elementalistCatalog,
    config: { selectedTraitIds: [TRAIT.ELEMENTAL_ENCHANTMENT, TRAIT.FLOW_STATE] },
    engagement: enteredCombat(),
    traits: new Set([TRAIT.ELEMENTAL_ENCHANTMENT, TRAIT.FLOW_STATE]),
    cooldownController: { rate: () => 1.25 }
  };
  const skill = elementalistCatalog.skillsById.get(ID.FIRE_ATTUNEMENT);
  assert.equal(
    elementalistAttunementRechargeDuration(context, skill, 4, flowStateAttunementReduction(context.helpers, context)),
    1.92
  );
  // Weave Self's two-second base still receives both selected traits: (2 * 0.85 - 1) / 1.25.
  assert.ok(
    Math.abs(
      elementalistAttunementRechargeDuration(
        context,
        skill,
        2,
        flowStateAttunementReduction(context.helpers, context)
      ) - 0.56
    ) < 1e-12
  );
  context.engagement = createCombatEngagement().query;
  assert.equal(
    elementalistAttunementRechargeDuration(context, skill, 4, flowStateAttunementReduction(context.helpers, context)),
    0
  );
  assert.equal(
    elementalistAttunementRechargeDuration(context, skill, 2, flowStateAttunementReduction(context.helpers, context)),
    0
  );
});

test('Elementalist build defaults and canonical builds normalize explicitly', () => {
  const defaults = createElementalistBuildDefaults();

  assert.equal(defaults.profession, 'elementalist');
  assert.equal(defaults.weapons[0], 'Sword');
  assert.deepEqual(defaults.alternateWeapons, ['', '']);
  assert.equal(defaults.startingWeaponSet, 1);
  assert.equal(defaults.assumptions.hitboxSize, 'small');
  assert.equal(validateElementalistBuild(defaults).valid, true);
  assert.equal(elementalistCatalog.skillsById.has(-3), true);

  const migrated = migrateElementalistBuild({
    weapons: ['Scepter', 'Warhorn'],
    specializations: defaults.specializations
  });

  assert.equal(migrated.profession, 'elementalist');
  assert.deepEqual(migrated.weapons, ['Scepter', 'Warhorn']);
  assert.equal(validateElementalistBuild(migrated).valid, true);

  const migratedHitbox = migrateElementalistBuild({ assumptions: { hitboxSize: 'large' } });

  assert.equal(migratedHitbox.assumptions.hitboxSize, 'large');

  const twoSets = migrateElementalistBuild({
    ...defaults,
    alternateWeapons: ['Staff', ''],
    startingWeaponSet: 2
  });

  assert.deepEqual(twoSets.alternateWeapons, ['Staff', '']);
  assert.equal(twoSets.startingWeaponSet, 2);
  assert.equal(validateElementalistBuild(twoSets).valid, true);
  assert.equal(
    validateElementalistBuild({
      ...defaults,
      alternateWeapons: ['Staff', '']
    }).valid,
    true
  );
});
