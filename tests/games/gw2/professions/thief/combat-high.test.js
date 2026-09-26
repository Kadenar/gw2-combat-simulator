import assert from 'node:assert/strict';
import test from 'node:test';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { antiquaryModifiers } from '#gw2/professions/thief/specializations/antiquary/modifiers.js';
import { projectThiefPlanningState } from '#gw2/professions/thief/family-state.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const config = { specialization: 'Antiquary', selectedTraitIds: [TRAIT.COMBAT_HIGH] };
// An instant, freely repeatable Swipe places each grant exactly at its authored instant.
const instantSwipe = (catalog) => withSkill(catalog, ID.SKRITT_SWIPE, { castTimeMs: 0, cooldown: 0 });

test('Combat High shares staggered stack expiry across grants, modifiers, projections, and cleanup', () => {
  const result = runThief(['Skritt Swipe'], config, { catalog: instantSwipe });
  assert.deepEqual(result.warnings, []);
  const profession = observedRuntime(result).profession;
  const state = profession.specialization.state;
  const strike = antiquaryModifiers.find((rule) => rule.id === 'thief.combat-high-strike');
  const condition = antiquaryModifiers.find((rule) => rule.id === 'thief.combat-high-condition');
  for (const [time, count] of [
    [0, 10],
    [1.999999, 10],
    [2, 9],
    [18, 1],
    [20, 0]
  ]) {
    const query = { runtime: { profession }, time };
    assert.equal(strike.amount(query, strike.target, strike.parameters), count * 0.03);
    assert.equal(condition.amount(query, condition.target, condition.parameters), count * 0.02);
    assert.equal(projectThiefPlanningState({ profession, time }).combatHighExpirations.length, count);
    assert.equal(state.combatHighExpirations.length, 10, 'projection cannot mutate the runtime buff');
  }

  // A replacement grant must restart decay without retaining old stacks.
  const replaced = observedRuntime(
    runThief(['Skritt Swipe', { type: 'wait', durationMs: 3000 }, 'Skritt Swipe'], config, { catalog: instantSwipe })
  ).profession.specialization.state.combatHighExpirations;
  assert.equal(replaced.length, 10);
  assert.equal(Math.min(...replaced), 5);
  assert.equal(Math.max(...replaced), 23);

  // Profile cap and cadence own the stack windows, including an explicitly disabled cadence.
  for (const interval of [1, 0]) {
    const expirations = observedRuntime(
      runThief(['Skritt Swipe'], config, {
        catalog: (catalog) =>
          withProfile(instantSwipe(catalog), PROFILE.combatHigh, {
            maximumStacks: 3,
            pulseInterval: interval,
            durationMultiplier: 3
          })
      })
    ).profession.specialization.state.combatHighExpirations;
    assert.deepEqual(expirations, interval > 0 ? [3, 2, 1] : []);
  }
});
