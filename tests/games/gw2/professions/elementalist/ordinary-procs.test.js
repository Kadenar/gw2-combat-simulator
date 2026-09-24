import assert from 'node:assert/strict';
import test from 'node:test';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import {
  applyGenericPostCast,
  observeElementalistTraitEvent,
  triggerEvasiveArcana
} from '#gw2/professions/elementalist/core/traits/index.js';
import { applyElementalistResolvedCondition } from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/elementalist/core/profiles.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { applyCatalystComboTraits } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/reactions.js';
import { catalystSchedulerHooks } from '#gw2/professions/elementalist/specializations/catalyst/mechanics/jade-sphere-and-empowerment.js';
import { CATALYST_BALANCE_PROFILE_IDS as CATALYST } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import {
  completeEvokerAttunement,
  triggerSpecializedElementEntry
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/attunements.js';

const skill = { id: 1, name: 'Fixture Heal', type: 'Heal' };

// Keep scheduler and resolver instances separate while inspecting deadlines at the first effect.
function contextFor(kind = 'Core', specialization = {}) {
  const core = createElementalistCoreState();
  const profession = { core, specialization: { kind, state: specialization } };
  const events = [];
  const context = {
    catalog: elementalistCatalog,
    config: {},
    hasBuff: () => false,
    schedulerPolicy: { isCombatActive: () => true },
    traits: new Set(),
    profession,
    state: {
      time: 1,
      activeWeaponSet: 1,
      cooldowns: new Map(),
      ammo: new Map(),
      rechargeProgress: new Map(),
      profession
    },
    effectiveEnd: 1,
    inFlight: new Map(),
    events,
    boons: new Map(),
    query: { statsAt: () => ({}) },
    recordProc() {},
    emit(event) {
      events.push(event);
      return event;
    },
    applyCondition(event) {
      return this.emit(event);
    },
    queue: {
      enqueue(event) {
        return context.emit(event);
      }
    }
  };
  // Attunement completion delegates recharge speed and timers to the shared controller.
  context.cooldownController = createCooldownController({ state: context.state, rechargeDuration: () => 0 });
  return { context, core, events };
}

for (const [trait, key, profile, invoke] of [
  ["Earth's Embrace", 'earthsEmbrace', CORE.earthsEmbrace, (c) => applyGenericPostCast(c, skill)],
  ['Soothing Ice', 'soothingIce', CORE.soothingIce, (c) => applyGenericPostCast(c, skill)],
  [
    'Elemental Lockdown',
    'elementalLockdown',
    CORE.elementalLockdown,
    (c) => observeElementalistTraitEvent(c, { type: 'control', actorType: 'player', at: c.effectiveEnd })
  ],
  [
    'Strength of Stone',
    'strengthOfStone',
    CORE.strengthOfStone,
    (c) => applyElementalistResolvedCondition(c, { type: 'condition', condition: 'Immobilized', at: c.effectiveEnd })
  ],
  ['Evasive Arcana', 'evasiveArcanaWater', CORE.evasiveArcana, (c) => triggerEvasiveArcana(c, skill)]
]) {
  test(`${trait} retains eligibility, zero override and strict owner-local deadlines`, () => {
    for (const duration of [2, 0]) {
      const { context, core, events } = contextFor();
      core.primaryAttunement = 'Water';
      const profiles = new Map(elementalistCatalog.balanceProfilesById);
      profiles.set(profile, { ...profiles.get(profile), internalCooldown: duration });
      context.catalog = { ...elementalistCatalog, balanceProfilesById: profiles };
      invoke(context);
      assert.deepEqual(core.procReadyAt, {});
      context.traits.add(trait);
      const emit = context.emit.bind(context);
      context.emit = (event) => {
        assert.equal(core.procReadyAt[key], event.at + duration);
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
      assert.deepEqual(contextFor().core.procReadyAt, {});
    }
  });
}

test('Catalyst combo claims stay per element, per trait and per phase, including Water', () => {
  for (const duration of [2, 0]) {
    for (const invoke of [applyCatalystComboTraits, catalystSchedulerHooks.onEventScheduled.handler]) {
      const state = catalystState.create();
      const { context, core, events } = contextFor('Catalyst', state);
      const profiles = new Map(elementalistCatalog.balanceProfilesById);
      for (const id of [CATALYST.elementalEpitome, CATALYST.elementalSynergy]) {
        profiles.set(id, { ...profiles.get(id), internalCooldown: duration });
      }

      context.catalog = { ...elementalistCatalog, balanceProfilesById: profiles };
      const combo = { type: 'combo', at: 1, sourceId: 1, schedulerPrediction: 'combo-result' };
      invoke(context, combo);
      assert.deepEqual(state.elementalEpitomeReadyAt, {});
      context.traits = new Set(['Elemental Epitome', 'Elemental Synergy']);
      for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
        core.primaryAttunement = element;
        invoke(context, { ...combo, attunement: element });
        assert.equal(state.elementalEpitomeReadyAt[element], 1 + duration);
        assert.equal(state.elementalSynergyReadyAt[element], 1 + duration);
        const count = events.length;
        invoke(context, { ...combo, attunement: element, at: 1 + duration });
        assert.equal(events.length, count);
        invoke(context, { ...combo, attunement: element, at: 1 + duration + 0.000001 });
        assert.equal(state.elementalSynergyReadyAt[element], 1 + duration + 0.000001 + duration);
      }

      if (invoke === catalystSchedulerHooks.onEventScheduled.handler) {
        assert.ok(events.every((event) => event.schedulerPrediction === 'combo-result'));
      }

      assert.deepEqual(catalystState.create().elementalSynergyReadyAt, {});
    }
  }
});

test('Evoker real and synthetic entry share profile timers without changing trait eligibility', () => {
  const state = evokerState.create();
  state.element = 'Earth';
  const { context, core } = contextFor('Evoker', state);
  const earth = elementalistCatalog.skillsByName.get('Earth Attunement');
  // Real entry intentionally consults the policy before downstream trait selection.
  completeEvokerAttunement(context, earth);
  assert.equal(state.attunementTraitProcReadyAt[CORE.earthenBlast], 6);
  assert.equal(state.attunementTraitProcReadyAt[CORE.rockSolid], 6);
  context.traits = new Set(['Earthen Blast', 'Rock Solid']);
  core.primaryAttunement = 'Earth';
  context.effectiveEnd = 6;
  triggerSpecializedElementEntry(context, skill, 'Earth');
  assert.equal(state.attunementTraitProcReadyAt[CORE.rockSolid], 6);
  context.effectiveEnd += 0.000001;
  triggerSpecializedElementEntry(context, skill, 'Earth');
  assert.equal(state.attunementTraitProcReadyAt[CORE.rockSolid], context.effectiveEnd + 5);
  assert.equal(state.attunementTraitProcReadyAt[CORE.earthenBlast], context.effectiveEnd + 5);
  const other = contextFor('Evoker', evokerState.create());
  triggerSpecializedElementEntry(other.context, skill, 'Earth');
  assert.deepEqual(other.context.profession.specialization.state.attunementTraitProcReadyAt, {});
});
