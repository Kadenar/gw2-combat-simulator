import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { buildCombatResult, buildSimulationScore } from '#gw2/platform/results/combat-result.js';

// Separate phase counters expose accidental state mixing without relying on a saved rotation.
const profession = defineTestProfession({
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
  assert.equal(result.combatEndTime, result.deathTime);
  assert.equal(result.planningState.atSeconds, 2);
  assert.equal(result.planningState.profession.plannedCasts, 2);
  assert.equal(result.planningState.profession.resolvedHits, 2);
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
    assert.equal(result.planningState.profession.resolvedHits, 4);
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
  assert.equal(result.combatEndTime, 1.1);
  assert.equal(result.planningState.atSeconds, 5);
  assert.equal(result.planningState.profession.resolvedHits, 2);
  assert.equal(result.totalDamage, 200);
});

// Public output must be independently editable after the run without rewriting the owner's accepted facts.
test('result events, damage rows, and command steps are detached from live stores', () => {
  const result = observeGw2Runtime({ profession: profession.runtimeFor({}), rotation: ['Opening'], config: {} });
  const runtime = observedRuntime(result);
  const liveStepEnd = runtime.steps[0].end;
  const liveDamage = [...runtime.breakdown.values()][0].damage;
  const liveAction = runtime.facts.ofType('action')[0];
  const liveActionAt = liveAction.at;
  result.steps[0].end = -1;
  result.breakdown[0].damage = -1;
  result.events.find((event) => event.type === 'action').at = -1;
  assert.equal(runtime.steps[0].end, liveStepEnd);
  assert.equal([...runtime.breakdown.values()][0].damage, liveDamage);
  assert.equal(liveAction.at, liveActionAt);
  assert.equal(Object.hasOwn([...runtime.breakdown.values()][0], 'casts'), false);
});

// Selective output copying must retain nested detachment and leave natural application lifetimes untouched.
test('combat reports detach nested settlements, environment ticks, proc state, and score warnings', () => {
  const observed = observeGw2Runtime({ profession: profession.runtimeFor({}), rotation: ['Opening'], config: {} });
  const runtime = observedRuntime(observed);
  const application = { type: 'condition', at: 0, naturalExpiresAt: 10, damageTicks: [{ at: 0.5, damage: 7 }] };
  const action = { type: 'action', at: 0, skillId: 990001, name: 'Opening', audience: { maximumRecipients: 5 } };
  const environment = { name: 'Fixture', damage: 7, stackSeconds: 1, stacks: 1, damageTicks: [{ at: 0.5, damage: 7 }] };
  const proc = { start: 0, effectState: { stacks: 2, maximumStacks: 5 } };
  runtime.resolved.push(application);
  runtime.environmentConditions.set('Fixture', environment);
  runtime.procSteps.push(proc);
  const score = buildSimulationScore(runtime, 1, false);
  const result = buildCombatResult(runtime, score, [action]);
  result.events[0].audience.maximumRecipients = -1;
  result.resolvedEvents.find((event) => event.naturalExpiresAt === 10).damageTicks[0].damage = -1;
  result.environmentConditionBreakdown[0].damageTicks[0].damage = -1;
  result.procSteps.find((step) => step.effectState).effectState.stacks = -1;
  result.warnings.push('consumer edit');
  assert.equal(action.audience.maximumRecipients, 5);
  assert.equal(application.damageTicks[0].damage, 7);
  assert.equal(application.naturalExpiresAt, 10);
  assert.equal(environment.damageTicks[0].damage, 7);
  assert.equal(proc.effectState.stacks, 2);
  assert.deepEqual(score.warnings, []);
});
