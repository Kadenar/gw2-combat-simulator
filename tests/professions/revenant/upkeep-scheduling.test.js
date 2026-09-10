import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const baseConfig = {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 100,
  primaryWeapon: 'Sword',
  stats: { power: 2000, precision: 1500, ferocity: 500, conditionDamage: 1000, expertise: 0, vitality: 1000 },
  target: { armor: 2597, conditions: {} }
};
const simulate = createProfessionSimulator(revenantProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const affinityTicks = (result) => result.events.filter((event) => event.reason === 'enigmatic-upkeep');
const daggerTimes = (result) =>
  result.events
    .filter((event) => event.type === 'damage' && event.skillName === 'Lesser Enchanted Daggers' && event.at > 0)
    .map((event) => event.at);
const alliedProcTimes = (result) => [
  ...new Set(result.events.filter((event) => /Ally 1/.test(event.name || '')).map((event) => event.at))
];

// Capture the existing queue to verify cancellation even before an abandoned task reaches its deadline.
function simulateWithTasks(specialization, rotation, config = {}) {
  let tasks;
  const profession = {
    ...revenantProfession,
    resolveRuntime(runtimeConfig) {
      const runtime = revenantProfession.resolveRuntime(runtimeConfig);
      return {
        ...runtime,
        afterCast(context, skill) {
          runtime.afterCast(context, skill);
          tasks = context.tasks;
        }
      };
    }
  };
  const result = createProfessionSimulator(profession, baseConfig)(specialization, rotation, config);
  assert.deepEqual(result.warnings, []);
  return { result, tasks };
}

test('Conduit upkeep resources are independent of wait segmentation', () => {
  // Idle time must deliver every due resource tick without relying on unrelated casts or reads.
  const results = [[9100], Array(91).fill(100)].map((waits) =>
    simulate('Conduit', ['Impossible Odds', ...waits.map(wait)])
  );
  for (const result of results) {
    assert.deepEqual(result.warnings, []);
    assert.equal(result.endState.profession.affinity, 4);
  }

  assert.equal(results[0].endState.profession.energy, results[1].endState.profession.energy);
});

test('Conduit upkeep snapshots use the due tick timestamp', () => {
  // A resource snapshot must describe its own tick, never the previous scheduler clock.
  const result = simulate('Conduit', ['Impossible Odds', wait(9100)]);
  assert.deepEqual(
    affinityTicks(result).map((event) => event.at),
    [3, 6, 9]
  );
});

test('Conduit dagger cadence survives long waits and stops at form expiry', () => {
  // Form expiry suppresses subsequent dagger ticks while the underlying upkeep remains active.
  const results = [[9100], Array(91).fill(100)].map((waits) =>
    simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', ...waits.map(wait)])
  );
  assert.deepEqual(daggerTimes(results[0]), daggerTimes(results[1]));
  assert.ok(daggerTimes(results[0]).includes(1));
  assert.ok(!daggerTimes(results[0]).includes(9));
  assert.equal(results[0].endState.profession.conduitForm, '');
  assert.equal(results[0].endState.profession.activeUpkeeps.length, 1);
});

test('allied Soulcleave cadence uses ally intervals across idle waits', () => {
  // Slow allies retain their fractional cadence rather than being rounded to Core heartbeat times.
  for (const waits of [[6100], Array(61).fill(100)]) {
    const result = simulate('Renegade', ["Soulcleave's Summit", ...waits.map(wait)], {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      allies: { count: 1, strikesPerSecond: 0.4 }
    });
    assert.deepEqual(result.warnings, []);
    const start = result.steps[0].end / 1000;
    assert.deepEqual(alliedProcTimes(result), [start + 2.5, start + 5]);
  }
});

test('starvation cancels Conduit resource and dagger ticks at the boundary', () => {
  // Continuous Energy settlement wins over a discrete upkeep tick at the same instant.
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', wait(4100)], { initialEnergy: 8 });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.find((event) => event.reason === 'upkeep-starved').at, 3);
  assert.deepEqual(affinityTicks(result), []);
  assert.deepEqual(daggerTimes(result), [1, 2]);
  assert.equal(result.endState.profession.activeUpkeeps.length, 0);
});

test('release and reactivation start a fresh Conduit cadence', () => {
  // A released activation cannot contribute a tick to the replacement activation.
  const result = simulate('Conduit', [
    'Impossible Odds',
    wait(2100),
    'Relinquish Power',
    wait(1000),
    'Impossible Odds',
    wait(6100)
  ]);
  assert.deepEqual(result.warnings, []);
  const activation = result.steps.filter((step) => step.skill === 'Impossible Odds').at(-1).end / 1000;
  assert.deepEqual(
    affinityTicks(result).map((event) => event.at),
    [activation + 3, activation + 6]
  );
});

test('legend swap cancels queued upkeep owners immediately', () => {
  // Inspect the real queue before old tasks can retire themselves by observing an inactive skill.
  const { result, tasks } = simulateWithTasks('Conduit', ['Impossible Odds', wait(100), 'Swap Legends']);
  assert.equal(tasks.nextAt('revenant.upkeep-pulse'), Infinity);
  assert.equal(tasks.nextAt('revenant.conduit-upkeep-affinity'), Infinity);
  assert.equal(tasks.nextAt('revenant.conduit-upkeep-daggers'), Infinity);
  assert.equal(result.endState.profession.affinity, 0);
});

test('Conduit upkeep ticks precede same-time cast completion', () => {
  // Completion observers must see resource gains that previously ran in the advance phase.
  const castMs = simulate('Conduit', ['Preparation Thrust']).steps[0].end;
  let affinityAtCompletion;
  const profession = {
    ...revenantProfession,
    resolveRuntime(config) {
      const runtime = revenantProfession.resolveRuntime(config);
      return {
        ...runtime,
        onCastComplete(context, skill) {
          if (skill.name === 'Preparation Thrust')
            affinityAtCompletion = context.state.profession.specialization.state.affinity;
          runtime.onCastComplete(context, skill);
        }
      };
    }
  };
  const result = createProfessionSimulator(profession, baseConfig)('Conduit', [
    'Impossible Odds',
    wait(3000 - castMs),
    'Preparation Thrust'
  ]);
  assert.deepEqual(result.warnings, []);
  assert.equal(affinityAtCompletion, 2);
});

test('only actual Core pulse producers schedule Core upkeep tasks', () => {
  // Upkeep resource drain and specialization work must not require an empty Core heartbeat.
  for (const [specialization, name, legend, pulses] of [
    ['Core', 'Impossible Odds', LEGEND.ASSASSIN, false],
    ['Renegade', "Soulcleave's Summit", LEGEND.RENEGADE, false],
    ['Core', 'Embrace the Darkness', LEGEND.DEMON, true],
    ['Core', 'Vengeful Hammers', LEGEND.DWARF, true]
  ]) {
    const { tasks } = simulateWithTasks(specialization, [name], {
      selectedLegends: [legend, LEGEND.CENTAUR],
      startingLegend: legend
    });
    assert.equal(Number.isFinite(tasks.nextAt('revenant.upkeep-pulse')), pulses, name);
    assert.equal(tasks.nextAt('revenant.soulcleave-allied-proc'), Infinity, 'no allies means no allied task');
  }
});

test('releasing Conduit upkeep cancels both specialization tasks', () => {
  // The release terminates every cadence attached to this upkeep before its next deadline.
  const { tasks, result } = simulateWithTasks('Conduit', ['Impossible Odds', wait(100), 'Relinquish Power']);
  assert.equal(tasks.nextAt('revenant.conduit-upkeep-affinity'), Infinity);
  assert.equal(tasks.nextAt('revenant.conduit-upkeep-daggers'), Infinity);
  assert.equal(result.endState.profession.activeUpkeeps.length, 0);
});

test('starved Conduit upkeep can reactivate with a fresh deadline', () => {
  // A canceled starvation owner must not suppress the next activation or preserve its old tick phase.
  const result = simulate('Conduit', ['Impossible Odds', wait(7100), 'Impossible Odds', wait(3100)], {
    initialEnergy: 8
  });
  assert.deepEqual(result.warnings, []);
  const activation = result.steps.filter((step) => step.skill === 'Impossible Odds').at(-1).end / 1000;
  assert.deepEqual(
    affinityTicks(result).map((event) => event.at),
    [activation + 3]
  );
});

test('Soulcleave dismissal and legend swap cancel allied tasks, and recasting restarts cadence', () => {
  // Shared upkeep ownership must cancel allied work as well as Core damage pulses.
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    allies: { count: 1, strikesPerSecond: 1 }
  };
  for (const disable of ['Dismiss Lieutenant Soulcleave', 'Swap Legends']) {
    const { tasks } = simulateWithTasks('Renegade', ["Soulcleave's Summit", wait(100), disable], config);
    assert.equal(tasks.nextAt('revenant.soulcleave-allied-proc'), Infinity);
  }

  const result = simulate(
    'Renegade',
    ["Soulcleave's Summit", wait(1100), 'Dismiss Lieutenant Soulcleave', "Soulcleave's Summit", wait(2100)],
    config
  );
  assert.deepEqual(result.warnings, []);
  const activations = result.steps
    .filter((step) => step.skill === "Soulcleave's Summit")
    .map((step) => step.end / 1000);
  assert.deepEqual(alliedProcTimes(result), [activations[0] + 1, activations[1] + 1, activations[1] + 2]);
});
