import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistRockBarrierLifecycle } from '#gw2/professions/elementalist/core/mechanics/rock-barrier.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { withProfile, withSkill } from '#tests/helpers/catalog-overrides.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Persistent discounts depend on selection and weapon attunement, and must read patched profiles on every query.
for (const [attunement, trait] of [
  ['Fire', TRAIT.PYROMANCERS_TRAINING],
  ['Air', TRAIT.AEROMANCERS_TRAINING],
  ['Earth', TRAIT.GEOMANCERS_TRAINING],
  ['Water', TRAIT.AQUAMANCERS_TRAINING]
]) {
  test(`${attunement} training shares declarative eligibility and patched recharge`, () => {
    for (const selected of [false, true]) {
      const config = { specialization: 'Core', selectedTraitIds: selected ? [trait] : [] };
      const result = runElementalist([], config, {
        catalog: (catalog) => withProfile(catalog, trait, { rechargeMultiplier: 0.5 })
      });
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      const native = elementalistProfession.runtimeFor(config);
      const weapon = {
        id: 'training-probe',
        name: 'Training probe',
        type: 'Weapon',
        attunement,
        rechargeMultiplier: 0.75
      };
      assert.equal(native.rechargeWork(runtime, weapon, 20), selected ? 7.5 : 15);
      assert.equal(native.rechargeWork(runtime, { ...weapon, attunement: 'unmatched' }, 20), 15);
      assert.equal(native.rechargeWork(runtime, { ...weapon, type: 'Utility' }, 20), 20);
    }
  });
}

// A held skill starts exactly one recharge at release or expiry, without consuming a next-cast discount.
for (const release of ['manual', 'expiry']) {
  test(`Rock Barrier ${release} release reuses the patched training rule`, () => {
    const config = { specialization: 'Core', startAttunement: 'Earth', selectedTraitIds: [TRAIT.GEOMANCERS_TRAINING] };
    const open = elementalistRockBarrierLifecycle.tasks['elementalist.core.open-rock-barrier'];
    const close = elementalistRockBarrierLifecycle.tasks['elementalist.core.release-rock-barrier'];
    const result = runElementalist([{ type: 'wait', durationMs: 4000 }], config, {
      catalog: (catalog) =>
        withSkill(withProfile(catalog, TRAIT.GEOMANCERS_TRAINING, { rechargeMultiplier: 0.5 }), ID.ROCK_BARRIER, {
          flipDuration: 1,
          rechargeMultiplier: 0.75
        }),
      timeline: [
        {
          at: 1,
          run(runtime) {
            const root = runtime.helpers.skillsById.get(ID.ROCK_BARRIER);
            assert.equal(elementalistProfession.runtimeFor(config).rechargeWork(runtime, root, root.cooldown), 0);
            runtime.profession.core.spearNextRechargeReduction = true;
            open(runtime);
            assert.equal(runtime.cooldownController.hasCooldown(root.id), false);
          }
        },
        ...(release === 'manual' ? [{ at: 1.5, run: close }] : []),
        {
          at: 3,
          run(runtime) {
            const progress = runtime.cooldownController.rechargeFor(ID.ROCK_BARRIER);
            assert.equal(progress.startedAt, release === 'manual' ? 1.5 : 2);
            assert.equal(progress.work, 3);
            close(runtime);
            assert.deepEqual(runtime.cooldownController.rechargeFor(ID.ROCK_BARRIER), progress);
            assert.equal(runtime.profession.core.spearNextRechargeReduction, true);
          }
        }
      ]
    });
    assert.deepEqual(result.warnings, []);
  });
}
