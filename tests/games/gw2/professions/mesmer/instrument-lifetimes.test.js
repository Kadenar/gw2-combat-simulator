import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-mechanics.js';
import { createExecutedFacts } from '#gw2/platform/combat/history/executed-facts.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createRuntimeEndurance, createRuntimeResources } from '#gw2/platform/simulation/runtime-resources.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { troubadourHooks } from '#gw2/professions/mesmer/specializations/troubadour/hooks.js';
import { troubadourEndurance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/endurance.js';
import { completeTroubadourPerformance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { troubadourModifierRules } from '#gw2/professions/mesmer/specializations/troubadour/modifiers.js';
import { troubadourUi } from '#gw2/professions/mesmer/specializations/troubadour/presentation.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import { applyTroubadourAttributes } from '#gw2/professions/mesmer/specializations/troubadour/traits/performance.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Keep real profiles and instrument handlers while isolating windows from cast speed, random damage, and cooldowns.
function instrumentContext() {
  const config = { specialization: 'Troubadour', selectedTraitIds: [TRAIT.FORTISSIMO] };
  const profession = mesmerProfession.resolveProfession(config);
  const events = [];
  const state = {
    time: 0,
    activeWeaponSet: 1,
    profession: profession.createState(config)
  };
  const emit = (event) => {
    const result = { ...event, eventOrder: events.length };
    events.push(result);
    return result;
  };

  const context = {
    config,
    combat: { warn() {} },
    traits: new Set(config.selectedTraitIds),
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
    eventsOfType: (type) => events.filter((event) => event.type === type)
  };
  Object.assign(context, state);
  context.helpers = context.catalog;
  context.effects = captureEffectEmissions({ now: () => context.time, submit: emit }).effects;
  const facts = createExecutedFacts(events);
  context.facts = facts.reader;
  context.observations = facts.writer;
  context.history = events;
  // Execute immediate resource tasks through their real owner while leaving unrelated scheduled work isolated.
  context.schedule = (type, at, data) => {
    if (type === 'mesmer.resource-gain')
      createMesmerIllusionRewards(context).gainResources(at, data.count, data.weapon, data.reason, data.cause);
  };

  // Endurance receives its engine clock and the explicit policy capability.
  context.endurance = createRuntimeEndurance(
    {
      get time() {
        return context.time;
      },
      config,
      history: events,
      mechanics: context
    },
    { endurance: troubadourEndurance }
  );
  // Numeric transactions use the same initialized clock policy as the engine.
  context.resourceController = createRuntimeResources(
    {
      get time() {
        return context.time;
      },
      mechanics: context
    },
    { resources: troubadourHooks.resources }
  );
  context.resourceController.initialize();
  return context;
}

function play(context, id, at, notes = 0) {
  context.fullEnd = context.effectiveEnd = at;
  const skill = context.catalog.skillsById.get(id);
  context.time = at;
  context.resourceController.replace('notes', notes);
  completeTroubadourPerformance(
    context,
    { skill, start: at, fullEnd: at, effectiveEnd: at, id: 'fixture', command: {} },
    skill
  );
}

function modifierContext(context, time, event) {
  return { config: context.config, helpers: context.helpers, events: [...context.events], time, event };
}

test('instrument commitment, damage bonuses, projection, and UI share exact exclusive deadlines', () => {
  for (const at of [5.300999, 5.301, 5.301001]) {
    const context = instrumentContext();
    play(context, ID.LIVELY_LUTE, 0.1 + 0.201);
    const state = context.profession.specialization.state;
    assert.equal(state.instruments.Lute, 5.301);
    assert.equal(context.events.find((event) => event.type === 'mesmer.instrument').expiresAt, 5.301);
    context.time = at;
    const active = at < 5.301;
    const projected = projectObservedState(mesmerProfession, {
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
    assert.equal(state.instruments.Lute, 5.301, 'Projection does not mutate the stored deadline');
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
  assert.deepEqual(
    projectObservedState(mesmerProfession, context).activeInstruments.map(({ name }) => name),
    ['Flute']
  );
  context.start = 7.301;
  const skill = { ...context.catalog.skillsById.get(ID.CRESCENDO), damageAtMs: 0 };
  troubadourHooks.tasks['mesmer.crescendo'](context, {
    cast: {
      skill,
      start: 7.301,
      fullEnd: 7.301,
      effectiveEnd: 7.301,
      command: {},
      id: 'crescendo'
    }
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

// Exercise acceptance and commitment separately so expiry/replacement cannot rewrite a Tale's eligibility.
function beginTale(context, at) {
  const skill = context.catalog.skillsById.get(ID.TALE_OF_THE_TORTURED_MASTERMIND);
  const cast = { id: 'tale', skill, start: at, command: {} };
  context.time = at;
  context.effects.emit({
    kind: 'packet',
    event: { type: 'action', at, activationId: cast.id, actorType: 'player', source: 'Player', sourceId: cast.skill.id }
  });
  context.profession.core.castDetails.set(cast.id, {});
  applySkillSideEffects(context, cast, 'castStart', troubadourHooks.sideEffectHandlers);
  return cast;
}

test('Tales retain cast-start note eligibility after instrument expiry and reject instruments started later', () => {
  for (const start of [5.300999, 5.301, 5.301001]) {
    const context = instrumentContext();
    play(context, ID.FLUSTERING_FLUTE, 0.301);
    const cast = beginTale(context, start);
    play(context, ID.FLUSTERING_FLUTE, 5.8);
    context.time = 6;
    applySkillSideEffects(context, cast, 'castCommit', troubadourHooks.sideEffectHandlers);
    assert.equal(
      context.events.filter((event) => event.type === 'resource' && event.amount > 0).length,
      start < 5.301 ? 1 : 0
    );
  }
});

test('a same-time instrument committed after a Tale starts cannot grant that Tale a note', () => {
  const context = instrumentContext();
  const cast = beginTale(context, 0.301);
  play(context, ID.FLUSTERING_FLUTE, 0.301);
  context.time = 1;
  applySkillSideEffects(context, cast, 'castCommit', troubadourHooks.sideEffectHandlers);
  assert.equal(
    context.events.some((event) => event.type === 'resource' && event.amount > 0),
    false
  );
});

test('Tale rewards commit before recovery and are available to the next instrument', () => {
  const context = instrumentContext();
  play(context, ID.LIVELY_LUTE, 0);
  const cast = {
    id: 'soulkeeper',
    skill: context.catalog.skillsById.get(ID.TALE_OF_THE_SOULKEEPER),
    start: 1,
    fullEnd: 3,
    effectiveEnd: 2,
    command: {}
  };
  context.time = cast.start;
  context.profession.core.castDetails.set(cast.id, {});
  applySkillSideEffects(context, cast, 'castStart', troubadourHooks.sideEffectHandlers);
  context.time = cast.effectiveEnd;
  applySkillSideEffects(context, cast, 'castCommit', troubadourHooks.sideEffectHandlers);
  const note = context.events.find((event) => event.type === 'resource' && event.amount > 0);
  const boon = context.events.find((event) => event.kind === 'might');
  assert.equal(note.at, context.time);
  assert.equal(boon.at, context.time);
  assert.equal(boon.audience.recipients, 'party');
  assert.equal(boon.audience.maximumRecipients, 5);
  play(context, ID.FLUSTERING_FLUTE, context.time, note.amount);
  assert.equal(context.profession.specialization.state.notes.value, 0);
  assert.ok(context.profession.specialization.state.instruments.Flute > context.time + 5);
});

test('Crescendo reads an instrument committed between acceptance and impact', () => {
  const context = instrumentContext();
  const skill = context.catalog.skillsById.get(ID.CRESCENDO);
  const cast = { id: 'crescendo', skill, start: 0, fullEnd: 1, effectiveEnd: 1, command: {} };
  const queued = [];
  context.scheduleForCast = (type, at, cast) => queued.push({ type, at, cast });
  applySkillSideEffects(context, cast, 'castStart', troubadourHooks.sideEffectHandlers);
  assert.equal(
    context.events.some((event) => event.type === 'damage'),
    false
  );
  play(context, ID.LIVELY_LUTE, queued[0].at / 2);
  context.time = queued[0].at;
  troubadourHooks.tasks[queued[0].type](context, { cast });
  const strike = context.events.find((event) => event.type === 'damage');
  assert.equal(strike.at, context.time);
  assert.equal(strike.coefficient, 2.25 * 1.25);
});

test('Flute endurance regeneration uses the final live microsecond and loses the bonus at expiry', () => {
  const context = instrumentContext();
  play(context, ID.FLUSTERING_FLUTE, 0.301);
  for (const at of [5.300999, 5.301, 5.301001]) {
    context.time = at;
    assert.equal(troubadourEndurance.regenerationRate(context, false, at), at < 5.301 ? 6.25 : 5);
  }
});

// Forecasting and advancement must split both Vigor and replaced Flute windows, even across an otherwise idle wait.
test('Troubadour endurance integrates Flute replacement and Vigor boundaries without losing partial recovery', () => {
  const context = instrumentContext();
  const state = context.profession.specialization.state;
  state.endurance.value = 0;
  play(context, ID.FLUSTERING_FLUTE, 1, 3);
  play(context, ID.FLUSTERING_FLUTE, 2);
  const vigor = { type: 'buff', kind: 'vigor', at: 3, duration: 2, stacks: 1, audience: { recipients: 'self' } };
  context.events.push({ ...vigor, resolvedAudience: gw2BoonApplicationRecipients({}, vigor) });
  // 0-1: 5; 1-3: 12.5; 3-5: 17.5; 5-7: 12.5. The remaining 2.5 takes 0.5s at the base rate.
  assert.equal(((context.time = 0), context.endurance.readyAt(50)), 7.52);
  assert.equal(state.endurance.value, 0, 'Readiness must not mutate the pool');
  context.time = 7;
  context.endurance.advance();
  assert.equal(state.endurance.value, 47.5);
  context.time = 8;
  context.endurance.advance();
  assert.equal(state.endurance.value, 52.5);
  assert.equal(state.endurance.updatedAt, 8);
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
  const result = runMesmer(
    [ID.LIVELY_LUTE, { type: 'wait', durationMs: 3000 }],
    {
      patchId: 'short-instrument',
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.CALL_AND_RESPONSE]
    },
    { profession }
  );
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
