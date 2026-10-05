import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { createHarbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { applyCascadingCorruption } from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

// A small patched threshold exposes one-claim semantics and the ordering of progress, Meltdown, and its emission.
test('Cascading Corruption resets at the cap in combat before emitting the consuming cast reward', () => {
  for (const removed of [false, true]) {
    const state = createHarbingerState();
    state.cascadingCorruptionStacks = 1;
    const observations = [];
    const runtime = {
      helpers: applyBalanceProfilePatch(necromancerCatalog, {
        balanceProfiles: {
          [TRAIT.CASCADING_CORRUPTION]: {
            fields: { minimumStacks: { from: 20, to: 2.5 } },
            ...(removed
              ? {
                  removeEffects: [
                    { type: 'buff', name: 'meltdown' },
                    { type: 'strike', name: 'Strike' },
                    { type: 'condition', name: 'Torment' }
                  ]
                }
              : {})
          }
        }
      }),
      time: 1,
      combatStartPending: true,
      traits: new Set([TRAIT.CASCADING_CORRUPTION]),
      profession: { specialization: { kind: 'Harbinger', state } },
      effects: captureEffectEmissions({
        now: () => 1,
        announce(request) {
          observations.push([state.cascadingCorruptionStacks, state.meltdownUntil, request.attribution.activationId]);
          return { type: 'proc', ...request.announcement };
        }
      }).effects
    };
    const cast = { id: 'consuming-cast', skill: { id: 'test.elixir', name: 'Elixir' }, command: {} };
    applyCascadingCorruption(runtime, cast, 5);
    assert.equal(state.cascadingCorruptionStacks, 1);
    runtime.combatStartPending = false;
    applyCascadingCorruption(runtime, cast, 0);
    assert.equal(state.cascadingCorruptionStacks, 1);
    applyCascadingCorruption(runtime, cast, 5);
    assert.equal(state.cascadingCorruptionStacks, removed ? 1 : 0);
    assert.deepEqual(observations, removed ? [] : [[0, 11, 'consuming-cast']]);
  }
});
