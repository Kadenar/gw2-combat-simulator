import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

// Capacity is selected before the initial balance and cooling anchor, and public observations own no live pool.
test('Holosmith initializes one capped heat clock before preheated cooling', () => {
  for (const [selectedTraitIds, maximum] of [
    [[], 100],
    [[TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT], 150]
  ]) {
    const result = runEngineer([], { specialization: 'Holosmith', initialHeat: 200, selectedTraitIds });
    const runtime = observedRuntime(result);
    const state = runtime.profession.specialization.state;
    const projected = result.planningState.profession;
    assert.deepEqual(result.warnings, []);
    assert.equal(state.heat.value, maximum);
    assert.equal(state.heat.maximum, maximum);
    assert.equal(state.heat.rate, 0);
    assert.equal(state.forgeExitedAt, 0);
    assert.equal(state.passiveHeatAt, 0.1);
    assert.equal(state.overheated, false);
    assert.equal(Object.hasOwn(state, 'maximumHeat'), false);
    assert.equal(Object.hasOwn(projected, 'maximumHeat'), false);
    assert.notEqual(projected.heat, state.heat);
    runtime.resourceController.replace('heat', 0);
    assert.equal(projected.heat.value, maximum);
    const view = engineerProfession.ui
      .resourceViews({ specialization: 'Holosmith', professionState: projected })
      .find((entry) => entry.id === 'heat');
    assert.equal(view.value, maximum);
    assert.equal(view.maximum, maximum);
    assert.equal(runtime.resourceController.readyAt('heat', 1), null);
  }

  const empty = runEngineer([], { specialization: 'Holosmith', initialHeat: -10 });
  assert.equal(empty.planningState.profession.heat.value, 0);
  assert.equal(observedRuntime(empty).profession.specialization.state.forgeExitedAt, null);
  assert.equal(observedRuntime(empty).profession.specialization.state.passiveHeatAt, null);
});

// The owner rounds each 100 ms transaction; a continuous pool rate would change these fractional boundaries.
test('passive heat retains per-tick nine-decimal rounding with patched rates', () => {
  const result = runEngineer(
    [ID.ENGAGE_PHOTON_FORGE, { type: 'wait', durationMs: 400 }],
    {
      specialization: 'Holosmith'
    },
    {
      catalog: (catalog) => withProfile(catalog, PROFILE.heat, { energyRegenerationPerSecond: 1 / 3 })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.heat.value, 0.133333332);
  assert.equal(result.planningState.profession.heat.rate, 0);
});

// Venting a nearly empty pool must spend only the available heat and retain its combat packet ordering.
test('Vent Exhaust floors a small heat balance after emitting its packets', () => {
  const result = runEngineer(['Dodge'], {
    specialization: 'Holosmith',
    initialHeat: 3,
    selectedTraitIds: [TRAIT.THERMAL_RELEASE_VALVE]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.heat.value, 0);
  const heat = result.events.find((event) => event.type === 'engineer.heat' && event.reason === 'vent-exhaust');
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === ID.VENT_EXHAUST);
  assert.equal(heat.heat, 0);
  assert.equal(strike.at, heat.at);
  assert.ok(result.events.indexOf(strike) < result.events.indexOf(heat));
});

// Overheat keeps its delayed minimum penalty without replacing a longer cooldown already owned by the skill.
test('overheat penalty preserves a longer toolbelt cooldown', () => {
  const result = runEngineer(
    [ID.ENGAGE_PHOTON_FORGE, { type: 'wait', durationMs: 2000 }],
    {
      specialization: 'Holosmith',
      initialHeat: 99.8
    },
    {
      initialize(runtime) {
        runtime.cooldownController.setReadyAt(ID.GRENADE_BARRAGE, 100);
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.events.some((event) => event.type === 'engineer.heat' && event.reason === 'overheat'));
  assert.equal(observedRuntime(result).cooldownController.readyAt(ID.GRENADE_BARRAGE), 100);
});
