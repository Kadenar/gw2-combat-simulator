import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  consumeElementalistEtching,
  createElementalistSpearLifecycle,
  openElementalistEtching
} from '#gw2/professions/elementalist/core/mechanics/spear.js';
import { attunementsCounted } from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { evokerEntryObserved } from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { commitRechargeDuration } from '#gw2/professions/elementalist/specializations/evoker/traits/attunement-policy.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

/** Counter tests supply entry facts without invoking unrelated cast or packet handling. */
function entry(at, to) {
  return {
    transition: { kind: 'reentry', at, to, sourceId: ID.FIRE_ATTUNEMENT, source: 'Fire Attunement' },
    cause: { type: 'elementalist.attunement-enter', at, sourceId: ID.FIRE_ATTUNEMENT, actorType: 'player' }
  };
}

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
  context.fireTrigger(evokerEntryObserved, entry(2, 'Water'));
  assert.deepEqual(observations, []);
  assert.equal(state.elementalBalanceProgress, 0);

  context.fireTrigger(evokerEntryObserved, entry(2, 'Fire'));
  assert.deepEqual(observations, [
    ['Elemental Balance', 0, 7],
    ['familiarCharges', 1, 0, 7]
  ]);
  assert.equal(commitRechargeDuration(context, elementalistCatalog.skillsById.get(73088), 100), 100);
  const skill = elementalistCatalog.skillsById.get(5548);
  assert.equal(commitRechargeDuration(context, skill, 100), 34);
  assert.equal(commitRechargeDuration(context, skill, 100), 100);
  assert.equal(state.elementalBalanceProgress, 0);

  observations.length = 0;
  context.fireTrigger(evokerEntryObserved, entry(3, 'Fire'));
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
    context.fireTrigger(evokerEntryObserved, entry(index, 'Water'));
    context.fireTrigger(evokerEntryObserved, entry(index, 'Fire'));
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
    context.fireTrigger(evokerEntryObserved, entry(1, 'Fire'));
    assert.equal(state.elementalBalanceProgress, 0);
    assert.equal(state.elementalBalanceUntil, 6);
    assert.equal(announcements.length, 1);
  }
});

test('etching counters retain independent crossing values and reset only with their owned lifecycle', () => {
  // Real root/release identities protect credit exclusions while a fractional threshold exposes accidental clamping.
  const core = createElementalistCoreState();
  const context = {
    helpers: applySkillPatch(elementalistCatalog, {
      skills: Object.fromEntries(
        [ID.ETCHING_VOLCANO, ID.ETCHING_DERECHO].map((id) => [
          id,
          { fields: { etchingCompletionThreshold: { from: 3, to: 2.5 } } }
        ])
      )
    }),
    time: 0,
    profession: { core },
    schedule() {}
  };
  const fire = elementalistCatalog.skillsById.get(ID.ETCHING_VOLCANO);
  const air = elementalistCatalog.skillsById.get(ID.ETCHING_DERECHO);
  const release = elementalistCatalog.skillsById.get(ID.VOLCANO);
  const ordinary = elementalistCatalog.skillsById.get(73137);
  const lifecycle = createElementalistSpearLifecycle({});
  const credit = (skill) => lifecycle.onCastCommit(context, { id: 'etching-credit', skill });
  openElementalistEtching(context, fire);
  credit(fire);
  assert.equal(core.etchings[fire.name].otherCasts, 0);
  openElementalistEtching(context, air);
  credit(air);
  assert.equal(core.etchings[fire.name].otherCasts, 1);
  assert.equal(core.etchings[air.name].otherCasts, 0);

  credit(ordinary);
  credit(release);
  assert.equal(core.etchings[fire.name].otherCasts, 2);
  assert.equal(core.etchings[air.name].otherCasts, 1);
  credit(ordinary);
  assert.equal(core.etchings[fire.name].stage, 'full');
  assert.equal(core.etchings[fire.name].otherCasts, 3);
  assert.equal(core.etchings[air.name].stage, 'lesser');
  credit(ordinary);
  assert.equal(core.etchings[fire.name].otherCasts, 3);
  assert.equal(core.etchings[air.name].stage, 'full');

  context.time = 1;
  openElementalistEtching(context, fire);
  assert.equal(core.etchings[fire.name].otherCasts, 0);
  assert.equal(core.etchings[fire.name].stage, 'lesser');
  consumeElementalistEtching(context, elementalistCatalog.skillsById.get(ID.DERECHO));
  assert.equal(core.etchings[air.name], null);
});
