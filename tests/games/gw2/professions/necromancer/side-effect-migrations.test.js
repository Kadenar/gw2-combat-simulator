import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Weeping Shots awards 1.5% per landed bullet, including later bullets when the first misses.
test('Weeping Shots life force follows landed bullets and partial channels', () => {
  for (const [command, missFirst, percent] of [
    [{}, false, 9],
    [{ interruptAfterMs: 400 }, false, 3],
    [{}, true, 7.5]
  ]) {
    const config = { specialization: 'Core', primaryWeapon: 'Pistol', initialResource: 0, selectedTraitIds: [] };
    const native = necromancerProfession.runtimeFor(config);
    const result = observeGw2Runtime({
      config,
      rotation: [
        { type: 'cast', skillId: ID.WEEPING_SHOTS, ...command },
        { type: 'wait', durationMs: 1000 }
      ],
      profession: {
        ...native,
        prepareEvent(runtime, event) {
          const prepared = native.prepareEvent(runtime, event);
          return prepared && missFirst && prepared.type === 'damage' && prepared.hitIndex === 1
            ? { ...prepared, offTarget: true }
            : prepared;
        }
      }
    });
    assert.deepEqual(result.warnings, []);
    const pool = observedRuntime(result).profession.core.lifeForce;
    assert.ok(
      Math.abs(pool.value - (pool.maximum * percent) / 100) < 1e-8,
      JSON.stringify({ command, missFirst, percent, pool })
    );
  }
});

// Removing a selected spear strike removes its reward, while a landed packet keeps the shard owner's cap and expiry.
test('spear shard reactions belong to selected accepted strike effects', () => {
  for (const [skillId, amount] of [
    [ID.DEADLY_SLICE, 1],
    [ID.SINISTER_STAB, 1],
    [ID.EXTIRPATE, 2]
  ]) {
    for (const mode of ['landed', 'missed', 'removed']) {
      const config = { specialization: 'Core', primaryWeapon: 'Spear', selectedTraitIds: [] };
      const native = necromancerProfession.runtimeFor(config);
      const result = observeGw2Runtime({
        config,
        rotation: [
          ...(skillId === ID.DEADLY_SLICE
            ? [ID.DARK_SLASH]
            : skillId === ID.SINISTER_STAB
              ? [ID.DARK_SLASH, ID.DEADLY_SLICE]
              : []),
          { type: 'cast', skillId, offTarget: mode === 'missed' },
          { type: 'wait', durationMs: 1000 }
        ],
        profession: {
          ...native,
          onCastStart(runtime, cast) {
            native.onCastStart(runtime, cast);
            if (cast.skill.id === skillId) runtime.profession.core.soulShardGrant.charges = 0;
          },
          modifyEffects(runtime, cast, effects) {
            const selected = native.modifyEffects(runtime, cast, effects);
            return mode === 'removed' && cast.skill.id === skillId
              ? selected.filter((effect) => effect.type !== 'strike')
              : selected;
          }
        }
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(observedRuntime(result).profession.core.soulShardGrant.charges, mode === 'landed' ? amount : 0);
    }
  }
});

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
