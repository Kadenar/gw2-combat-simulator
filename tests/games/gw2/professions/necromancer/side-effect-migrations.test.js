import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Distress resets Perforate before awarding capped shards; grants retain the weapon owner's scheduled expiry.
test('Distress declares its shard grant after recharge reset and expires it through the shared shard owner', () => {
  const config = { specialization: 'Core', primaryWeapon: 'Spear', selectedTraitIds: [] };
  const native = necromancerProfession.runtimeFor(config);
  let resetBeforeGrant = false;
  const result = observeGw2Runtime({
    config,
    rotation: [ID.ISOLATE, ID.DISTRESS, { type: 'wait', durationMs: 10001 }],
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize(runtime);
        runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(ID.PERFORATE), 0, 60);
      },
      sideEffectHandlers: {
        ...native.sideEffectHandlers,
        'necromancer.soul-shards'(runtime, cast, action) {
          resetBeforeGrant = !runtime.cooldowns.has(ID.PERFORATE);
          native.sideEffectHandlers['necromancer.soul-shards'](runtime, cast, action);
          assert.equal(runtime.profession.core.soulShardGrant.charges, 6);
          assert.equal(runtime.profession.core.soulShardGrant.expiresAt, runtime.time + 10);
        }
      }
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(resetBeforeGrant, true);
  assert.equal(observedRuntime(result).profession.core.soulShardGrant.charges, 0);
});
