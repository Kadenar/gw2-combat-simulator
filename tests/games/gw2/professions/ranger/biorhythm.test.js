import assert from 'node:assert/strict';
import test from 'node:test';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { BIORHYTHM, VOW_OF_THE_UNTAMED } from '#gw2/professions/ranger/specializations/untamed/effect-state.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const config = {
  specialization: 'Untamed',
  primaryWeapon: 'Hammer',
  selectedTraitIds: [TRAIT.BIORHYTHM, TRAIT.VOW_OF_THE_UNTAMED]
};
const wait = (durationMs) => ({ type: 'wait', durationMs });
const player = { source: 'ranger', actorType: 'player' };

function simulate(rotation, overrides = {}) {
  const result = runRanger(rotation, { ...config, ...overrides });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  const applications = (kind) =>
    result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === kind).map((event) => event.at);
  return {
    runtime,
    state: untamedState.from(runtime),
    stacks: (at) => runtime.mechanics.combat.activeBuffStacks(BIORHYTHM, at),
    stackApplications: applications(BIORHYTHM),
    vowApplications: applications(VOW_OF_THE_UNTAMED),
    strikeMultiplier: (event, at) => runtime.query.strikeMultiplier(event, at, runtime)
  };
}

// Cycle timing is read from the active profile, so these contracts survive balance changes.
const tuning = (() => {
  const { runtime } = simulate([]);
  const biorhythm = requireBalanceProfileFromContext(runtime, TRAIT.BIORHYTHM);
  const effect = (kind) => biorhythm.effects.find((candidate) => candidate.kind === kind);
  const stack = effect(BIORHYTHM);
  const intervalMs = stack.intervalMs;
  const fillMs = intervalMs * (biorhythm.stackThreshold - 1);
  return {
    threshold: biorhythm.stackThreshold,
    intervalMs,
    fillMs,
    stackDuration: stack.duration,
    // Every stack from one cycle has expired once the last application's full duration elapses.
    decayMs: intervalMs * (stack.applications - 1) + stack.duration * 1000,
    vowDuration: effect(VOW_OF_THE_UNTAMED).duration,
    vowBonus: requireBalanceProfileFromContext(runtime, TRAIT.VOW_OF_THE_UNTAMED).damageIncrease
  };
})();

test('reaching the threshold arms Vow, and the reward outlives independently expiring stacks', () => {
  const { state, stacks, stackApplications } = simulate([ID.UNLEASH_RANGER, wait(tuning.decayMs)]);
  const [first] = stackApplications;
  const filledAt = first + tuning.fillMs / 1000;
  assert.equal(stacks(filledAt - tuning.intervalMs / 1000 / 2), tuning.threshold - 1);
  assert.equal(stacks(filledAt), tuning.threshold);
  // Later applications do not refresh earlier ones, so the first stack leaves alone.
  assert.equal(stacks(first + tuning.stackDuration), stackApplications.length - 1);
  assert.equal(stacks(first + tuning.decayMs / 1000), 0);
  assert.equal(state.biorhythmArmed, true);
});

test('an early unleash cancels pending stacks, removes live ones, and restarts without Vow', () => {
  const earlyMs = tuning.fillMs / 2;
  const early = simulate([ID.UNLEASH_RANGER, wait(earlyMs), ID.UNLEASH_PET, wait(earlyMs)]);
  const restartAt = early.stackApplications[0] + earlyMs / 1000;
  const restartedStacks = 1 + earlyMs / tuning.intervalMs;
  // Only the new cycle lands after the restart, because the old cycle's pending stacks were cancelled.
  assert.equal(early.stackApplications.filter((at) => at > restartAt).length, restartedStacks - 1);
  assert.equal(early.stacks(restartAt), 1);
  assert.equal(early.stacks(restartAt + earlyMs / 1000), restartedStacks);
  assert.equal(early.state.biorhythmArmed, false);
  assert.deepEqual(early.vowApplications, []);

  const restarted = simulate([ID.UNLEASH_RANGER, wait(earlyMs), ID.UNLEASH_PET, wait(tuning.fillMs)]);
  assert.equal(restarted.state.biorhythmArmed, true);
  assert.deepEqual(restarted.vowApplications, []);
});

test('either unleash spends an armed Vow, even after every Biorhythm stack expires', () => {
  for (const initialUntamedState of ['Pet', 'Ranger']) {
    const first = initialUntamedState === 'Pet' ? ID.UNLEASH_RANGER : ID.UNLEASH_PET;
    const second = initialUntamedState === 'Pet' ? ID.UNLEASH_PET : ID.UNLEASH_RANGER;
    for (const durationMs of [tuning.fillMs, tuning.decayMs]) {
      const { state, stacks, stackApplications, vowApplications } = simulate([first, wait(durationMs), second], {
        initialUntamedState
      });
      const restartAt = stackApplications.at(-1);
      assert.deepEqual(vowApplications, [restartAt], `${initialUntamedState} ${durationMs}ms`);
      assert.equal(stacks(restartAt), 1);
      assert.equal(state.biorhythmArmed, false);
    }
  }
});

// Vow is one player modifier in either state: the effect never doubles the unleashed bonus or reaches pet strikes.
test('the Vow effect grants the Vow bonus once in either unleash state and never to pets', () => {
  const expected = 1 + tuning.vowBonus;
  const petState = simulate([ID.UNLEASH_RANGER, wait(tuning.fillMs), ID.UNLEASH_PET]);
  const [vowAt] = petState.vowApplications;
  const vowEndsAt = vowAt + tuning.vowDuration;
  const pet = {
    source: 'ranger-pet',
    actorType: 'summon',
    summonOwner: petState.runtime.profession.core.pet.id,
    independentSummonStrike: true,
    summonUsesProfessionModifiers: true
  };
  assert.equal(petState.strikeMultiplier(player, vowAt), expected);
  assert.equal(petState.strikeMultiplier(player, vowEndsAt - 0.001), expected);
  assert.equal(petState.strikeMultiplier(player, vowEndsAt), 1);
  assert.equal(petState.strikeMultiplier(pet, vowAt), 1);

  const rangerState = simulate([ID.UNLEASH_PET, wait(tuning.fillMs), ID.UNLEASH_RANGER], {
    initialUntamedState: 'Ranger'
  });
  const [rangerVowAt] = rangerState.vowApplications;
  assert.equal(rangerState.state.rangerUnleashed, true);
  assert.equal(rangerState.strikeMultiplier(player, rangerVowAt), expected);
});

test('initial unleash selection and unselected Biorhythm create no stacks or Vow', () => {
  for (const initialUntamedState of ['Pet', 'Ranger']) {
    const { stackApplications, state } = simulate([wait(tuning.decayMs)], { initialUntamedState });
    assert.deepEqual(stackApplications, []);
    assert.equal(state.biorhythmArmed, false);
  }

  const unselected = simulate([ID.UNLEASH_RANGER, wait(tuning.fillMs), ID.UNLEASH_PET], {
    selectedTraitIds: [TRAIT.VOW_OF_THE_UNTAMED]
  });
  assert.deepEqual(unselected.stackApplications, []);
  assert.deepEqual(unselected.vowApplications, []);
  assert.equal(unselected.strikeMultiplier(player, unselected.runtime.time), 1);
});
