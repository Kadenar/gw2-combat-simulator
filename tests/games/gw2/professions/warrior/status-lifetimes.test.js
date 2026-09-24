import assert from 'node:assert/strict';
import test from 'node:test';
import { boonApplicationsAt, normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import { gw2BuffApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  advanceBladesworn,
  bladeswornSkillMechanicHandlers,
  enterDragonTrigger
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger.js';
import { applyGunsaberEntryTraits } from '#gw2/professions/warrior/specializations/bladesworn/traits/index.js';
import {
  handleKingOfFiresDetonationTask,
  kingOfFiresReaction,
  observeBerserkerEvent
} from '#gw2/professions/warrior/specializations/berserker/traits/index.js';

// Real profiles and buff preparation isolate lifetime rules from rotations, cooldowns, and random critical rolls.
function contextFor(specialization, selectedTraitIds = []) {
  const config = { specialization, selectedTraitIds };
  const profession = warriorProfession.resolveRuntime(config);
  const events = [];
  const emit = (event) => {
    const prepared =
      event.type === 'buff'
        ? normalizeBoonDuration({
            ...event,
            resolvedAudience: gw2BuffApplicationRecipients(config, event)
          })
        : event;
    events.push(prepared);
    return prepared;
  };

  return {
    config,
    profession,
    catalog: profession.catalog,
    events,
    state: { profession: profession.createProfessionState(config), time: 0, ammo: new Map(), cooldowns: new Map() },
    skill: profession.catalog.skillsById.get(ID.UNSHEATHE_GUNSABER),
    emit,
    emitDerived: (_cause, event) => emit(event),
    eventByOrder: (order) => events.find((event) => event.eventOrder === order),
    schedulerPolicy: { critical: () => ({ chance: 1 }) },
    tasks: { schedule() {} }
  };
}

test('Tactical Reload uses its displayed deadline and is consumed once through the exact expiry instant', () => {
  for (const at of [10.039999, 10.04, 10.040001]) {
    const context = contextFor('Bladesworn');
    const state = context.state.profession.specialization.state;
    bladeswornSkillMechanicHandlers['warrior.bladesworn.tactical-reload']({
      context,
      skill: context.catalog.skillsById.get(ID.TACTICAL_RELOAD),
      at: 0.001
    });
    const [buff] = boonApplicationsAt(context.events, 'tactical-reload', 0.001);
    assert.equal(state.tacticalReloadUntil, 10.04);
    assert.equal(state.tacticalReloadUntil, buff.expiresAt);
    state.gunsaberActive = true;
    state.flowUpdatedAt = at;
    context.effectiveEnd = at;
    enterDragonTrigger(context, context.catalog.skillsById.get(ID.DRAGON_TRIGGER));
    assert.equal(state.dragonChargesPerInterval, at <= 10.04 ? 2 : 1);
    enterDragonTrigger(context, context.catalog.skillsById.get(ID.DRAGON_TRIGGER));
    assert.equal(state.dragonChargesPerInterval, 1, 'a consumed reload cannot affect a second entry');
  }
});

test('Positive Flow integrates trait and Flow Stabilizer bonuses through their displayed lifetimes', () => {
  for (const source of ['trait', 'stabilizer']) {
    const context = contextFor('Bladesworn', [TRAIT.RIVERS_FLOW]);
    const state = context.state.profession.specialization.state;
    state.flowUpdatedAt = 0.001;
    if (source === 'trait') applyGunsaberEntryTraits(context, 0.001);
    else
      bladeswornSkillMechanicHandlers['warrior.bladesworn.flow-stabilizer']({
        context,
        skill: context.catalog.skillsById.get(ID.FLOW_STABILIZER),
        at: 0.001,
        castStart: 0.001,
        activationId: 'stabilizer'
      });
    const until = source === 'trait' ? state.traitPositiveFlowUntil : state.flowStabilizerWindows[0].expiresAt;
    assert.equal(until, source === 'trait' ? 5.04 : 8.04);
    if (source === 'trait') {
      assert.equal(boonApplicationsAt(context.events, 'positive-flow', 0.001)[0].expiresAt, until);
    }

    advanceBladesworn(context, until);
    // Both sources grant two Positive Flow stacks: 4 Flow/s plus 2 base, credited on whole 40 ms ticks.
    assert.ok(Math.abs(state.flow - until * 6) < 1e-9);
    const atExpiry = state.flow;
    advanceBladesworn(context, until + 0.001);
    assert.equal(state.flow, atExpiry, 'Flow waits for the next regeneration tick');
    advanceBladesworn(context, until + 0.04);
    assert.ok(Math.abs(state.flow - atExpiry - 0.08) < 1e-9, 'only base Flow remains after expiry');
  }

  // The declarative Flow Stabilizer buff and its procedural state must agree on off-grid applications too.
  const result = simulateGw2({
    profession: warriorProfession,
    config: { specialization: 'Bladesworn' },
    rotation: [{ type: 'wait', durationMs: 1 }, ID.FLOW_STABILIZER]
  });
  assert.deepEqual(result.warnings, []);
  const [buff] = boonApplicationsAt(result.events, 'positive-flow', 0.001);
  assert.equal(result.planningState.profession.flowStabilizerWindows[0].expiresAt, buff.expiresAt);
});

test('Positive Flow refresh preserves a live interval but reopens at its exclusive endpoint', () => {
  for (const at of [5.039999, 5.04, 5.040001]) {
    const context = contextFor('Bladesworn', [TRAIT.RIVERS_FLOW]);
    const state = context.state.profession.specialization.state;
    applyGunsaberEntryTraits(context, 0.001);
    applyGunsaberEntryTraits(context, at);
    assert.equal(state.traitPositiveFlowStartedAt, at < 5.04 ? 0.001 : at);
    const applications = boonApplicationsAt(context.events, 'positive-flow', at);
    assert.equal(state.traitPositiveFlowUntil, applications.at(-1).expiresAt);
  }
});

test('trait and combo fire auras share rounded deadlines and detonate only before expiry', () => {
  for (const source of ['trait', 'combo']) {
    for (const at of [5.039999, 5.04, 5.040001]) {
      const context = contextFor('Berserker', [TRAIT.KING_OF_FIRES]);
      const state = context.state.profession.specialization.state;
      if (source === 'trait') {
        context.events.push({ type: 'damage', at: 0.001, eventOrder: 1, didCrit: true });
        kingOfFiresReaction.taskHandlers['warrior.king-of-fires-hit'](context, {
          at: 0.001,
          payload: { eventOrder: 1 }
        });
        assert.equal(boonApplicationsAt(context.events, 'fire-aura', 0.001)[0].expiresAt, state.fireAuraUntil);
      } else observeBerserkerEvent(context, { type: 'aura', aura: 'Fire Aura', at: 0.001, duration: 5 });
      assert.equal(state.fireAuraUntil, 5.04);
      const task = { at, payload: { skillId: ID.HEAD_BUTT } };
      handleKingOfFiresDetonationTask(context, task);
      handleKingOfFiresDetonationTask(context, task);
      assert.equal(
        context.events.filter((event) => event.type === 'proc' && event.name === 'King of Fires').length,
        at < 5.04 ? 1 : 0
      );
    }
  }
});

test('a shorter combo fire aura does not truncate an existing aura window', () => {
  const context = contextFor('Berserker');
  observeBerserkerEvent(context, { type: 'aura', aura: 'Fire Aura', at: 0.001, duration: 5 });
  observeBerserkerEvent(context, { type: 'aura', aura: 'Fire Aura', at: 1.001, duration: 1 });
  assert.equal(context.state.profession.specialization.state.fireAuraUntil, 5.04);
});
