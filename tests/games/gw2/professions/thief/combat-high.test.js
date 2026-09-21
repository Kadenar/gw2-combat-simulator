import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { pilferArtifacts } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { antiquaryModifierRules } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifact-rules.js';
import { advanceAntiquaryResources } from '#gw2/professions/thief/specializations/antiquary/mechanics/resources.js';
import { projectThiefPlanningState } from '#gw2/professions/thief/family-state.js';
import { ANTIQUARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/antiquary/profiles.js';

test('Combat High shares staggered stack expiry across grants, modifiers, projections, and cleanup', () => {
  const config = { specialization: 'Antiquary', selectedTraitIds: [TRAIT.COMBAT_HIGH] };
  const runtime = thiefProfession.resolveRuntime(config);
  const profession = runtime.createProfessionState(config);
  const state = profession.specialization.state;
  const events = [];
  const context = {
    config,
    catalog: runtime.catalog,
    state: { profession, time: 0 },
    events,
    emit: (event) => {
      events.push(event);
      return event;
    }
  };
  // A replacement grant must restart decay without retaining old stacks.
  pilferArtifacts(context, 0, 'test', 'swipe');
  const strike = antiquaryModifierRules.find((rule) => rule.id === 'thief.combat-high-strike');
  const condition = antiquaryModifierRules.find((rule) => rule.id === 'thief.combat-high-condition');
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
    context.state.time = time;
    assert.equal(projectThiefPlanningState({ schedulerState: context.state }).combatHighExpirations.length, count);
    assert.equal(state.combatHighExpirations.length, 10, 'projection cannot mutate the runtime buff');
  }

  advanceAntiquaryResources(context, 2);
  assert.equal(state.combatHighExpirations.length, 9);
  pilferArtifacts(context, 3, 'test', 'swipe');
  assert.equal(state.combatHighExpirations.length, 10);
  assert.equal(Math.min(...state.combatHighExpirations), 5);
  assert.equal(Math.max(...state.combatHighExpirations), 23);

  // Profile cap and cadence own the stack windows, including an explicitly disabled cadence.
  for (const interval of [1, 0]) {
    const profiles = new Map(runtime.catalog.balanceProfilesById);
    profiles.set(PROFILE.combatHigh, {
      ...profiles.get(PROFILE.combatHigh),
      maximumStacks: 3,
      pulseInterval: interval,
      durationMultiplier: 3
    });
    context.catalog = { ...runtime.catalog, balanceProfilesById: profiles };
    pilferArtifacts(context, 30, 'test', 'swipe');
    assert.deepEqual(state.combatHighExpirations, interval > 0 ? [33, 32, 31] : []);
  }
});
