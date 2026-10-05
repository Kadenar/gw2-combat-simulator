import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { rangerPetCombatMetadata } from '#gw2/professions/ranger/core/mechanics/pets.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// Removing a declaration must remove its intrinsic transition, rather than leave a second skill-ID dispatcher.
test('Ranger activation declarations are the sole owners of their grants and transitions', () => {
  for (const [specialization, skillId, prefix, read, initial] of [
    [
      'Core',
      ID.SHARPENING_STONE,
      [],
      (r) => r.profession.core.sharpeningStoneGrants.reduce((sum, grant) => sum + grant.charges, 0),
      0
    ],
    ['Core', ID.DOUBLE_ARC, [], (r) => r.profession.core.poisonousStrikes.charges, 0],
    ['Core', ID.CRIPPLING_SHOT, [], (r) => r.profession.core.bloodThirst.charges, 0],
    ['Core', ID.WINTERS_BITE, [], (r) => r.profession.core.winterBiteReady, false],
    ['Core', ID.PET_SWAP, [], (r) => r.profession.core.activePetSlot, 1],
    ['Druid', ID.CELESTIAL_AVATAR, [], (r) => r.profession.specialization.state.celestialAvatarActive, false],
    ['Soulbeast', ID.LEAVE_BEASTMODE, [], (r) => r.profession.specialization.state.beastmodeActive, true],
    ['Soulbeast', ID.ONE_WOLF_PACK, [], (r) => r.profession.specialization.state.oneWolfPackUntil, 0],
    ['Untamed', ID.UNLEASH_RANGER, [], (r) => r.profession.specialization.state.rangerUnleashed, false],
    ['Galeshot', ID.SUMMON_CYCLONE_BOW, [], (r) => r.profession.specialization.state.cycloneBowActive, false],
    ['Galeshot', ID.MISTRAL, [], (r) => r.profession.specialization.state.mistralUntil, 0],
    ['Galeshot', ID.BLUSTER, [ID.SUMMON_CYCLONE_BOW], (r) => r.profession.specialization.state.arrows.value, 8]
  ]) {
    const result = runRanger(
      [...prefix, skillId],
      { specialization, initialUntamedState: 'Pet' },
      {
        extend: (native) => ({ catalog: withSkill(native.catalog, skillId, { sideEffects: [], effects: [] }) })
      }
    );
    assert.deepEqual(result.warnings, [], String(skillId));
    assert.equal(read(observedRuntime(result)), initial, String(skillId));
  }
});

// Recasts retain replacement versus independently expiring additive pools; failed finite casts grant nothing.
test('declared charge grants preserve replacement, additive expiry, and cancellation', () => {
  for (const [skillId, type, pool] of [
    [ID.SHARPENING_STONE, 'ranger.sharpening-stone', 'sharpeningStoneGrants'],
    [ID.DOUBLE_ARC, 'ranger.poisonous-strikes', 'poisonousStrikes'],
    [ID.CRIPPLING_SHOT, 'ranger.blood-thirst', 'bloodThirst']
  ]) {
    const extend = (native) => ({ catalog: withSkill(native.catalog, skillId, { effects: [], cooldown: 0 }) });
    const result = runRanger([skillId, wait(1000), skillId], {}, { extend });
    assert.deepEqual(result.warnings, []);
    const grants = result.events.filter((event) => event.type === type);
    assert.equal(grants.length, 2);
    const state = observedRuntime(result).profession.core[pool];
    if (Array.isArray(state)) {
      assert.deepEqual(
        state,
        grants.map((grant) => ({ charges: grant.charges, expiresAt: grant.at + grant.duration, readyAt: 0 }))
      );
    } else {
      assert.equal(state.charges, grants[1].charges);
      assert.equal(state.expiresAt, grants[1].at + grants[1].duration);
      const cancelled = runRanger([{ type: 'cast', skillId, interruptMs: 1 }], {}, { extend });
      assert.deepEqual(cancelled.warnings, []);
      assert.equal(observedRuntime(cancelled).profession.core[pool].charges, 0);
    }
  }
});

// Only committed summons schedule Solar Flare's delayed slam, honoring removal of its profile packet.
test('committed Sun Spirit emits its surviving child on the first slam', () => {
  for (const removed of [false, true]) {
    for (const cancelled of [false, true]) {
      const result = runRanger(
        [{ type: 'cast', skillId: ID.SUN_SPIRIT, ...(cancelled ? { interruptMs: 1 } : {}) }, wait(6500)],
        {},
        {
          extend: (native) => ({
            catalog: removed
              ? applyBalanceProfilePatch(native.catalog, {
                  balanceProfiles: { [PROFILE.sunSpirit]: { removeEffects: [{ type: 'condition', name: 'Burning' }] } }
                })
              : native.catalog
          })
        }
      );
      assert.deepEqual(result.warnings, []);
      const children = result.events.filter((event) => event.type === 'condition' && event.skillId === ID.SOLAR_FLARE);
      assert.equal(children.length > 0, !removed && !cancelled);
      for (const event of children) {
        assert.equal(event.source, 'ranger');
        assert.equal(event.actorType, 'player');
        assert.equal(event.triggeredBy, 'Sun Spirit');
        assert.equal(event.activationId, undefined);
      }

      if (!cancelled)
        assert.ok(result.events.some((event) => event.skillId === ID.SUN_SPIRIT && event.kind === 'might'));
    }
  }
});

