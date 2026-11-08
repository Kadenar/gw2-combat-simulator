import assert from 'node:assert/strict';
import { test } from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { createCombatExecution } from '#gw2/platform/simulation/combat-execution.js';
import { runRuntime } from '#gw2/platform/simulation/runtime.js';
import { createDamageExecution } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { createRevenantUpkeepContribution } from '#gw2/professions/revenant/core/mechanics/upkeep-lifecycle.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { wait } from '#tests/helpers/commands.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const baseConfig = {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 100,
  primaryWeapon: 'Sword',
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: { armor: 2597, conditions: {} }
};
const simulate = createObservedProfessionSimulator(revenantProfession, baseConfig);
const affinity = (result) => observedRuntime(result).profession.specialization.state.affinity.value;
const daggerTimes = (result) =>
  result.events
    .filter((event) => event.type === 'damage' && event.skillName === 'Lesser Enchanted Daggers' && event.at > 0)
    .map((event) => event.at);
const alliedProcTimes = (result) => [
  ...new Set(result.events.filter((event) => /Ally 1/.test(event.name || '')).map((event) => event.at))
];
// Affinity has no report event; probing the live owner at inclusive horizons locates each actual tick.
const affinityAt = (prefix, untilMs, config = {}) => affinity(simulate('Conduit', [...prefix, wait(untilMs)], config));

test('composed upkeep contributions each start their own cadence once', () => {
  // Contributions share a runtime but must not replace or duplicate each other's scheduled work.
  const scheduled = [];
  const skill = revenantProfession.catalog.skills.find((entry) => entry.id === SKILL.IMPOSSIBLE_ODDS);
  const runtime = {
    time: 0,
    profession: { core: { activeUpkeeps: [{ skillId: skill.id, startsAt: 0 }] } },
    schedule: (name) => scheduled.push(name)
  };
  const names = ['test.first-upkeep', 'test.second-upkeep'];
  const hooks = composeRuntimeHooks(
    names.map((name) => createRevenantUpkeepContribution([{ name, accepts: () => true, interval: 1, pulse() {} }]))
  );
  hooks.onCastCommit(runtime, { skill });
  assert.deepEqual(scheduled, names);
});

test('Conduit upkeep delivers due affinity ticks during idle waits', () => {
  // Idle time must deliver every due resource tick without relying on unrelated casts or reads.
  const result = simulate('Conduit', ['Impossible Odds', wait(9100)]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.AFFINITY].value, 4);
});

test('Conduit dagger cadence survives long waits and stops at form expiry', () => {
  // Form expiry suppresses subsequent dagger ticks while the underlying upkeep remains active.
  const results = [[9100], Array(91).fill(100)].map((waits) =>
    simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', ...waits.map(wait)])
  );
  assert.deepEqual(daggerTimes(results[0]), daggerTimes(results[1]));
  assert.ok(daggerTimes(results[0]).includes(1));
  assert.ok(!daggerTimes(results[0]).includes(9));
  assert.equal(results[0].planningState.profession[STATE.CONDUIT_FORM], '');
  assert.equal(results[0].planningState.profession[STATE.ACTIVE_UPKEEPS].length, 1);
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
    const times = alliedProcTimes(result);
    assert.ok(times.length > 0);
    assert.ok(times.every((at) => at >= result.steps[0].end / 1000 && at <= 6.1));
    assert.ok(times.every((at, index) => index === 0 || at - times[index - 1] >= 1 / 0.4));
  }
});

