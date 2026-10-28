import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { grantNecromancerSoulShards } from '#gw2/professions/necromancer/core/mechanics/soul-shards.js';
import { consumeSoulShards } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { harbingerHooks } from '#gw2/professions/necromancer/specializations/harbinger/hooks.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { observedRuntime, projectObservedState } from '#tests/helpers/observed-runtime.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const PATCH = 'resource-capacity';
const SHARDS = ID.SOUL_SHARDS;
const BLIGHT = TRAIT.DARK_DISCIPLE;
const wait = (durationMs) => ({ type: 'wait', durationMs });

/** Exercise the public overlay so initialization and later mechanics must select the same balance source. */
function preview(shards, blight) {
  return withPatchPreview(necromancerProfession, {
    id: PATCH,
    label: 'Resource capacity',
    professions: {
      necromancer: {
        skills: { [SHARDS]: { fields: { maximumStacks: shards } } },
        balanceProfiles: {
          [BLIGHT]: { fields: { maximumStacks: blight } }
        }
      }
    }
  });
}

for (const [shards, blight] of [
  [0, 0],
  [1, 2],
  [8, 30]
]) {
  test(`selected capacities ${shards}/${blight} govern grants, initial state, and detached views`, () => {
    const family = preview(shards, blight);
    const run = createProfessionSimulator(family);
    const config = { patchId: PATCH, specialization: 'Harbinger', primaryWeapon: 'Spear', initialBlight: 100 };
    const result = run([], config, {
      initialize(owner) {
        grantNecromancerSoulShards(owner.mechanics, 100);
      }
    });
    assert.deepEqual(result.warnings, []);
    const owner = observedRuntime(result);
    assert.equal(owner.profession.core.soulShardGrant.charges, shards);
    assert.equal(owner.profession.specialization.state.blightExpiries.length, blight);
    assert.equal(harbingerHooks.observeEffects(owner.mechanics)[0].countLimit, blight);

    // Reconciliation repairs over-cap projections without rewriting the retained combat state.
    owner.profession.core.soulShardGrant.charges = 100;
    owner.profession.specialization.state.blightExpiries = Array(100).fill(25);
    const before = structuredClone(owner.profession);
    const state = projectObservedState(family, { config, profession: owner.profession });
    assert.equal(state[STATE.SOUL_SHARD_GRANT].charges, shards);
    assert.equal(state[STATE.BLIGHT], blight);
    assert.deepEqual(owner.profession, before);

    const catalog = family.resolvePatch({ id: PATCH }).catalog;
    const context = { catalog, specialization: 'Harbinger', config, professionState: state };
    const views = family.ui.resourceViews(context);
    assert.equal(views.find((view) => view.id === 'soul-shards').maximum, shards);
    assert.equal(views.find((view) => view.id === 'blight').maximum, blight);
    const snapshot = family.ui.rotationStateSnapshot({
      ...context,
      balanceContext: family.resolvePatch({ id: PATCH }).balanceContext
    });
    assert.equal(snapshot.find((item) => item.id === 'harbinger-blight').value, `${blight}/${blight}`);
    const controls = family.ui.previewControls({
      catalog,
      specialization: 'Harbinger',
      build: {},
      activeTraits: [],
      weapons: []
    });
    assert.equal(controls.find((control) => control.key === 'blight').max, blight);

    // The preview must not change another run's baseline capacity.
    const baseline = run(
      [],
      { ...config, patchId: 'current' },
      {
        initialize(runtime) {
          grantNecromancerSoulShards(runtime.mechanics, 100);
        }
      }
    );
    assert.deepEqual(baseline.warnings, []);
    assert.equal(observedRuntime(baseline).profession.core.soulShardGrant.charges, 6);
    assert.equal(observedRuntime(baseline).profession.specialization.state.blightExpiries.length, 25);
  });

  test(`selected capacities ${shards}/${blight} apply to weapon, elixir, and shroud gains`, () => {
    const family = preview(shards, blight);
    const run = createProfessionSimulator(family);
    const config = { patchId: PATCH, specialization: 'Harbinger', initialResource: 100 };
    const spear = run(['Extirpate'], { ...config, primaryWeapon: 'Spear' });
    assert.deepEqual(spear.warnings, []);
    assert.equal(observedRuntime(spear).profession.core.soulShardGrant.charges, Math.min(shards, 2));
    const elixir = run(['Elixir of Risk'], { ...config, initialBlight: blight });
    assert.deepEqual(elixir.warnings, []);
    assert.equal(observedRuntime(elixir).profession.specialization.state.blightExpiries.length, blight);
    for (const selectedTraitIds of [[], [TRAIT.DOOM_APPROACHES]]) {
      const shroud = run(['Harbinger Shroud', wait(2000)], {
        ...config,
        initialBlight: Math.max(0, blight - 1),
        selectedTraitIds
      });
      assert.deepEqual(shroud.warnings, []);
      assert.equal(observedRuntime(shroud).profession.specialization.state.blightExpiries.length, blight);
    }
  });
}

// A patched pool retains the existing spend and refreshed-expiry contract.
test('patched Soul Shards can be spent, refilled, and expired through the native scheduler', () => {
  const run = createProfessionSimulator(preview(8, 25));
  const result = run(
    [wait(12000)],
    { patchId: PATCH, specialization: 'Core' },
    {
      initialize(owner) {
        grantNecromancerSoulShards(owner.mechanics, 20);
      },
      timeline: [
        {
          at: 1,
          run(owner) {
            assert.equal(consumeSoulShards(owner.profession.core, 3, owner.time), 3);
            grantNecromancerSoulShards(owner.mechanics, 20);
            assert.equal(owner.profession.core.soulShardGrant.charges, 8);
          }
        }
      ],
      probes: [[10, (owner) => assert.equal(owner.profession.core.soulShardGrant.charges, 8)]]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).profession.core.soulShardGrant.charges, 0);
});
