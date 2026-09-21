import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';

import { thiefAxeReaction } from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import { triggerSharpeningStone } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { SCOURGE_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { necromancerShadeSkillHandlers } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shades.js';
import { WARRIOR_SKILL_IDS, WARRIOR_TRAIT_IDS } from '#gw2/professions/warrior/data/ids.js';
import { createSpellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { SPELLBREAKER_BALANCE_PROFILE_IDS } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import {
  observeSpellbreakerEvent,
  reactToSpellbreakerControl
} from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';

test('axe materialization replaces the oldest grant without mutating earlier state or snapshots', () => {
  const scheduler = createScheduler({ profession: thiefProfession });
  const core = scheduler.state.profession.core;
  const prior = Object.freeze([1, 30, 31, 32, 33, 34, 35]);
  core.spinningAxeExpirations = prior;
  const snapshot = snapshotProfessionState(scheduler.state.profession);
  const event = { cancelled: false };
  const context = { ...scheduler.context, eventByOrder: () => event };
  thiefAxeReaction.taskHandlers['thief.spinning-axe'](context, { at: 1, payload: { eventOrder: 1 } });
  assert.deepEqual(core.spinningAxeExpirations, [31, 32, 33, 34, 35, 11]);
  assert.deepEqual(snapshot.spinningAxeExpirations, prior);
  const pool = core.spinningAxeExpirations;
  event.cancelled = true;
  thiefAxeReaction.taskHandlers['thief.spinning-axe'](context, { at: 2, payload: { eventOrder: 1 } });
  assert.equal(core.spinningAxeExpirations, pool, 'cancelled source packets cannot grant axes');
});

test('Holo-Dancer commits spend grant order even when the newest charge expires first', () => {
  const scheduler = createScheduler({
    profession: thiefProfession,
    config: { specialization: 'Antiquary', selectedSkills: ['Prepare Pitfall'] }
  });
  const antiquary = scheduler.state.profession.specialization.state;
  const prior = Object.freeze([0, 30, 5]);
  antiquary.holoUtilityCooldownReductionExpirations = prior;
  const snapshot = snapshotProfessionState(scheduler.state.profession);
  const skill = scheduler.context.catalog.skillsByName.get('Prepare Pitfall');
  const recharge = scheduler.context.rechargeDurationFor(skill);
  assert.equal(scheduler.cast({ type: 'cast', skillId: skill.id }), true);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, [5]);
  const action = scheduler.events.findLast((event) => event.type === 'action');
  assert.equal(action.rechargeReadyAt - action.at, recharge * 0.2);
  scheduler.advanceTo(5);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, []);
  assert.deepEqual(snapshot.holoUtilityCooldownReductionExpirations, prior);
  assert.deepEqual(scheduler.warnings, []);
});

test('Sharpening Stone prunes excluded hits and spends the earliest surviving expiry on player strikes', () => {
  const prior = Object.freeze([1, 5, 30]);
  const core = { sharpeningStoneExpirations: prior };
  const queued = [];
  const context = { profession: { core }, queue: { enqueue: (event) => queued.push(event) } };
  const event = { type: 'damage', at: 1, actorType: 'effect', coefficient: 1 };
  triggerSharpeningStone(context, event);
  assert.deepEqual(core.sharpeningStoneExpirations, [5, 30]);
  assert.deepEqual(queued, []);
  triggerSharpeningStone(context, { ...event, actorType: 'player' });
  assert.deepEqual(core.sharpeningStoneExpirations, [30]);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].condition, 'Bleeding');
  assert.deepEqual(prior, [1, 5, 30]);
});