// The duration menu remains patchable without accidentally becoming an unconditional boon grant.
test('We Heal As One copies only surviving duration-menu entries', () => {
  const result = runRanger(
    [ID.WE_HEAL_AS_ONE],
    { boons: { might: 10, fury: true } },
    {
      extend(native) {
        return {
          catalog: withSkill(native.catalog, ID.WE_HEAL_AS_ONE, {
            effects: native.catalog.skillsById
              .get(ID.WE_HEAL_AS_ONE)
              .effects.filter((effect) => effect.boon !== 'might')
          })
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const copies = result.events.filter((event) => event.type === 'buff' && event.skillId === ID.WE_HEAL_AS_ONE);
  assert.ok(copies.length > 0);
  assert.ok(copies.every((event) => event.kind === 'fury'));
});

// Acceptance pays arrows even on cancellation; scheduled Wind Force must be visible before commitment.
test('Galeshot pays attempted arrows and schedules Wind Force before the cast commits', () => {
  const probes = [];
  const result = runRanger(
    [ID.SUMMON_CYCLONE_BOW, ID.BLUSTER, wait(100)],
    { specialization: 'Galeshot' },
    {
      extend(native) {
        return {
          catalog: withSkill(native.catalog, ID.BLUSTER, { castTimeMs: 2000, windForceApplyMs: 200, effects: [] }),
          tasks: {
            ...native.tasks,
            'test.wind-force'(runtime) {
              probes.push(runtime.profession.specialization.state.windForce.value);
            }
          }
        };
      },
      initialize(runtime) {
        runtime.schedule('test.wind-force', 0.1);
        runtime.schedule('test.wind-force', 0.3);
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(probes, [0, 1]);
  assert.equal(observedRuntime(result).profession.specialization.state.arrows.value, 7);
  const cancelled = runRanger([ID.SUMMON_CYCLONE_BOW, { type: 'cast', skillId: ID.BLUSTER, interruptMs: 1 }], {
    specialization: 'Galeshot'
  });
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(observedRuntime(cancelled).profession.specialization.state.arrows.value, 7);
  assert.equal(observedRuntime(cancelled).profession.specialization.state.windForce.value, 0);
});

// A queued replacement applies after old-charge consumption, even while the stance queues same-time follow-up work.
test('merged Maul consumes the old charge and leaves one fresh charge after stance observers', () => {
  const result = runRanger(
    [ID.ONE_WOLF_PACK, ID.MAUL_SOULBEAST, wait(300)],
    {
      specialization: 'Soulbeast',
      primaryWeapon: 'Greatsword'
    },
    {
      initialize(runtime) {
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'buff',
            at: 0,
            source: 'test',
            sourceId: 'old-charge',
            actorType: 'effect',
            kind: 'attack-of-opportunity-player',
            duration: 10,
            stacks: 1,
            audience: { recipients: 'self' }
          }
        });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  const active = runtime.buffs
    .get('attack-of-opportunity-player')
    .filter((application) => application.expiresAt > runtime.time);
  assert.equal(active.length, 1);
  assert.equal(active[0].stacks, 1);
  assert.ok(result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.ONE_WOLF_PACK));
});

// Manual exit and re-entry must invalidate the old depletion deadline rather than end the new form.
test('Avatar re-entry survives its previous depletion task', () => {
  const result = runRanger(
    [ID.CELESTIAL_AVATAR, wait(1000), ID.RELEASE_CELESTIAL_AVATAR, wait(1000), ID.CELESTIAL_AVATAR, wait(13500)],
    { specialization: 'Druid', selectedTraitIds: [TRAIT.NATURAL_BALANCE] },
    {
      extend: (native) => ({
        tasks: {
          ...native.tasks,
          'test.refill-avatar'(runtime) {
            runtime.resourceController.grant('astralForce', 100);
            runtime.cooldownController.clear(ID.CELESTIAL_AVATAR);
          }
        }
      }),
      initialize(runtime) {
        runtime.schedule('test.refill-avatar', 1.5);
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).profession.specialization.state.celestialAvatarActive, true);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'sigil_swap').map((event) => event.at),
    [0, 1, 2]
  );
  assert.deepEqual(
    result.events.filter((event) => event.kind === 'natural-balance').map((event) => event.at),
    [0, 1, 2]
  );
});

// Static player reconciliation and independent pet launch snapshots consume the same selected-and-ready value.
test('Signet of the Wild preserves static provenance and pet launch snapshots', () => {
  // Exercise the composed attribute hooks, including their declared ordering, as the runtime does.
  const ranger = rangerProfession.runtimeFor({ specialization: 'Core' });
  const bonus = rangerCatalog.balanceProfilesById.get(PROFILE.signetOfTheWild).attributeBonus;
  for (const selected of [false, true]) {
    for (const preapplied of [false, true]) {
      for (const ready of [false, true]) {
        const context = {
          catalog: rangerCatalog,
          config: {
            selectedSkillIds: selected ? [12491] : [],
            selectedTraitIds: [],
            attributeProvenance: { professionStaticRulesApplied: preapplied }
          },
          time: 0,
          timeline: { skillOnCooldownAt: () => !ready }
        };
        const result = ranger.modifyAttributes(context, { ferocity: preapplied && selected ? bonus : 0 });
        assert.equal(result.ferocity, selected && ready ? bonus : 0);
      }
    }
  }

  const snapshots = [];
  const result = runRanger(
    [ID.SIGNET_OF_THE_WILD, wait(1000)],
    { selectedSkillIds: [12491] },
    {
      initialize(runtime) {
        snapshots.push(rangerPetCombatMetadata(runtime));
      },
      extend: (native) => ({
        onCastCommit(runtime, cast) {
          native.onCastCommit(runtime, cast);
          snapshots.push(rangerPetCombatMetadata(runtime));
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(snapshots[0].summonBaseFerocity - snapshots[1].summonBaseFerocity, bonus);
});
