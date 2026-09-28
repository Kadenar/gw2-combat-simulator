import { canonicalTime } from '#kernel/core/clock.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';

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

// Removing a declared producer must remove its state transition, proving no ambient cast dispatcher still runs it.
test('form, creature, shade, Blight, and weapon-spell producers are selected by their skill declarations', () => {
  for (const [specialization, skillId, preparation, ownsState] of [
    ['Core', ID.DEATH_SHROUD, [], (runtime) => runtime.profession.core.activeShroud === 'death'],
    ['Reaper', ID.REAPERS_SHROUD, [], (runtime) => runtime.profession.core.activeShroud === 'reaper'],
    ['Harbinger', ID.HARBINGER_SHROUD, [], (runtime) => runtime.profession.core.activeShroud === 'harbinger'],
    ['Ritualist', ID.RITUALISTS_SHROUD, [], (runtime) => runtime.profession.core.activeShroud === 'ritualist'],
    ['Core', ID.LICH_FORM, [], (runtime) => runtime.profession.core.activeShroud === 'lich'],
    ['Core', ID.SUMMON_BONE_MINIONS, [], (runtime) => runtime.profession.core.activeMinions['bone-minion'] === 2],
    ['Scourge', ID.MANIFEST_SAND_SHADE, [], (runtime) => runtime.profession.specialization.state.shades.length > 0],
    ['Harbinger', ID.ELIXIR_OF_RISK, [], (runtime) => runtime.profession.specialization.state.blight > 0],
    [
      'Ritualist',
      ID.ANGUISH,
      [ID.RITUALISTS_SHROUD],
      (runtime) => Boolean(runtime.profession.specialization.state.activeSpirits.anguish)
    ],
    [
      'Ritualist',
      ID.NIGHTMARE_WEAPON,
      [],
      (runtime) => Boolean(runtime.profession.specialization.state.weaponSpells.nightmare)
    ]
  ]) {
    for (const enabled of [true, false]) {
      const config = { specialization, initialResource: 100, initialBlight: 0, selectedTraitIds: [] };
      const native = necromancerProfession.runtimeFor(config);
      const result = observeGw2Runtime({
        config,
        profession: enabled
          ? native
          : {
              ...native,
              catalog: withSkill(native.catalog, skillId, { sideEffects: [] })
            },
        rotation: [...preparation, skillId, { type: 'wait', durationMs: 1000 }]
      });
      assert.deepEqual(result.warnings, [], `${specialization}: ${skillId}`);
      assert.equal(ownsState(observedRuntime(result)), enabled, `${specialization}: ${skillId}`);
    }
  }
});

// Recharge-scaled windows use each accepted interval, while precommit cancellation cannot acquire a follow-up.
test('Isolate declares its recharge-anchored flip across varying reservations and cancellations', () => {
  const config = { specialization: 'Core', primaryWeapon: 'Spear', selectedTraitIds: [] };
  const native = necromancerProfession.runtimeFor(config);
  for (const duration of [1000, 2000]) {
    for (const fraction of [0.25, 0.75, 1]) {
      let accepted;
      const result = observeGw2Runtime({
        config,
        profession: {
          ...native,
          catalog: withSkill(native.catalog, ID.ISOLATE, { castTimeMs: duration, interruptCommitMs: duration / 2 }),
          onCastStart(runtime, cast) {
            native.onCastStart(runtime, cast);
            accepted = cast;
          }
        },
        rotation: [{ type: 'cast', skillId: ID.ISOLATE, interruptAfterMs: duration * fraction }]
      });
      assert.deepEqual(result.warnings, []);
      const flip = observedRuntime(result).profession.core.availableFlips[ID.DISTRESS];
      if (fraction < 0.5) assert.equal(flip, undefined);
      else assert.ok(Math.abs(flip.expiresAt - (accepted.rechargeStart + accepted.skill.flipDuration)) < 1e-8);
      assert.equal(
        accepted.rechargeStart,
        canonicalTime(accepted.start + ((accepted.effectiveEnd - accepted.start) * 11) / 12)
      );
    }
  }
});

