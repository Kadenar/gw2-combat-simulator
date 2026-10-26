import {
  controlAccepted,
  elementalistCastCompleted,
  elementalistConditionApplied
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import {
  completeEvokerAttunement,
  reenterEvokerAttunement
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const skill = { id: 1, name: 'Fixture Heal', type: 'Heal' };
const castFor = (context, skill) => ({
  id: 'fixture-cast',
  skill,
  command: {},
  start: context.time,
  fullEnd: context.effectiveEnd,
  effectiveEnd: context.effectiveEnd
});

// Use native services while collecting just the procedural output under test.
// Trait selection is fixed here because a build's traits never change once its context is in use.
function contextFor(kind = 'Core', specialization = {}, traits = []) {
  const context = observedRuntime(runElementalist([], { specialization: kind }));
  const core = createElementalistCoreState();
  context.profession = { core, specialization: { kind, state: specialization } };
  context.time = context.effectiveEnd = 1;
  context.engagementController.acceptEntry(context.time);
  context.traits = new Set(traits);
  const events = [];
  context.effects = captureEffectEmissions({
    submit: (event) => {
      events.push(event);
      return event;
    },
    announce: (request) => {
      const event = { ...request.announcement, type: 'proc' };
      events.push(event);
      return event;
    }
  }).effects;
  return { context, core, events };
}

for (const [trait, traitId, key, profile, invoke] of [
  [
    "Earth's Embrace",
    TRAIT.EARTHS_EMBRACE,
    'earthsEmbrace',
    TRAIT.EARTHS_EMBRACE,
    (c) => c.fireTrigger(elementalistCastCompleted, { cast: castFor(c, skill) })
  ],
  [
    'Soothing Ice',
    TRAIT.SOOTHING_ICE,
    'soothingIce',
    TRAIT.SOOTHING_ICE,
    (c) => c.fireTrigger(elementalistCastCompleted, { cast: castFor(c, skill) })
  ],
  [
    'Elemental Lockdown',
    TRAIT.ELEMENTAL_LOCKDOWN,
    'elementalLockdown',
    TRAIT.ELEMENTAL_LOCKDOWN,
    (c) => c.fireTrigger(controlAccepted, { cause: { type: 'control', actorType: 'player', at: c.effectiveEnd } })
  ],
  [
    'Strength of Stone',
    TRAIT.STRENGTH_OF_STONE,
    'strengthOfStone',
    TRAIT.STRENGTH_OF_STONE,
    (c) =>
      c.fireTrigger(elementalistConditionApplied, {
        cause: { type: 'condition', condition: 'Immobilized', at: c.effectiveEnd }
      })
  ]
]) {
  test(`${trait} retains eligibility, zero override and strict owner-local deadlines`, () => {
    for (const duration of [2, 0]) {
      const profiles = new Map(elementalistCatalog.balanceProfilesById);
      profiles.set(profile, {
        ...profiles.get(profile),
        internalCooldown: duration
      });
      const elapsed = duration;
      // The unselected and selected builds each own a context; neither changes selection after its first use.
      const prepare = (traits) => {
        const fixture = contextFor('Core', {}, traits);
        fixture.core.primaryAttunement = 'Water';
        fixture.context.helpers = { ...fixture.context.helpers, balanceProfilesById: profiles };
        return fixture;
      };

      const unselected = prepare([]).context;
      invoke(unselected);
      assert.equal(unselected.procs.deadline(key), 0);
      const { context, events } = prepare([traitId]);
      const emit = context.effects.emit.bind(context.effects);
      context.effects = {
        emit(request) {
          const event = request.event ?? request.announcement ?? { at: request.at };
          assert.equal(context.procs.deadline(key), event.at + elapsed);
          return emit(request);
        }
      };

      invoke(context);
      const count = events.length;
      assert.ok(count > 0);
      context.effectiveEnd = 1 + elapsed;
      invoke(context);
      assert.equal(events.length, count);
      context.effectiveEnd += 0.000001;
      invoke(context);
      assert.ok(events.length > count);
      assert.equal(contextFor().context.procs.deadline(key), 0);
    }
  });
}

test('Catalyst combo claims stay per element, and per trait, including Water', () => {
  for (const duration of [2, 0]) {
    for (const handler of [
      elementalistProfession.runtimeFor({ specialization: 'Catalyst' }).reactions['combo.resolved']
    ]) {
      const invoke = (context, event) => {
        context.time = event.at;
        handler(context, event);
      };

      const profiles = new Map(elementalistCatalog.balanceProfilesById);
      for (const id of [TRAIT.ELEMENTAL_EPITOME, TRAIT.ELEMENTAL_SYNERGY]) {
        profiles.set(id, { ...profiles.get(id), internalCooldown: duration });
      }

      // The unselected and selected builds each own a context; neither changes selection after its first use.
      const prepare = (traits) => {
        const fixture = contextFor('Catalyst', catalystState.create(), traits);
        fixture.context.helpers = { ...fixture.context.helpers, balanceProfilesById: profiles };
        return fixture;
      };

      const combo = { type: 'combo', at: 1, sourceId: 1 };
      const unselected = prepare([]).context;
      invoke(unselected, combo);
      for (const trait of ['elementalEpitome', 'elementalSynergy'])
        assert.equal(unselected.procs.deadline(`elementalist.catalyst.${trait}:Fire`), 0);
      const { context, core, events } = prepare([TRAIT.ELEMENTAL_EPITOME, TRAIT.ELEMENTAL_SYNERGY]);
      for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
        core.primaryAttunement = element;
        invoke(context, { ...combo, attunement: element });
        assert.equal(context.procs.deadline(`elementalist.catalyst.elementalEpitome:${element}`), 1 + duration);
        assert.equal(context.procs.deadline(`elementalist.catalyst.elementalSynergy:${element}`), 1 + duration);
        const count = events.length;
        invoke(context, { ...combo, attunement: element, at: 1 + duration });
        assert.equal(events.length, count);
        invoke(context, { ...combo, attunement: element, at: 1 + duration + 0.000001 });
        assert.equal(
          context.procs.deadline(`elementalist.catalyst.elementalSynergy:${element}`),
          1 + duration + 0.000001 + duration
        );
      }

      assert.equal('elementalSynergyReadyAt' in catalystState.create(), false);
    }
  }
});

test('Evoker real and synthetic entry share selected profile timers', () => {
  // Each build owns its Earth-aligned fixture; selection never changes after a context's first entry.
  const prepare = (traits) => {
    const state = evokerState.create();
    state.element = 'Earth';
    return contextFor('Evoker', state, traits);
  };

  const earth = elementalistCatalog.skillsById.get(5495);
  // A real entry on an unselected build claims nothing.
  const unselected = prepare([]).context;
  completeEvokerAttunement(unselected, castFor(unselected, earth), earth);
  for (const trait of [TRAIT.EARTHEN_BLAST, TRAIT.ROCK_SOLID]) assert.equal(unselected.procs.deadline(trait), 0);
  const { context, core } = prepare([TRAIT.EARTHEN_BLAST, TRAIT.ROCK_SOLID]);
  completeEvokerAttunement(context, castFor(context, earth), earth);
  assert.equal(context.procs.deadline(TRAIT.EARTHEN_BLAST), 6);
  assert.equal(context.procs.deadline(TRAIT.ROCK_SOLID), 6);
  core.primaryAttunement = 'Earth';
  context.effectiveEnd = 6;
  reenterEvokerAttunement(context, castFor(context, skill), skill, 'Earth');
  assert.equal(context.procs.deadline(TRAIT.ROCK_SOLID), 6);
  context.effectiveEnd += 0.000001;
  reenterEvokerAttunement(context, castFor(context, skill), skill, 'Earth');
  assert.equal(context.procs.deadline(TRAIT.ROCK_SOLID), context.effectiveEnd + 5);
  assert.equal(context.procs.deadline(TRAIT.EARTHEN_BLAST), context.effectiveEnd + 5);
  const other = contextFor('Evoker', evokerState.create());
  reenterEvokerAttunement(other.context, castFor(other.context, skill), skill, 'Earth');
  for (const trait of [TRAIT.EARTHEN_BLAST, TRAIT.ROCK_SOLID]) assert.equal(other.context.procs.deadline(trait), 0);
});
