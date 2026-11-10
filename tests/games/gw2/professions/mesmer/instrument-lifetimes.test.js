import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createExecutedFacts } from '#gw2/platform/combat/history/executed-facts.js';
import { createModifierHooks } from '#gw2/platform/combat/modifiers.js';
import { createEnduranceController } from '#gw2/platform/combat/resources/endurance-controller.js';
import { createVigorWindowReader, vigorEnduranceIntervals } from '#gw2/platform/combat/resources/endurance.js';
import { createResourceController } from '#gw2/platform/combat/resources/resource-controller.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { troubadourHooks } from '#gw2/professions/mesmer/specializations/troubadour/hooks.js';
import {
  activeInstrumentCount,
  hasLute
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-windows.js';
import {
  completeTroubadourPerformance,
  troubadourEndurance
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import { troubadourCrescendoResolved } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
import { troubadourModule } from '#gw2/professions/mesmer/specializations/troubadour/module.js';
import { troubadourUi } from '#gw2/professions/mesmer/specializations/troubadour/presentation.js';
import { fortissimo } from '#gw2/professions/mesmer/specializations/troubadour/traits/index.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { evaluateAttributeDeclarations } from '#tests/helpers/attribute-declarations.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

// Isolate Crescendo's captured bonus from the live Lute buff when checking instrument selection.
const crescendoModifiers = createModifierHooks({
  rules: troubadourModule.modifiers.modifierRules.filter(({ id }) => id === 'mesmer.crescendo-instruments')
});

// Keep real profiles and instrument handlers while isolating windows from cast speed, random damage, and cooldowns.
function instrumentContext(traits = [TRAIT.FORTISSIMO]) {
  // Match the conversion seed to the fixture's starting Power when testing bonus expiry.
  const config = {
    specialization: 'Troubadour',
    selectedTraitIds: traits,
    attributeInputs: baseAttributeInputs({ power: 100 })
  };
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
    helpers: profession.catalog,
    action: {},
    start: 0,
    fullEnd: 0,
    effectiveEnd: 0,
    maximumAmmoFor: () => 0,
    cooldownController: { ensureAmmo: () => false },
    eventsOfType: (type) => events.filter((event) => event.type === type)
  };
  Object.assign(context, state);
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

  // Endurance projection and settlement share the same executed Vigor reader and live instrument policy.
  const vigor = { config, vigorWindows: createVigorWindowReader(events) };
  context.endurance = createEnduranceController({
    clock: context,
    context: () => context,
    policy: troubadourEndurance,
    intervals: (start, end) =>
      vigorEnduranceIntervals(
        vigor,
        start,
        end,
        (hasVigor, at) => troubadourEndurance.regenerationRate(context, hasVigor, at),
        troubadourEndurance.regenerationBoundaries?.(context)
      )
  });
  // Numeric transactions use the same initialized clock policy as the engine.
  context.resourceController = createResourceController({
    clock: context,
    context: () => context,
    policies: troubadourHooks.resources,
    depletion: {
      synchronize() {
        assert.fail('Notes do not declare depletion.');
      }
    }
  });
  context.resourceController.initialize();
  // Direct mechanic fixtures use the profession's compiled, ordered listeners.
  bindTriggerPoints(context, mesmerProfession, config);
  return context;
}

function play(context, id, at, notes = 0) {
  context.fullEnd = context.effectiveEnd = at;
  const skill = context.helpers.skillsById.get(id);
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

// Detached damage preparation must seed both the live projection and the history read by attributes and modifiers.
test('instrument preview assumptions agree across history and planning state without performing instruments', () => {
  for (const count of [0, 1, 2, 3, 4]) {
    const context = instrumentContext();
    context.time = 2;
    context.resourceController.replace('notes', 3);
    troubadourHooks.prepareDamageState(context, undefined, { instruments: count });
    const projected = projectObservedState(mesmerProfession, context)[STATE.ACTIVE_INSTRUMENTS];
    assert.equal(projected.length, count);
    assert.equal(activeInstrumentCount(modifierContext(context, context.time)), count);
    assert.equal(context.profession.specialization.state.notes.value, 3);
    assert.equal(context.profession.specialization.state.lastInstrument, '');
    assert.equal(
      context.events.some((event) => event.type === 'damage'),
      false
    );

    const preview = { values: { instruments: count }, events: [] };
    troubadourUi.prepareAttributePreview(preview);
    assert.equal(activeInstrumentCount({ ...modifierContext(context, 0), events: preview.events }), count);
    assert.deepEqual(
      preview.events.map((event) => event.instrument),
      projected.map(({ name }) => name)
    );
    assert.ok(preview.events.every((event) => event.actorType === 'player'));
  }
});

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
      catalog: context.helpers
    });
    assert.equal(projected[STATE.ACTIVE_INSTRUMENTS].length, Number(active));
    const view = troubadourUi
      .resourceViews({
        catalog: context.helpers,
        professionState: projected,
        resources: { endurance: { maximum: 100 } }
      })
      .find((item) => item.id === 'playing-instruments');
    assert.equal(Boolean(view), active);
    const query = modifierContext(context, at);
    assert.equal(hasLute(query), active);
    assert.equal(
      evaluateAttributeDeclarations(query, { power: 100 }, (context) => [fortissimo.attributes(context)]).power,
      active ? 104 : 100
    );
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
  assert.equal(activeInstrumentCount(modifierContext(context, 1.301)), 2, 'Historical queries retain earlier windows');
  const query = modifierContext(context, 7.301);
  assert.equal(hasLute(query), false);
  assert.equal(
    evaluateAttributeDeclarations(query, { power: 100 }, (context) => [fortissimo.attributes(context)]).power,
    104
  );
  context.time = 7.301;
  assert.deepEqual(
    projectObservedState(mesmerProfession, context)[STATE.ACTIVE_INSTRUMENTS].map(({ name }) => name),
    ['Flute']
  );
  context.start = 7.301;
  const skill = { ...context.helpers.skillsById.get(ID.CRESCENDO), damageAtMs: 0 };
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
  const strike = context.events.find((event) => event.skillId === ID.CRESCENDO);
  assert.equal(strike.coefficient, 2.25);
  assert.equal(
    crescendoModifiers.modifyStrikeDamage(modifierContext(context, context.time, strike), strike.coefficient),
    2.25 * 1.25
  );
});

