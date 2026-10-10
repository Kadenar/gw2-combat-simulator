import { evokerEntryObserved } from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { expireElementalistState } from '#gw2/professions/elementalist/core/mechanics/expiry.js';
import {
  completeElementalistSpearProgression,
  consumeElementalistEtching,
  openElementalistEtching
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profile-ids.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { attunementsCounted } from '#gw2/professions/elementalist/core/mechanics/attunement-triggers.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { commitRechargeDuration } from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('Bountiful Power resets at the cap and preserves progress earned by nested reward reactions', () => {
  // An oversized grant earns one reward; progress from a nested application belongs to the new cycle.
  const core = createElementalistCoreState();
  const observations = [];
  let nested = false;
  const context = {
    helpers: applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: { [TRAIT.BOUNTIFUL_POWER]: { fields: { threshold: { from: 5, to: 1.5 } } } }
    }),
    time: 1,
    config: {},
    query: { statsAt: () => ({}) },
    traits: new Set([TRAIT.BOUNTIFUL_POWER]),
    profession: { core },
    effects: captureEffectEmissions({
      submit(event) {
        observations.push([event.kind, core.bountifulPowerProgress]);
        if (!nested && event.kind === 'quickness') {
          nested = true;
          context.fireTrigger(attunementsCounted, { at: 1, stacks: 0.5, sourceId: ID.AIR_ATTUNEMENT });
        }

        return event;
      }
    }).effects
  };
  bindTriggerPoints(context, elementalistProfession);
  context.fireTrigger(attunementsCounted, { at: 1, stacks: 3.5, sourceId: ID.AIR_ATTUNEMENT });
  assert.deepEqual(observations, [
    ['quickness', 0],
    ['bountiful-power-active', 0.5]
  ]);
  assert.equal(core.bountifulPowerProgress, 0.5);
});

test('Elemental Balance resets its entry cycle and arms before Dynamo grants', () => {
  // A patched small threshold exposes whether entry overshoot is discarded when the cycle completes.
  const state = evokerState.create({ evokerElement: 'Fire' });
  const observations = [];
  const context = {
    helpers: applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: { [TRAIT.ELEMENTAL_BALANCE]: { fields: { threshold: { from: 2, to: 0.5 } } } }
    }),
    time: 2,
    traits: new Set([TRAIT.ELEMENTAL_BALANCE, TRAIT.ELEMENTAL_DYNAMO]),
    profession: { specialization: { kind: 'Evoker', state } },
    resourceController: {
      grant(resource, amount) {
        observations.push([resource, amount, state.elementalBalanceProgress, state.elementalBalanceUntil]);
      }
    },
    effects: captureEffectEmissions({
      announce(request) {
        observations.push([request.announcement.name, state.elementalBalanceProgress, state.elementalBalanceUntil]);
      }
    }).effects
  };
  bindTriggerPoints(context, elementalistProfession, { specialization: 'Evoker' });
  for (const event of [
    { type: 'damage', to: 'Fire' },
    { type: 'elementalist.attunement', to: 'Water' }
  ])
    context.fireTrigger(evokerEntryObserved, { event: { at: 2, ...event } });
  assert.deepEqual(observations, []);
  assert.equal(state.elementalBalanceProgress, 0);

  context.fireTrigger(evokerEntryObserved, { event: { type: 'elementalist.attunement-enter', to: 'Fire', at: 2 } });
  assert.deepEqual(observations, [
    ['Elemental Balance', 0, 7],
    ['familiarCharges', 1, 0, 7]
  ]);
  assert.equal(commitRechargeDuration(context, elementalistCatalog.skillsByName.get('Flame Spear'), 100), 100);
  const skill = elementalistCatalog.skillsByName.get('Lava Font');
  assert.equal(commitRechargeDuration(context, skill, 100), 34);
  assert.equal(commitRechargeDuration(context, skill, 100), 100);
  assert.equal(state.elementalBalanceProgress, 0);

  observations.length = 0;
  context.fireTrigger(evokerEntryObserved, { event: { type: 'elementalist.attunement', to: 'Fire', at: 3 } });
  assert.deepEqual(observations, [
    ['Elemental Balance', 0, 8],
    ['familiarCharges', 1, 0, 8]
  ]);
  context.time = 8;
  assert.equal(commitRechargeDuration(context, skill, 100), 100);
  assert.equal(state.elementalBalanceProgress, 0);
});