test('starvation cancels Conduit resource and dagger ticks at the boundary', () => {
  // Continuous Energy settlement wins over a discrete upkeep tick at the same instant.
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', wait(4100)], { initialEnergy: 8 });
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).cooldownController.readyAt(SKILL.IMPOSSIBLE_ODDS), 3 + 4 / 1.25);
  assert.equal(affinity(result), 1, 'the starved upkeep grants no tick at its three-second deadline');
  assert.deepEqual(daggerTimes(result), [1, 2]);
  assert.equal(result.planningState.profession[STATE.ACTIVE_UPKEEPS].length, 0);
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
  assert.deepEqual(result.planningState.profession[STATE.ACTIVE_UPKEEPS], []);
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
        onCastCommit(runtime, cast) {
          if (cast.skill.name === 'Preparation Thrust')
            affinityAtCompletion = runtime.profession.specialization.state.affinity.value;

          native.onCastCommit(runtime, cast);
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
    const result = simulate(
      specialization,
      [revenantProfession.catalog.skills.find((skill) => skill.name === name).id, wait(3000)],
      {
        selectedLegends: [legend, LEGEND.CENTAUR],
        startingLegend: legend
      }
    );
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
  assert.deepEqual(daggerTimes(result), [0.12]);
  assert.equal(result.planningState.profession[STATE.ACTIVE_UPKEEPS].length, 0);
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

test('Soulcleave dismissal and legend swap end allied procs, while recasting preserves cadence', () => {
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
    .filter((step) => step.skillName === "Soulcleave's Summit")
    .map((step) => step.end / 1000);
  const times = alliedProcTimes(result);
  for (const [index, startedAt] of activations.entries()) {
    const window = times.filter((at) => at >= startedAt && at < (activations[index + 1] ?? Infinity));
    assert.ok(window.length > 0, 'each active upkeep can grant allied procs');
    assert.equal(window[0], Math.floor(startedAt) + 1, 'recasting rejoins the original strike grid');
    // One strike per second lands on each 1 s ICD deadline, so every strike after the first procs.
    assert.ok(
      window.every((at, i) => i === 0 || Math.abs(at - window[i - 1] - 1) < 1e-9),
      'a strike on the cooldown deadline is eligible'
    );
  }
});

// Observe real occurrence completion so retired work cannot silently prolong an otherwise finished measurement.
function observeOccurrence(profession, config, execution) {
  let runtime;
  const result = runRuntime({
    profession,
    config,
    output: 'damage',
    ownsEffect: () => true,
    execution: {
      ...execution,
      initialize(owner) {
        runtime = owner;
        execution.initialize?.(owner);
      }
    }
  });
  return { result, runtime };
}

test('released upkeep leaves no pending work extending the occurrence window', () => {
  for (const specialization of ['Core', 'Conduit']) {
    const config = { ...baseConfig, specialization };
    const profession = revenantProfession.runtimeFor(config);
    const { result, runtime } = observeOccurrence(
      profession,
      config,
      createCombatExecution(profession, ['Impossible Odds', wait(100), 'Relinquish Power'])
    );
    assert.equal(result.complete, true);
    assert.deepEqual(runtime.profession.core.activeUpkeeps, []);
    assert.equal(runtime.time, runtime.rotationEndTime, 'retired upkeep tasks cannot extend observation');
  }
});

test('isolated Conduit preparation registers damaging upkeep work through starvation', () => {
  const config = { ...baseConfig, specialization: 'Conduit', initialEnergy: 8 };
  const profession = revenantProfession.runtimeFor(config);
  const { result, runtime } = observeOccurrence(
    profession,
    config,
    createDamageExecution(profession, {
      skillId: SKILL.IMPOSSIBLE_ODDS,
      inputs: { cosmicWisdom: true },
      accepts: () => true
    })
  );
  assert.equal(result.complete, true);
  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'damage' &&
        event.skillId === SKILL.LESSER_ENCHANTED_DAGGERS &&
        event.at > runtime.rotationEndTime
    ),
    'foreground upkeep work keeps the occurrence open after the activation'
  );
  assert.deepEqual(runtime.profession.core.activeUpkeeps, [], 'starvation retires the measured upkeep');
});

test('background affinity does not extend an occurrence but still accrues in combat', () => {
  const config = {
    ...baseConfig,
    specialization: 'Conduit',
    startingLegend: LEGEND.CENTAUR,
    selectedLegends: [LEGEND.CENTAUR, LEGEND.ENTITY]
  };
  const native = revenantProfession.runtimeFor(config);
  // Remove depletion from this scenario so the only future work belongs to background affinity.
  const profession = { ...native, catalog: withSkill(native.catalog, SKILL.PROTECTIVE_SOLACE, { upkeepCost: 0 }) };
  const preview = observeOccurrence(
    profession,
    config,
    createDamageExecution(profession, { skillId: SKILL.PROTECTIVE_SOLACE, accepts: () => true })
  );
  assert.equal(preview.result.complete, true);
  assert.equal(preview.runtime.time, preview.runtime.rotationEndTime);
  assert.equal(preview.runtime.profession.core.activeUpkeeps.length, 1);

  const combat = runRevenant(['Protective Solace', wait(3100)], config, {
    catalog: () => profession.catalog
  });
  assert.deepEqual(combat.warnings, []);
  assert.ok(affinity(combat) > preview.runtime.profession.specialization.state.affinity.value);
});
