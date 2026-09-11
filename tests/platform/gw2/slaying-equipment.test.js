import assert from 'node:assert/strict';
import test from 'node:test';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { aggregateSigilSet } from '#gw2/platform/equipment/sigils/loadout.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { sigilOptionLabel, utilityOptionLabel } from '#gw2/app/build/equipment-option-labels.js';

// Minimal queries isolate equipment stacking from saved rotations and profession balance.
test('slaying bonuses multiply strikes outside the shared additive bucket and follow the active weapon set', () => {
  const profession = {
    id: 'test',
    ...createModifierHooks({
      rules: [
        {
          id: 'test.additive',
          target: MODIFIER_TARGET.STRIKE_DAMAGE,
          operation: 'damage-additive',
          amount: 0.2
        }
      ]
    })
  };
  const hit = { type: 'damage', source: 'Player', at: 0 };
  for (const timeOfDay of ['day', 'night']) {
    for (const utility of ['', 'Potion of Slaying']) {
      const query = createGw2CombatQuery({
        profession,
        config: {
          timeOfDay,
          utility,
          sigilSets: [aggregateSigilSet(['Slaying', 'Force']), aggregateSigilSet(['Force'])]
        }
      });
      const potionMultiplier = utility ? 1.1 : 1;
      assert.ok(
        Math.abs(query.strikeMultiplier(hit, 0, { activeWeaponSet: 1 }) - 1.28 * 1.07 * potionMultiplier) < 1e-12
      );
      assert.ok(Math.abs(query.strikeMultiplier(hit, 0, { activeWeaponSet: 2 }) - 1.25 * potionMultiplier) < 1e-12);
      assert.equal(query.conditionMultiplier('Bleeding', 0), 1);
      assert.equal(query.conditionDurationMultiplier('Bleeding', 0), 1);
    }
  }

  assert.deepEqual(aggregateSigilSet(['Slaying', 'Slaying']), aggregateSigilSet(['Slaying']));
});

test('slaying selections survive build loading and potion removal comparisons remove the damage bonus', () => {
  const build = mesmerAppAdapter.toApplicationBuild({
    ...mesmerAppAdapter.profession.createBuildDefaults(),
    utility: 'Potion of Slaying',
    weaponSigils: [
      ['Slaying', 'Force'],
      ['Force', 'Accuracy']
    ],
    rotation: ['Flying Cutter'],
    relic: '',
    food: '',
    selectedSkills: {}
  });
  const loaded = mesmerAppAdapter.toApplicationBuild(JSON.parse(JSON.stringify(build)));
  assert.equal(loaded.utility, 'Potion of Slaying');
  assert.deepEqual(loaded.weaponSigils, build.weaponSigils);
  const app = {
    build: loaded,
    adapter: mesmerAppAdapter,
    profession: mesmerAppAdapter.profession,
    attributeWeaponSet: 1,
    skillByName: mesmerAppAdapter.profession.catalog.skillsByName,
    skillById: mesmerAppAdapter.profession.catalog.skillsById
  };
  mesmerAppAdapter.recalculate(app);
  const request = mesmerAppAdapter.modifierContributionRequest(app);
  const comparison = request.comparisons.find(({ modifier }) => modifier.id === 'Utility:Potion of Slaying');
  assert.equal(request.baseConfig.utility, build.utility);
  assert.equal(comparison.config.utility, '');
  assert.deepEqual(comparison.config.weaponSetStats, request.baseConfig.weaponSetStats);
  const contribution = mesmerAppAdapter
    .calculateModifierContributions(request)
    .find(({ id }) => id === 'Utility:Potion of Slaying');
  assert.ok(Math.abs(contribution.pctIncrease - 10) < 1e-10);
});

test('slaying equipment labels explain strike bonuses and the assumed matching enemy', () => {
  assert.match(sigilOptionLabel('Slaying'), /\+3% strike damage, \+7% multiplicative strike damage/);
  assert.match(sigilOptionLabel('Slaying'), /matching enemy assumed/);
  assert.match(utilityOptionLabel('Potion of Slaying'), /\+10% multiplicative strike damage; matching enemy assumed/);
});
