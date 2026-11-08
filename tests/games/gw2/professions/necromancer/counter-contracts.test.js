import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createCombatEngagement } from '#gw2/platform/combat/engagement.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { harbingerBlightConsumed } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/trigger-points.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

// Excess consumed Blight advances the next cycle before Meltdown emits its reward.
test('Cascading Corruption carries overflow in combat before emitting the consuming cast reward', () => {
  for (const removed of [false, true]) {
    const state = necromancerProfession.runtimeFor({ specialization: 'Harbinger' }).createState({})
      .specialization.state;
    state.cascadingCorruptionStacks = 15;
    const observations = [];
    const engagement = createCombatEngagement({ authoredMarkers: 1 });
    const runtime = {
      helpers: applyBalanceProfilePatch(necromancerCatalog, {
        balanceProfiles: {
          [TRAIT.CASCADING_CORRUPTION]: {
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
      engagement: engagement.query,
      traits: new Set([TRAIT.CASCADING_CORRUPTION]),
      profession: { specialization: { kind: 'Harbinger', state } },
      effects: captureEffectEmissions({
        now: () => 1,
        announce(request) {
          observations.push([state.cascadingCorruptionStacks, request.attribution.activationId]);
          return { type: 'proc', ...request.announcement };
        }
      }).effects
    };
    const cast = { id: 'consuming-cast', skill: { id: 'test.elixir', name: 'Elixir' }, command: {} };
    bindTriggerPoints(runtime, necromancerProfession, { specialization: 'Harbinger' });
    runtime.fireTrigger(harbingerBlightConsumed, { cast, consumed: 10, at: runtime.time, activationId: cast.id });
    assert.equal(state.cascadingCorruptionStacks, 15);
    engagement.discoverBoundary(1);
    runtime.fireTrigger(harbingerBlightConsumed, { cast, consumed: 0, at: runtime.time, activationId: cast.id });
    assert.equal(state.cascadingCorruptionStacks, 15);
    runtime.fireTrigger(harbingerBlightConsumed, { cast, consumed: 10, at: runtime.time, activationId: cast.id });
    assert.equal(state.cascadingCorruptionStacks, removed ? 15 : 5);
    assert.deepEqual(observations, removed ? [] : [[5, 'consuming-cast']]);
    runtime.fireTrigger(harbingerBlightConsumed, { cast, consumed: 15, at: runtime.time, activationId: cast.id });
    assert.equal(state.cascadingCorruptionStacks, removed ? 15 : 0);
    assert.deepEqual(
      observations,
      removed
        ? []
        : [
            [5, 'consuming-cast'],
            [0, 'consuming-cast']
          ]
    );
  }
});
