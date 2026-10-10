import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { reactToGaleshotMissile } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';

// Multiple contacts from one activation each qualify; optional strike removal must not revoke the arrow refund.
test('Shrike resets each completed hit cycle before refunding arrows', () => {
  const state = galeshotState.create();
  state.missileHits = 2;
  const refunds = [];
  const runtime = {
    helpers: applyBalanceProfilePatch(rangerCatalog, {
      balanceProfiles: {
        [TRAIT.SHRIKE]: {
          fields: { threshold: { from: 12, to: 0.5 } },
          removeEffects: [{ type: 'strike', name: 'Strike' }]
        }
      }
    }),
    traits: new Set([TRAIT.SHRIKE]),
    profession: { specialization: { kind: 'Galeshot', state } },
    resourceController: { grant: (resource, amount) => refunds.push([resource, amount, state.missileHits]) },
    effects: captureEffectEmissions({ submit: () => assert.fail('Removed strike must not emit') }).effects
  };
  // Exercise the same selected point listeners as the live profession.
  bindTriggerPoints(runtime, rangerProfession, { specialization: 'Galeshot', selectedTraitIds: [TRAIT.SHRIKE] });
  const event = {
    type: 'damage',
    at: 1,
    coefficient: 1,
    projectile: true,
    actorType: 'effect',
    ownerActorType: 'player',
    activationId: 'same-activation'
  };
  reactToGaleshotMissile(runtime, { ...event, actorType: 'summon' });
  reactToGaleshotMissile(runtime, { ...event, projectile: false });
  assert.equal(state.missileHits, 2);
  reactToGaleshotMissile(runtime, event);
  reactToGaleshotMissile(runtime, { ...event, actorType: 'player' });
  assert.deepEqual(refunds, [
    ['arrows', 1, 0],
    ['arrows', 1, 0]
  ]);
});
