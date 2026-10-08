import assert from 'node:assert/strict';
import test from 'node:test';
import { skillCostAvailability } from '#gw2/platform/execution/skill-cost.js';
import { createRuntimeEndurance, createRuntimeResources } from '#gw2/platform/simulation/runtime-resources.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';

test('cost admission never treats a future resource deadline as already affordable', () => {
  // The gate must preserve the owner's verdict even within the old clock epsilon or below clock precision.
  for (const resource of ['endurance', 'energy']) {
    const skill = { name: 'Cost probe', resourceCost: 50, cost: { resource } };
    for (const readyAt of [1, 1.0000004, 1.000001, 1.00005, 1.0001, null]) {
      const runtime = {
        time: 1,
        endurance: { readyAt: () => readyAt },
        resourceController: { readyAt: () => readyAt }
      };
      const availability = skillCostAvailability(runtime, skill);
      if (readyAt === 1) assert.equal(availability, null);
      else {
        assert.equal(availability.ready, false);
        assert.equal(availability.retryAt, readyAt);
      }
    }
  }
});

test('endurance admission and payment wait for the full dodge cost', () => {
  // A shortage measured in real resource units must never be excused by a time epsilon.
  for (const time of [9.9998, 9.9999, 9.99995, 9.999999, 10]) {
    const pool = { value: 0, maximum: 100, updatedAt: 0, rate: 0 };
    const runtime = { time: 0, config: {}, history: [] };
    runtime.endurance = createRuntimeEndurance(runtime, {
      endurance: { state: () => pool, maximum: () => 100, regenerationRate: () => 5 }
    });
    runtime.endurance.spend(100);
    runtime.time = time;
    const skill = { name: 'Dodge', resourceCost: 50, cost: { resource: 'endurance' } };
    const availability = skillCostAvailability(runtime, skill);
    if (time < 10) {
      assert.equal(availability.retryAt, 10);
      assert.throws(() => runtime.endurance.spend(50), /Insufficient endurance/);
      runtime.time = availability.retryAt;
    } else assert.equal(availability, null);
    assert.equal(skillCostAvailability(runtime, skill), null);
    runtime.endurance.spend(50);
    assert.equal(pool.value, 0);
  }
});

test('continuous resource admission and payment agree just before recovery readiness', () => {
  // Exercise the real controller so admission cannot silently borrow future recovery from another resource type.
  for (const time of [0.9998, 0.9999, 0.99995, 0.999999, 1]) {
    const pool = { value: 0, maximum: 10, updatedAt: 0, rate: 0 };
    const runtime = { time: 0, mechanics: {} };
    runtime.resourceController = createRuntimeResources(runtime, {
      resources: {
        energy: {
          kind: 'continuous',
          state: () => pool,
          maximum: () => 10,
          initial: () => 0,
          recovery: () => 1
        }
      }
    });
    runtime.resourceController.initialize();
    runtime.time = time;
    const skill = { name: 'Energy probe', resourceCost: 1, cost: { resource: 'energy' } };
    const availability = skillCostAvailability(runtime, skill);
    if (time < 1) {
      assert.equal(availability.retryAt, 1);
      assert.throws(() => runtime.resourceController.spend('energy', 1), /Insufficient energy/);
      runtime.time = availability.retryAt;
    } else assert.equal(availability, null);
    assert.equal(skillCostAvailability(runtime, skill), null);
    runtime.resourceController.spend('energy', 1);
    assert.equal(pool.value, 0);
  }
});

test('resource forecasts cannot round a real sub-microsecond shortage into present affordability', () => {
  // The amount deficit exceeds resource rounding tolerance even though its recovery time is below clock precision.
  const pool = { value: 0, maximum: 100, updatedAt: 0, rate: 0 };
  const runtime = { time: 0, config: {}, history: [], mechanics: {} };
  const endurance = createRuntimeEndurance(runtime, {
    endurance: { state: () => pool, maximum: () => 100, regenerationRate: () => 5 }
  });
  endurance.spend(50.0000001);
  assert.equal(endurance.readyAt(50), 0.04);
  assert.throws(() => endurance.spend(50), /Insufficient endurance/);
  runtime.time = 0.04;
  assert.equal(endurance.readyAt(50), 0.04);
  endurance.spend(50);

  runtime.time = 0;
  const energyPool = { value: 0, maximum: 10, updatedAt: 0, rate: 0 };
  const energy = createRuntimeResources(runtime, {
    resources: {
      energy: {
        kind: 'continuous',
        state: () => energyPool,
        maximum: () => 10,
        initial: () => 0.9999999,
        recovery: () => 1
      }
    }
  });
  energy.initialize();
  assert.equal(energy.readyAt('energy', 1), 0.04);
  assert.throws(() => energy.spend('energy', 1), /Insufficient energy/);
  runtime.time = 0.04;
  assert.equal(energy.readyAt('energy', 1), 0.04);
  energy.spend('energy', 1);
});

test('native Dodge waits for funded recovery across fractional waits in both output modes', () => {
  // Public rotation input may end a wait just before regeneration funds the third Dodge.
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Dagger',
    boons: {},
    selectedTraitIds: [],
    selectedSkillIds: [],
    target: { armor: 2597, conditions: {} },
    sigilSets: [{ names: [] }]
  };
  for (const durationMs of [8399.8, 8399.9, 8399.95, 8399.999, 8400, 8400.001]) {
    const options = {
      profession: thiefProfession,
      config,
      rotation: [
        { type: 'cast', skillId: -5 },
        { type: 'cast', skillId: -5 },
        { type: 'wait', durationMs },
        { type: 'cast', skillId: -5 }
      ]
    };
    const detailed = simulateGw2(options);
    const score = simulateGw2({ ...options, output: 'score' });
    assert.deepEqual(detailed.warnings, []);
    assert.deepEqual(score.warnings, []);
    const dodge = detailed.events.findLast((event) => event.type === 'action' && event.skillId === -5);
    assert.equal(dodge.at, durationMs <= 8400 ? 10 : 10.04);
    assert.equal(score.rotationEndTime, detailed.rotationEndTime);
  }
});
