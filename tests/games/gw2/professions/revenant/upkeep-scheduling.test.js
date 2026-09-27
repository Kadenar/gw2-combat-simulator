import assert from 'node:assert/strict';
import { canonicalTime } from '#kernel/core/clock.js';
import { test } from 'node:test';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const baseConfig = {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 100,
  primaryWeapon: 'Sword',
  stats: { power: 2000, precision: 1500, ferocity: 500, conditionDamage: 1000, expertise: 0, vitality: 1000 },
  target: { armor: 2597, conditions: {} }
};
const simulate = createObservedProfessionSimulator(revenantProfession, baseConfig);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const affinity = (result) => observedRuntime(result).profession.specialization.state.affinity;
const daggerTimes = (result) =>
  result.events
    .filter((event) => event.type === 'damage' && event.skillName === 'Lesser Enchanted Daggers' && event.at > 0)
    .map((event) => event.at);
const alliedProcTimes = (result) => [
  ...new Set(result.events.filter((event) => /Ally 1/.test(event.name || '')).map((event) => event.at))
];
// Affinity has no report event; probing the live owner at inclusive horizons locates each actual tick.
const affinityAt = (prefix, untilMs, config = {}) => affinity(simulate('Conduit', [...prefix, wait(untilMs)], config));

test('Conduit upkeep resources are independent of wait segmentation', () => {
  // Idle time must deliver every due resource tick without relying on unrelated casts or reads.
  const results = [[9100], Array(91).fill(100)].map((waits) =>
    simulate('Conduit', ['Impossible Odds', ...waits.map(wait)])
  );
  for (const result of results) {
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.affinity, 4);
  }

  assert.equal(results[0].planningState.profession.energy.value, results[1].planningState.profession.energy.value);
});

test('Conduit upkeep affinity ticks land on their own three-second deadlines', () => {
  // The activation grants one affinity; each owned tick adds one exactly at its deadline.
  assert.deepEqual(
    [2999, 3000, 5999, 6000, 8999, 9000].map((ms) => affinityAt(['Impossible Odds'], ms)),
    [1, 2, 2, 3, 3, 4]
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
  assert.equal(results[0].planningState.profession.conduitForm, '');
  assert.equal(results[0].planningState.profession.activeUpkeeps.length, 1);
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
    assert.deepEqual(
      alliedProcTimes(result).map((at) => Number((at - start).toFixed(9))),
      [2.5, 5]
    );
  }
});

test('starvation cancels Conduit resource and dagger ticks at the boundary', () => {
  // Continuous Energy settlement wins over a discrete upkeep tick at the same instant.
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', wait(4100)], { initialEnergy: 8 });
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).cooldowns.get(SKILL.IMPOSSIBLE_ODDS), 3 + 4 / 1.25);
  assert.equal(affinity(result), 1, 'the starved upkeep grants no tick at its three-second deadline');
  assert.deepEqual(daggerTimes(result), [1, 2]);
  assert.equal(result.planningState.profession.activeUpkeeps.length, 0);
});

test('release and reactivation start a fresh Conduit cadence', () => {
  // A released activation cannot contribute a tick to the replacement activation.
  const prefix = ['Impossible Odds', wait(2100), 'Relinquish Power', wait(1000), 'Impossible Odds'];
  const tick = (offsetMs) => affinityAt(prefix, offsetMs);
  // Each activation grants one affinity; only the replacement's ticks follow.
  assert.deepEqual([tick(2999), tick(3000), tick(5999), tick(6000)], [2, 3, 3, 4]);
});

test('legend swap retires the upkeep and its specialization cadences immediately', () => {
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', wait(100), 'Swap Legends', wait(9000)]);
  assert.deepEqual(result.warnings, []);
  assert.equal(affinity(result), 0, 'the swap resets affinity and no later upkeep tick restores it');
  assert.deepEqual(result.planningState.profession.activeUpkeeps, []);
  assert.deepEqual(daggerTimes(result), []);
  assert.equal(
    result.events.some((event) => event.type === 'damage' && event.skillName === 'Vengeful Hammers'),
    false
  );
});

test('Conduit upkeep ticks precede same-time cast completion', () => {
  // Completion observers must see the affinity granted by a tick due at the same instant.
  const castMs = simulate('Conduit', ['Preparation Thrust']).steps[0].end;
  let affinityAtCompletion;
  const result = runRevenant(
    ['Impossible Odds', wait(3000 - castMs), 'Preparation Thrust'],
    { ...baseConfig, specialization: 'Conduit' },
    {
      extend: (native) => ({
        onCastComplete(runtime, cast) {
          if (cast.skill.name === 'Preparation Thrust')
            affinityAtCompletion = runtime.profession.specialization.state.affinity;
          native.onCastComplete(runtime, cast);
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(affinityAtCompletion, 2);
});

test('only actual Core pulse producers emit Core upkeep pulses', () => {
  // Upkeep drain and specialization work need no empty Core heartbeat.
  for (const [specialization, name, legend, pulses] of [
    ['Core', 'Impossible Odds', LEGEND.ASSASSIN, false],
    ['Renegade', "Soulcleave's Summit", LEGEND.RENEGADE, false],
    ['Core', 'Embrace the Darkness', LEGEND.DEMON, true],
    ['Core', 'Vengeful Hammers', LEGEND.DWARF, true]
  ]) {
    const result = simulate(specialization, [name, wait(3000)], {
      selectedLegends: [legend, LEGEND.CENTAUR],
      startingLegend: legend
    });
    assert.deepEqual(result.warnings, []);
    const damage = result.events.filter((event) => event.type === 'damage');
    assert.equal(damage.length > 1, pulses, name);
    assert.deepEqual(alliedProcTimes(result), [], 'no allies means no allied procs');
  }
});

test('releasing Conduit upkeep ends both specialization cadences', () => {
  // The release terminates every cadence attached to this upkeep before its next deadline.
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', wait(100), 'Relinquish Power', wait(5000)]);
  assert.deepEqual(result.warnings, []);
  assert.equal(affinity(result), 1);
  // Relinquish Power is itself an Assassin legend skill; only the upkeep's one-second cadence must stop.
  assert.deepEqual(daggerTimes(result), [0.1]);
  assert.equal(result.planningState.profession.activeUpkeeps.length, 0);
});

test('starved Conduit upkeep can reactivate with a fresh deadline', () => {
  // A canceled starvation owner must not suppress the next activation or preserve its old tick phase.
  const prefix = ['Impossible Odds', wait(7100), 'Impossible Odds'];
  const config = { initialEnergy: 8 };
  const result = simulate('Conduit', [...prefix, wait(3100)], config);
  assert.deepEqual(result.warnings, []);
  // Two activations each grant one affinity; only the second activation's first tick follows.
  assert.deepEqual(
    [2999, 3000].map((ms) => affinityAt(prefix, ms, config)),
    [2, 3]
  );
});

test('Soulcleave dismissal and legend swap end allied procs, and recasting restarts cadence', () => {
  // Shared upkeep ownership must end allied work as well as Core damage pulses.
  const config = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    allies: { count: 1, strikesPerSecond: 1 }
  };
  for (const disable of ['Dismiss Lieutenant Soulcleave', 'Swap Legends']) {
    const ended = simulate('Renegade', ["Soulcleave's Summit", wait(100), disable, wait(3000)], config);
    assert.deepEqual(ended.warnings, []);
    assert.deepEqual(alliedProcTimes(ended), []);
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
  assert.deepEqual(
    alliedProcTimes(result),
    [activations[0] + 1, activations[1] + 1, activations[1] + 2].map(canonicalTime)
  );
});