test('instrument damage queries respect commitment order at the same timestamp', () => {
  const context = instrumentContext();
  play(context, ID.LIVELY_LUTE, 0.301);
  const instrument = context.events.find((event) => event.type === 'mesmer.instrument');
  assert.equal(hasLute(modifierContext(context, 0.301, { eventOrder: instrument.eventOrder - 1 })), false);
  assert.equal(hasLute(modifierContext(context, 0.301, { eventOrder: instrument.eventOrder + 1 })), true);
});

// Exercise acceptance and commitment separately so expiry/replacement cannot rewrite a Tale's eligibility.
function beginTale(context, at) {
  const skill = context.helpers.skillsById.get(ID.TALE_OF_THE_TORTURED_MASTERMIND);
  const cast = { id: 'tale', skill, start: at, command: {} };
  context.time = at;
  context.effects.emit({
    kind: 'packet',
    event: { type: 'action', at, activationId: cast.id, actorType: 'player', source: 'Player', sourceId: cast.skill.id }
  });
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

// Cancellation retires the Tale's accepted reward even while its instrument remains active.
test('cancelled Tales discard accepted instrument eligibility', () => {
  const context = instrumentContext();
  play(context, ID.FLUSTERING_FLUTE, 0);
  const cast = beginTale(context, 1);
  troubadourHooks.onCastCancel(context, cast);
  context.time = 2;
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
    skill: context.helpers.skillsById.get(ID.TALE_OF_THE_SOULKEEPER),
    start: 1,
    fullEnd: 3,
    effectiveEnd: 2,
    command: {}
  };
  context.time = cast.start;
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
  const skill = context.helpers.skillsById.get(ID.CRESCENDO);
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
  assert.equal(strike.coefficient, 2.25);
  assert.equal(
    crescendoModifiers.modifyStrikeDamage(modifierContext(context, context.time, strike), strike.coefficient),
    2.25 * 1.25
  );
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
        balanceProfiles: { [TRAIT.WANDERING_MINSTREL]: { fields: { baseDuration: 0.1, durationPerTier: 0 } } }
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
  assert.equal(result.planningState.profession[STATE.ACTIVE_INSTRUMENTS].length, 0);
  assert.equal(hasLute({ events: result.events, time: delayed.at }), false);
});

// Rewards use the accepted instrument snapshot even after the mechanic's live state changes.
test('Crescendo rewards use the captured last instrument', () => {
  const context = instrumentContext([TRAIT.ALTERED_CHORD]);
  context.profession.specialization.state.lastInstrument = 'Lute';
  const skill = context.helpers.skillsById.get(ID.CRESCENDO);
  context.fireTrigger(troubadourCrescendoResolved, {
    skill,
    at: 1,
    damageAt: 1,
    delivery: {},
    lastInstrument: 'Flute'
  });
  assert.ok(context.events.some((event) => event.type === 'condition' && event.condition === 'Confusion'));
  assert.equal(
    context.events.some((event) => event.type === 'buff' && event.kind === 'altered-chord'),
    false
  );
});