test('Insight keeps newest grants independently in scheduler and resolver state', () => {
  const profile = { maximumStacks: 3, effects: [{ type: 'buff', duration: 4 }] };
  const shared = {
    config: { target: { defiant: true } },
    traits: new Set([WARRIOR_TRAIT_IDS.ATTACKERS_INSIGHT]),
    catalog: { balanceProfilesById: new Map([[SPELLBREAKER_BALANCE_PROFILE_IDS.attackersInsight, profile]]) }
  };
  const schedulerState = createSpellbreakerState();
  const resolverState = createSpellbreakerState();
  const prior = Object.freeze([1, 30, 31, 32]);
  schedulerState.attackerInsightExpiries = prior;
  resolverState.attackerInsightExpiries = prior;
  const scheduler = {
    ...shared,
    state: { profession: { specialization: { kind: 'Spellbreaker', state: schedulerState } } }
  };
  const resolver = {
    ...shared,
    profession: { specialization: { kind: 'Spellbreaker', state: resolverState } }
  };
  const event = { type: 'control', actorType: 'player', at: 1, skillId: WARRIOR_SKILL_IDS.KICK };
  observeSpellbreakerEvent(scheduler, event);
  assert.deepEqual(schedulerState.attackerInsightExpiries, [32, 5, 5]);
  assert.equal(resolverState.attackerInsightExpiries, prior);
  reactToSpellbreakerControl(resolver, event);
  assert.deepEqual(resolverState.attackerInsightExpiries, [32, 5, 5]);
  assert.notEqual(resolverState.attackerInsightExpiries, schedulerState.attackerInsightExpiries);

  // Patched zero-duration grants cannot evict live stacks; zero capacity disables the pool.
  for (const [context, react, state] of [
    [scheduler, observeSpellbreakerEvent, schedulerState],
    [resolver, reactToSpellbreakerControl, resolverState]
  ]) {
    profile.maximumStacks = 3;
    profile.effects[0].duration = 0;
    react(context, { ...event, at: 2 });
    assert.deepEqual(state.attackerInsightExpiries, [32, 5, 5]);
    profile.maximumStacks = 0;
    react(context, { ...event, at: 2 });
    assert.deepEqual(state.attackerInsightExpiries, []);
  }

  assert.deepEqual(prior, [1, 30, 31, 32]);
});

test('Scourge retains latest expiries in ascending snapshots and prunes at completion', () => {
  const scheduler = createScheduler({ profession: necromancerProfession, config: { specialization: 'Scourge' } });
  const state = scheduler.state.profession.specialization.state;
  const prior = Object.freeze([1, 30, 31, 32]);
  state.shades = prior;
  const profile = structuredClone(scheduler.context.catalog.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade));
  const lifetime = profile.effects.find((effect) => effect.type === 'buff');
  profile.maximumStacks = 3;
  lifetime.duration = 4;
  const context = {
    ...scheduler.context,
    catalog: {
      ...scheduler.context.catalog,
      balanceProfilesById: new Map([[SCOURGE_BALANCE_PROFILE_IDS.shade, profile]])
    },
    start: 0,
    fullEnd: 1,
    effectiveEnd: 1
  };
  const skill = scheduler.context.catalog.skillsById.get(NECROMANCER_SKILL_IDS.MANIFEST_SAND_SHADE);
  const cast = () => necromancerShadeSkillHandlers['necromancer.shade'](context, skill);
  cast();
  assert.deepEqual(state.shades, [30, 31, 32], 'a shorter incoming shade loses to the live survivors');
  const snapshot = scheduler.events.findLast((event) => event.type === 'necromancer.state');
  profile.maximumStacks = 4;
  cast();
  assert.deepEqual(state.shades, [5, 30, 31, 32]);
  context.effectiveEnd = 5;
  lifetime.duration = 0;
  cast();
  assert.deepEqual(state.shades, [30, 31, 32], 'expiry is strict at completion, including the incoming grant');
  profile.maximumStacks = 0;
  cast();
  assert.deepEqual(state.shades, []);
  assert.deepEqual(snapshot.state.shades, [30, 31, 32]);
  assert.deepEqual(prior, [1, 30, 31, 32]);
  assert.deepEqual(scheduler.warnings, []);
});