test('Elemental Balance arms on every second selected-attunement entry and restarts the count', () => {
  // The default entry cycle is one, trigger-and-reset, then one again; unrelated attunements cannot advance it.
  const state = evokerState.create({ evokerElement: 'Fire' });
  const { effects, announcements } = captureEffectEmissions();
  const context = {
    helpers: elementalistCatalog,
    traits: new Set([TRAIT.ELEMENTAL_BALANCE]),
    profession: { specialization: { kind: 'Evoker', state } },
    effects
  };
  bindTriggerPoints(context, elementalistProfession, { specialization: 'Evoker' });
  for (const [index, expected] of [1, 0, 1, 0].entries()) {
    context.fireTrigger(evokerEntryObserved, {
      event: { type: 'elementalist.attunement-enter', to: 'Water', at: index }
    });
    context.fireTrigger(evokerEntryObserved, {
      event: { type: 'elementalist.attunement-enter', to: 'Fire', at: index }
    });
    assert.equal(state.elementalBalanceProgress, expected);
    assert.equal(announcements.length, Math.floor((index + 1) / 2));
  }
});

test('Elemental Balance resets after one reward for nonpositive patched thresholds', () => {
  // Unlike Bountiful Power, these thresholds do not disable entry progress or the recharge window.
  for (const threshold of [0, -1]) {
    const state = evokerState.create({ evokerElement: 'Fire' });
    const { effects, announcements } = captureEffectEmissions();
    const context = {
      helpers: applyBalanceProfilePatch(elementalistCatalog, {
        balanceProfiles: { [TRAIT.ELEMENTAL_BALANCE]: { fields: { threshold: { from: 2, to: threshold } } } }
      }),
      traits: new Set([TRAIT.ELEMENTAL_BALANCE]),
      profession: { specialization: { kind: 'Evoker', state } },
      effects
    };
    bindTriggerPoints(context, elementalistProfession, { specialization: 'Evoker' });
    context.fireTrigger(evokerEntryObserved, { event: { type: 'elementalist.attunement-enter', to: 'Fire', at: 1 } });
    assert.equal(state.elementalBalanceProgress, 0);
    assert.equal(state.elementalBalanceUntil, 6);
    assert.equal(announcements.length, 1);
  }
});

test('etching counters retain independent crossing values and reset only with their owned lifecycle', () => {
  // Real root/release identities protect credit exclusions while a fractional threshold exposes accidental clamping.
  const core = createElementalistCoreState();
  const context = {
    helpers: applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: { [PROFILE.spearEmpowerments]: { fields: { maximumStacks: { from: 3, to: 2.5 } } } }
    }),
    time: 0,
    profession: { core },
    schedule() {}
  };
  const fire = elementalistCatalog.skillsById.get(ID.ETCHING_VOLCANO);
  const air = elementalistCatalog.skillsById.get(ID.ETCHING_DERECHO);
  const release = elementalistCatalog.skillsById.get(ID.VOLCANO);
  const ordinary = elementalistCatalog.skillsByName.get('Seethe');
  openElementalistEtching(context, fire);
  completeElementalistSpearProgression(context, fire);
  assert.equal(core.etchings[fire.name].otherCasts, 0);
  openElementalistEtching(context, air);
  completeElementalistSpearProgression(context, air);
  assert.equal(core.etchings[fire.name].otherCasts, 1);
  assert.equal(core.etchings[air.name].otherCasts, 0);

  completeElementalistSpearProgression(context, ordinary);
  completeElementalistSpearProgression(context, release);
  assert.equal(core.etchings[fire.name].otherCasts, 2);
  assert.equal(core.etchings[air.name].otherCasts, 1);
  completeElementalistSpearProgression(context, ordinary);
  assert.equal(core.etchings[fire.name].stage, 'full');
  assert.equal(core.etchings[fire.name].otherCasts, 3);
  assert.equal(core.etchings[air.name].stage, 'lesser');
  completeElementalistSpearProgression(context, ordinary);
  assert.equal(core.etchings[fire.name].otherCasts, 3);
  assert.equal(core.etchings[air.name].stage, 'full');

  const oldExpiry = core.etchings[fire.name].expiresAt;
  context.time = 1;
  openElementalistEtching(context, fire);
  assert.equal(core.etchings[fire.name].otherCasts, 0);
  assert.equal(core.etchings[fire.name].stage, 'lesser');
  consumeElementalistEtching(context, elementalistCatalog.skillsById.get(ID.DERECHO));
  assert.equal(core.etchings[air.name], null);
  context.time = oldExpiry;
  expireElementalistState(context);
  assert.notEqual(core.etchings[fire.name], null);
  context.time = core.etchings[fire.name].expiresAt;
  expireElementalistState(context);
  completeElementalistSpearProgression(context, ordinary);
  assert.equal(core.etchings[fire.name], null);
});
