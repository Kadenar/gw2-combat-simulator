import { troubadourHooks } from '#gw2/professions/mesmer/specializations/troubadour/hooks.js';
import { createRuntimeEndurance } from '#gw2/platform/combat/resources/runtime-resources.js';
import { registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { projectMesmerPlanningState } from '#gw2/professions/mesmer/family-state.js';
import { initializeTroubadourRuntime } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/runtime.js';
import { completeTroubadourPerformance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import {
  applyTroubadourAttributes,
  troubadourModifierRules
} from '#gw2/professions/mesmer/specializations/troubadour/modifiers.js';
import { troubadourEndurance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/endurance.js';
import { resolveTroubadourTale } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/tales.js';
import { troubadourUi } from '#gw2/professions/mesmer/specializations/troubadour/presentation.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';

// Keep real profiles and instrument handlers while isolating windows from cast speed, random damage, and cooldowns.
function instrumentContext() {
  const config = { specialization: 'Troubadour', selectedTraitIds: [TRAIT.FORTISSIMO] };
  const profession = mesmerProfession.resolveProfession(config);
  const events = [];
  const state = {
    time: 0,
    activeWeaponSet: 1,
    profession: profession.createState(config),
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
    cooldownController: { ensureAmmo: () => null },
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
  Object.assign(context, state);
  context.helpers = context.catalog;
  context.history = events;
  context.schedule = () => {};

  context.endurance = createRuntimeEndurance(context, { endurance: troubadourEndurance });
  registerMesmerMechanics(context, context.mesmerRuntime);
  context.mesmerRuntime.context = context;
  initializeTroubadourRuntime(context);
  return context;
}

function play(context, id, at, notes = 0) {
  context.fullEnd = context.effectiveEnd = at;
  context.profession.specialization.state.numericResource = notes;
  const skill = context.catalog.skillsById.get(id);
  context.time = at;
  completeTroubadourPerformance(
    context,
    { skill, start: at, fullEnd: at, effectiveEnd: at, id: 'fixture', command: {} },
    skill
  );
}

function modifierContext(context, time, event) {
  return { config: context.config, helpers: context.helpers, events: [...context.events], time, event };
}

test('instrument commitment, damage bonuses, cleanup, and UI share exact exclusive deadlines', () => {
  for (const at of [5.300999, 5.301, 5.301001]) {
    const context = instrumentContext();
    play(context, ID.LIVELY_LUTE, 0.1 + 0.201);
    const state = context.profession.specialization.state;
    assert.equal(state.instruments.Lute, 5.301);
    assert.equal(context.events.find((event) => event.type === 'mesmer.instrument').expiresAt, 5.301);
    context.time = at;
    const active = at < 5.301;
    const projected = projectMesmerPlanningState({
      ...context,
      config: context.config,
      catalog: context.catalog
    });
    assert.equal(projected.activeInstruments.length, Number(active));
    const view = troubadourUi
      .resourceViews({
        catalog: context.catalog,
        professionState: projected,
        resources: { endurance: { maximum: 100 } }
      })
      .find((item) => item.id === 'playing-instruments');
    assert.equal(Boolean(view), active);
    const query = modifierContext(context, at);
    assert.equal(troubadourModifierRules.find((rule) => rule.id === 'mesmer.lute').when(query), active);
    assert.equal(applyTroubadourAttributes(query, { power: 100 }).power, active ? 104 : 100);
    context.time = at;
    if (at >= 5.301)
      troubadourHooks.tasks['mesmer.instrument-expire'](context, { instrument: 'Lute', expiresAt: 5.301 });
    assert.equal(Object.hasOwn(state.instruments, 'Lute'), active);
  }
});

test('shorter instrument replays replace their own window without reviving old bonuses or expiring other instruments', () => {
  const context = instrumentContext();
  play(context, ID.LIVELY_LUTE, 0.301, 3);
  play(context, ID.FLUSTERING_FLUTE, 1.301, 3);
  play(context, ID.LIVELY_LUTE, 2.301);
  const state = context.profession.specialization.state;
  assert.deepEqual(state.instruments, { Lute: 7.301, Flute: 21.301 });
  const query = modifierContext(context, 7.301);
  assert.equal(troubadourModifierRules.find((rule) => rule.id === 'mesmer.lute').when(query), false);
  assert.equal(applyTroubadourAttributes(query, { power: 100 }).power, 104);
  context.time = 7.301;
  troubadourHooks.tasks['mesmer.instrument-expire'](context, { instrument: 'Lute', expiresAt: 7.301 });
  assert.deepEqual(state.instruments, { Flute: 21.301 });
  context.start = 7.301;
  const skill = { ...context.catalog.skillsById.get(ID.CRESCENDO), damageAtMs: 0 };
  troubadourHooks.tasks['mesmer.crescendo'](context, {
    skill,
    start: 7.301,
    fullEnd: 7.301,
    effectiveEnd: 7.301,
    command: {},
    id: 'crescendo'
  });
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
    context.time = 6;
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

test('Flute endurance regeneration uses the final live microsecond and loses the bonus at expiry', () => {
  const context = instrumentContext();
  play(context, ID.FLUSTERING_FLUTE, 0.301);
  for (const at of [5.300999, 5.301, 5.301001]) {
    context.time = at;
    context.time = at;
    if (at >= 5.301)
      troubadourHooks.tasks['mesmer.instrument-expire'](context, { instrument: 'Lute', expiresAt: 5.301 });
    assert.equal(troubadourEndurance.regenerationRate(context, false, at), at < 5.301 ? 6.25 : 5);
  }
});

// Forecasting and advancement must split both Vigor and replaced Flute windows, even across an otherwise idle wait.
test('Troubadour endurance integrates Flute replacement and Vigor boundaries without losing partial recovery', () => {
  const context = instrumentContext();
  const state = context.profession.specialization.state;
  state.endurance = 0;
  play(context, ID.FLUSTERING_FLUTE, 1, 3);
  play(context, ID.FLUSTERING_FLUTE, 2);
  const vigor = { type: 'buff', kind: 'vigor', at: 3, duration: 2, stacks: 1, audience: { recipients: 'self' } };
  context.events.push({ ...vigor, resolvedAudience: gw2BoonApplicationRecipients({}, vigor) });
  // 0-1: 5; 1-3: 12.5; 3-5: 17.5; 5-7: 12.5. The remaining 2.5 takes 0.5s at the base rate.
  assert.equal(((context.time = 0), context.endurance.readyAt(50)), 7.52);
  assert.equal(state.endurance, 0, 'Readiness must not mutate the pool');
  context.time = 7;
  context.endurance.advance();
  assert.equal(state.endurance, 47.5);
  context.time = 8;
  context.endurance.advance();
  assert.equal(state.endurance, 52.5);
  assert.equal(state.enduranceUpdatedAt, 8);
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
  const result = runMesmer({
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
