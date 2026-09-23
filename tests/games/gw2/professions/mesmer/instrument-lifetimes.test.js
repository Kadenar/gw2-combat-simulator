import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { projectMesmerPlanningState } from '#gw2/professions/mesmer/family-state.js';
import { initializeTroubadourRuntime } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/runtime.js';
import {
  completeTroubadourPerformance,
  scheduleTroubadourPerformance
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import {
  applyTroubadourAttributes,
  troubadourCastRules,
  troubadourModifierRules,
  troubadourSchedulerHooks
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.js';
import { resolveTroubadourTale } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import { troubadourUi } from '#gw2/professions/mesmer/specializations/troubadour/presentation.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Keep real profiles and instrument handlers while isolating windows from cast speed, random damage, and cooldowns.
function instrumentContext() {
  const config = { specialization: 'Troubadour', selectedTraitIds: [TRAIT.FORTISSIMO] };
  const profession = mesmerProfession.resolveRuntime(config);
  const events = [];
  const state = {
    time: 0,
    activeWeaponSet: 1,
    profession: profession.createProfessionState(config),
    cooldowns: new Map()
  };
  const emit = (event) => {
    const result = { ...event, eventOrder: events.length };
    events.push(result);
    return result;
  };

  const context = {
    config,
    profession,
    state,
    events,
    catalog: profession.catalog,
    action: {},
    start: 0,
    fullEnd: 0,
    effectiveEnd: 0,
    maximumAmmoFor: () => 0,
    cooldownController: {},
    eventsOfType: (type) => events.filter((event) => event.type === type),
    mesmerRuntime: {
      traits: new Set(),
      instruments: {},
      skillsById: profession.catalog.skillsById,
      balanceProfile: (id) => profession.catalog.balanceProfilesById.get(id),
      addEvent: emit,
      addTraitProc() {},
      activePrimaryWeapon: () => 'Spear',
      resourceDefinition: { singular: 'note', plural: 'notes', maximum: 3 },
      actions: {
        consumeResources: () => {
          const spent = state.profession.specialization.state.numericResource;
          state.profession.specialization.state.numericResource = 0;
          return spent;
        }
      },
      resources: { queueResources: (at, amount) => emit({ type: 'resource', at, amount }) },
      addDamage: (skill, at, damage) => emit({ type: 'damage', at, skillId: skill.id, ...damage })
    }
  };
  context.mesmerRuntime.context = context;
  initializeTroubadourRuntime(context);
  return context;
}

function play(context, id, at, notes = 0) {
  context.fullEnd = context.effectiveEnd = at;
  context.state.profession.specialization.state.numericResource = notes;
  completeTroubadourPerformance(context, context.catalog.skillsById.get(id));
}

function modifierContext(context, time, event) {
  return { config: context.config, profession: context.profession, events: [...context.events], time, event };
}

test('instrument commitment, damage bonuses, cleanup, and UI share exact exclusive deadlines', () => {
  for (const at of [5.300999, 5.301, 5.301001]) {
    const context = instrumentContext();
    play(context, ID.LIVELY_LUTE, 0.1 + 0.201);
    const state = context.state.profession.specialization.state;
    assert.equal(state.instruments.Lute, 5.301);
    assert.equal(context.events.find((event) => event.type === 'mesmer.instrument').expiresAt, 5.301);
    context.state.time = at;
    const active = at < 5.301;
    const projected = projectMesmerPlanningState({ schedulerContext: context });
    assert.equal(projected.activeInstruments.length, Number(active));
    const view = troubadourUi
      .resourceViews({ catalog: context.catalog, professionState: projected })
      .find((item) => item.id === 'playing-instruments');
    assert.equal(Boolean(view), active);
    const query = modifierContext(context, at);
    assert.equal(troubadourModifierRules.find((rule) => rule.id === 'mesmer.lute').when(query), active);
    assert.equal(applyTroubadourAttributes(query, { power: 100 }).power, active ? 104 : 100);
    troubadourSchedulerHooks.advance.handler(context, at);
    assert.equal(Object.hasOwn(state.instruments, 'Lute'), active);
  }
});

test('shorter instrument replays replace their own window without reviving old bonuses or expiring other instruments', () => {
  const context = instrumentContext();
  play(context, ID.LIVELY_LUTE, 0.301, 3);
  play(context, ID.FLUSTERING_FLUTE, 1.301, 3);
  play(context, ID.LIVELY_LUTE, 2.301);
  const state = context.state.profession.specialization.state;
  assert.deepEqual(state.instruments, { Lute: 7.301, Flute: 21.301 });
  const query = modifierContext(context, 7.301);
  assert.equal(troubadourModifierRules.find((rule) => rule.id === 'mesmer.lute').when(query), false);
  assert.equal(applyTroubadourAttributes(query, { power: 100 }).power, 104);
  troubadourSchedulerHooks.advance.handler(context, 7.301);
  assert.deepEqual(state.instruments, { Flute: 21.301 });
  context.start = 7.301;
  scheduleTroubadourPerformance(context, { ...context.catalog.skillsById.get(ID.CRESCENDO), damageAtMs: 0 });
  assert.equal(context.events.find((event) => event.skillId === ID.CRESCENDO).coefficient, 2.25 * 1.25);
});

test('instrument damage queries respect commitment order at the same timestamp', () => {
  const context = instrumentContext();
  play(context, ID.LIVELY_LUTE, 0.301);
  const instrument = context.events.find((event) => event.type === 'mesmer.instrument');
  const rule = troubadourModifierRules.find((entry) => entry.id === 'mesmer.lute');
  assert.equal(rule.when(modifierContext(context, 0.301, { eventOrder: instrument.eventOrder - 1 })), false);
  assert.equal(rule.when(modifierContext(context, 0.301, { eventOrder: instrument.eventOrder + 1 })), true);
});

test('Tales retain cast-start note eligibility after instrument expiry and reject instruments started later', () => {
  for (const start of [5.300999, 5.301, 5.301001]) {
    const context = instrumentContext();
    play(context, ID.FLUSTERING_FLUTE, 0.301);
    troubadourSchedulerHooks.advance.handler(context, 6);
    // A later performance must not change whether this already-started Tale earned its note.
    play(context, ID.FLUSTERING_FLUTE, 5.8);
    resolveTroubadourTale({
      context,
      skill: context.catalog.skillsById.get(ID.TALE_OF_THE_TORTURED_MASTERMIND),
      castStart: start,
      at: 6
    });
    assert.equal(context.events.filter((event) => event.type === 'resource').length, start < 5.301 ? 1 : 0);
  }
});

test('a same-time instrument committed after a Tale starts cannot grant that Tale a note', () => {
  const context = instrumentContext();
  context.mesmerRuntime.addEvent({ type: 'action', at: 0.301, activationId: 'tale' });
  play(context, ID.FLUSTERING_FLUTE, 0.301);
  resolveTroubadourTale({
    context,
    skill: context.catalog.skillsById.get(ID.TALE_OF_THE_TORTURED_MASTERMIND),
    castStart: 0.301,
    at: 1,
    activationId: 'tale'
  });
  assert.equal(
    context.events.some((event) => event.type === 'resource'),
    false
  );
});

test('Flute dodge recharge uses the final live microsecond and loses the bonus at expiry', () => {
  const context = instrumentContext();
  play(context, ID.FLUSTERING_FLUTE, 0.301);
  const skill = context.catalog.skillsById.get(ID.DODGE_TROUBADOUR);
  for (const at of [5.300999, 5.301, 5.301001]) {
    context.state.time = at;
    troubadourSchedulerHooks.advance.handler(context, at);
    assert.equal(
      troubadourCastRules.modifyRechargeDuration({ ...context, skill }, skill.cooldown),
      at < 5.301 ? 8 : 10
    );
  }
});

test('delayed performance packets survive instrument expiry without retaining its playing bonus', () => {
  const profession = withPatchPreview(mesmerProfession, {
    id: 'short-instrument',
    label: 'Short instrument window',
    professions: {
      mesmer: {
        balanceProfiles: { [PROFILE.instruments]: { fields: { durationMultiplier: 0.1, durationPerTier: 0 } } }
      }
    }
  });
  const result = simulateGw2({
    profession,
    config: {
      patchId: 'short-instrument',
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.CALL_AND_RESPONSE]
    },
    rotation: [ID.LIVELY_LUTE, { type: 'wait', durationMs: 3000 }]
  });
  assert.deepEqual(result.warnings, []);
  const instrument = result.events.find((event) => event.type === 'mesmer.instrument');
  const delayed = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.source === 'Afterimage' && event.at > instrument.expiresAt
  );
  assert.ok(delayed?.damage > 0);
  assert.equal(result.planningState.profession.activeInstruments.length, 0);
  assert.equal(
    troubadourModifierRules.find((rule) => rule.id === 'mesmer.lute').when({ events: result.events, time: delayed.at }),
    false
  );
});
