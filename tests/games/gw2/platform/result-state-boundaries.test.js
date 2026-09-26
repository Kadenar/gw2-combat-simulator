import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Separate phase counters expose accidental state mixing without relying on a saved rotation.
const profession = defineProfession({
  id: 'result-boundaries',
  name: 'Result boundaries',
  catalog: createCanonicalCatalog({
    generated: ['Opening', 'Later'].map((name, index) => ({
      id: 990001 + index,
      name,
      type: 'Utility',
      castTimeMs: 1000,
      cooldown: 20,
      effects: [50, 100].map((atMs) => ({
        type: 'strike',
        coefficient: 0,
        flatDamage: 100,
        atMs,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }))
    }))
  }),
  resources: {
    createState: () => ({ plannedCasts: 0, resolvedHits: 0 }),
    projectPlanningState(options) {
      assert.equal('resolverState' in options, false);
      assert.equal('schedulerState' in options, false);
      assert.equal('schedulerContext' in options, false);
      return options.profession;
    }
  },
  hooks: {
    onCastStart(context) {
      context.profession.plannedCasts += 1;
    },
    reactions: {
      'damage.resolved'(context) {
        context.profession.resolvedHits += 1;
      }
    }
  }
});

test('early death separates combat effects from later planned casts and cooldowns', () => {
  const options = {
    profession,
    rotation: ['Opening', 'Later'],
    config: { target: { health: 150 } }
  };
  const result = simulateGw2(options);
  assert.equal(result.rotationEndTime, 2);
  assert.equal(result.observationEndTime, 2);
  assert.equal(result.combatEndTime, 0.1);
  assert.equal(result.combatState.atSeconds, result.deathTime);
  assert.equal(result.planningState.atSeconds, 2);
  assert.equal(result.planningState.profession.plannedCasts, 2);
  assert.equal(result.planningState.profession.resolvedHits, 2);
  assert.equal(result.combatState.profession.resolvedHits, 2);
  assert.ok(result.planningState.cooldowns.Later.remaining > 0);
  assert.ok(result.events.every((event) => event.at <= result.combatEndTime));
  assert.equal(result.totalDamage, 200);
  assert.equal(result.dps, 4000);
  const score = simulateGw2({ ...options, output: 'score' });
  for (const [key, value] of Object.entries(score)) {
    if (key !== 'output') assert.deepEqual(value, result[key], key);
  }

  for (const key of ['endState', 'duration', 'profession', 'snapshot']) assert.equal(key in result, false, key);
  assert.equal('time' in result.planningState, false);
});

test('surviving combat and planning share the requested observation boundary', () => {
  for (const observationPolicy of [
    { kind: 'rotation' },
    { kind: 'tail', durationMs: 3000 },
    { kind: 'absolute', endTimeMs: 5000 }
  ]) {
    const result = simulateGw2({
      profession,
      rotation: ['Opening', 'Later'],
      config: { target: { health: 10000 } },
      observationPolicy
    });
    const end = observationPolicy.kind === 'rotation' ? 2 : 5;
    assert.equal(result.rotationEndTime, 2);
    assert.equal(result.observationEndTime, end);
    assert.equal(result.combatEndTime, end);
    assert.equal(result.planningState.atSeconds, end);
    assert.equal(result.combatState.atSeconds, end);
    assert.equal(result.combatState.profession.resolvedHits, 4);
    assert.equal(result.planningState.cooldowns.Later.remaining, (18 - end) * 1000);
  }
});

test('explicit combat starts preserve absolute state clocks and exclude precombat hits', () => {
  const result = simulateGw2({
    profession,
    rotation: ['Opening', { type: 'combat-start' }, 'Later'],
    config: { target: { health: 150 } },
    observationPolicy: { kind: 'tail', durationMs: 3000 }
  });
  assert.equal(result.combatStartTime, 1);
  assert.equal(result.rotationEndTime, 2);
  assert.equal(result.observationEndTime, 5);
  assert.equal(result.combatState.atSeconds, 1.1);
  assert.equal(result.planningState.atSeconds, 5);
  assert.equal(result.combatState.profession.resolvedHits, 2);
  assert.equal(result.totalDamage, 200);
});