// Haunt's selected summon reaction owns the percentage conversion; stripping it leaves the hit but removes the gain.
test('Haunt grants Gluttony-scaled life force only through its selected accepted strike reaction', () => {
  for (const mode of ['landed', 'missed', 'no-reaction', 'no-strike']) {
    const config = { specialization: 'Core', initialResource: 0, selectedTraitIds: [TRAIT.GLUTTONY] };
    const native = necromancerProfession.runtimeFor(config);
    const skill = native.catalog.skillsById.get(ID.HAUNT);
    const effects =
      mode === 'no-strike'
        ? skill.effects.filter((effect) => effect.type !== 'strike')
        : mode === 'no-reaction'
          ? skill.effects.map((effect) => ({ ...effect, reactions: [] }))
          : skill.effects;
    const result = observeGw2Runtime({
      config,
      profession: {
        ...native,
        catalog: withSkill(native.catalog, ID.HAUNT, { effects })
      },
      rotation: [
        ID.SUMMON_SHADOW_FIEND,
        { type: 'cast', skillId: ID.HAUNT, offTarget: mode === 'missed' },
        { type: 'wait', durationMs: 2500 }
      ]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.core.lifeForce.value, mode === 'landed' ? 11 : 0);
  }
});

// Blood Is Power retains its explicit packet-committed cancellation exception, independent of target acceptance.
test('Corruption local work separates semantic commitment from the canceled opening-packet exception', () => {
  for (const [interruptAfterMs, removeStrike, gains] of [
    [400, false, false],
    [600, false, true],
    [600, true, false],
    [900, true, true]
  ]) {
    const config = { specialization: 'Core', initialResource: 0, selectedTraitIds: [] };
    const native = necromancerProfession.runtimeFor(config);
    const skill = native.catalog.skillsById.get(ID.BLOOD_IS_POWER);
    const local = skill.effects.filter((effect) => effect.type === 'boon' || effect.target === 'self');
    const result = observeGw2Runtime({
      config,
      profession: {
        ...native,
        catalog: withSkill(native.catalog, skill.id, {
          castTimeMs: 1000,
          interruptCommitMs: 800,
          effects: [
            ...(removeStrike
              ? []
              : [{ type: 'strike', coefficient: 1, atMs: 500, timingAnchor: 'castStart', timingScale: 'fixed' }]),
            ...local
          ]
        })
      },
      rotation: [{ type: 'cast', skillId: skill.id, interruptAfterMs, offTarget: true }]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.core.selfConditions.length > 0, gains);
    const might = result.resolvedEvents.filter((event) => event.kind === 'might' && event.skillId === skill.id);
    assert.equal(might.length, Number(gains));
    if (gains) assert.equal(might[0].at, interruptAfterMs / 1000);
  }
});

// Acceptance pays exactly once even when canceled; the shared gate still rejects before any pool mutation.
test('Scourge declared costs retain vitality scaling and interrupted acceptance semantics', () => {
  for (const vitality of [1000, 2000]) {
    for (const initialResource of [0, 100]) {
      const config = { specialization: 'Scourge', initialResource, stats: { vitality }, selectedTraitIds: [] };
      const native = necromancerProfession.runtimeFor(config);
      const result = observeGw2Runtime({
        config,
        profession: {
          ...native,
          catalog: withSkill(native.catalog, ID.NEFARIOUS_FAVOR, { castTimeMs: 1000 })
        },
        rotation: [{ type: 'cast', skillId: ID.NEFARIOUS_FAVOR, interruptAfterMs: 100 }]
      });
      const core = observedRuntime(result).profession.core;
      if (initialResource) {
        assert.deepEqual(result.warnings, []);
        assert.ok(Math.abs(core.lifeForce.value - (100 - 21 * core.lifeForceCostMultiplier)) < 1e-8);
      } else {
        assert.equal(core.lifeForce.value, 0);
        assert.equal(result.warnings.length, 1);
        assert.match(result.warnings[0], /life force/);
      }
    }
  }
});
