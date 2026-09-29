import { applyElementalistResolvedCondition } from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import {
  applyGenericPostCast,
  observeElementalistTraitEvent
} from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { triggerEvasiveArcana } from '#gw2/professions/elementalist/core/traits/behavior.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { catalystModule } from '#gw2/professions/elementalist/specializations/catalyst/module.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { completeEvokerAttunement } from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { triggerSpecializedElementEntry } from '#gw2/professions/elementalist/specializations/evoker/traits/attunements.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const skill = { id: 1, name: 'Fixture Heal', type: 'Heal' };

// Use native services while collecting just the procedural output under test.
function contextFor(kind = 'Core', specialization = {}) {
  const context = observedRuntime(runElementalist({ config: { specialization: kind }, rotation: [] }));
  const core = createElementalistCoreState();
  context.profession = { core, specialization: { kind, state: specialization } };
  context.time = context.effectiveEnd = 1;
  context.combatActive = true;
  context.traits = new Set();
  const events = [];
  context.emit = (event) => {
    events.push(event);
    return event;
  };

  context.queue.enqueue = (event) => context.emit(event);
  context.applyCondition = (event) => context.emit(event);
  return { context, core, events };
}

for (const [trait, traitId, key, profile, invoke] of [
  [
    "Earth's Embrace",
    TRAIT.EARTHS_EMBRACE,
    'earthsEmbrace',
    TRAIT.EARTHS_EMBRACE,
    (c) => applyGenericPostCast(c, c, skill)
  ],
  ['Soothing Ice', TRAIT.SOOTHING_ICE, 'soothingIce', TRAIT.SOOTHING_ICE, (c) => applyGenericPostCast(c, c, skill)],
  [
    'Elemental Lockdown',
    TRAIT.ELEMENTAL_LOCKDOWN,
    'elementalLockdown',
    TRAIT.ELEMENTAL_LOCKDOWN,
    (c) => observeElementalistTraitEvent(c, { type: 'control', actorType: 'player', at: c.effectiveEnd })
  ],
  [
    'Strength of Stone',
    TRAIT.STRENGTH_OF_STONE,
    'strengthOfStone',
    TRAIT.STRENGTH_OF_STONE,
    (c) => applyElementalistResolvedCondition(c, { type: 'condition', condition: 'Immobilized', at: c.effectiveEnd })
  ],
  [
    'Evasive Arcana',
    TRAIT.EVASIVE_ARCANA,
    'evasiveArcanaWater',
    TRAIT.EVASIVE_ARCANA,
    (c) => triggerEvasiveArcana(c, c, skill)
  ]
]) {
  test(`${trait} retains eligibility, zero override and strict owner-local deadlines`, () => {
    for (const duration of [2, 0]) {
      const { context, core, events } = contextFor();
      core.primaryAttunement = 'Water';
      const profiles = new Map(elementalistCatalog.balanceProfilesById);
      profiles.set(profile, { ...profiles.get(profile), internalCooldown: duration });
      context.helpers = { ...context.helpers, balanceProfilesById: profiles };
      invoke(context);
      assert.deepEqual({ ...context.procs.readyAt }, {});
      context.traits.add(traitId);
      const emit = context.emit.bind(context);
      context.emit = (event) => {
        assert.equal(context.procs.readyAt[key], event.at + duration);
        return emit(event);
      };

      invoke(context);
      const count = events.length;
      assert.ok(count > 0);
      context.effectiveEnd = 1 + duration;
      invoke(context);
      assert.equal(events.length, count);
      context.effectiveEnd += 0.000001;
      invoke(context);
      assert.ok(events.length > count);
      assert.deepEqual({ ...contextFor().context.procs.readyAt }, {});
    }
  });
}

test('Catalyst combo claims stay per element, and per trait, including Water', () => {
  for (const duration of [2, 0]) {
    for (const handler of [catalystModule.hooks.reactions['combo.resolved']]) {
      const invoke = (context, event) => {
        context.time = event.at;
        handler(context, event);
      };

      const state = catalystState.create();
      const { context, core, events } = contextFor('Catalyst', state);
      const profiles = new Map(elementalistCatalog.balanceProfilesById);
      for (const id of [TRAIT.ELEMENTAL_EPITOME, TRAIT.ELEMENTAL_SYNERGY]) {
        profiles.set(id, { ...profiles.get(id), internalCooldown: duration });
      }

      context.helpers = { ...context.helpers, balanceProfilesById: profiles };
      const combo = { type: 'combo', at: 1, sourceId: 1 };
      invoke(context, combo);
      assert.deepEqual({ ...context.procs.readyAt }, {});
      context.traits = new Set([TRAIT.ELEMENTAL_EPITOME, TRAIT.ELEMENTAL_SYNERGY]);
      for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
        core.primaryAttunement = element;
        invoke(context, { ...combo, attunement: element });
        assert.equal(context.procs.readyAt[`elementalist.catalyst.elementalEpitome:${element}`], 1 + duration);
        assert.equal(context.procs.readyAt[`elementalist.catalyst.elementalSynergy:${element}`], 1 + duration);
        const count = events.length;
        invoke(context, { ...combo, attunement: element, at: 1 + duration });
        assert.equal(events.length, count);
        invoke(context, { ...combo, attunement: element, at: 1 + duration + 0.000001 });
        assert.equal(
          context.procs.readyAt[`elementalist.catalyst.elementalSynergy:${element}`],
          1 + duration + 0.000001 + duration
        );
      }

      assert.equal('elementalSynergyReadyAt' in catalystState.create(), false);
    }
  }
});

test('Evoker real and synthetic entry share profile timers without changing trait eligibility', () => {
  const state = evokerState.create();
  state.element = 'Earth';
  const { context, core } = contextFor('Evoker', state);
  const earth = elementalistCatalog.skillsByName.get('Earth Attunement');
  // Real entry intentionally consults the policy before downstream trait selection.
  completeEvokerAttunement(context, context, earth);
  assert.equal(context.procs.readyAt[TRAIT.EARTHEN_BLAST], 6);
  assert.equal(context.procs.readyAt[TRAIT.ROCK_SOLID], 6);
  context.traits = new Set([TRAIT.EARTHEN_BLAST, TRAIT.ROCK_SOLID]);
  core.primaryAttunement = 'Earth';
  context.effectiveEnd = 6;
  triggerSpecializedElementEntry(context, context, skill, 'Earth');
  assert.equal(context.procs.readyAt[TRAIT.ROCK_SOLID], 6);
  context.effectiveEnd += 0.000001;
  triggerSpecializedElementEntry(context, context, skill, 'Earth');
  assert.equal(context.procs.readyAt[TRAIT.ROCK_SOLID], context.effectiveEnd + 5);
  assert.equal(context.procs.readyAt[TRAIT.EARTHEN_BLAST], context.effectiveEnd + 5);
  const other = contextFor('Evoker', evokerState.create());
  triggerSpecializedElementEntry(other.context, other.context, skill, 'Earth');
  assert.deepEqual({ ...other.context.procs.readyAt }, {});
});
