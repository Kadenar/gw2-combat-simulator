import assert from 'node:assert/strict';
import test from 'node:test';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Both finishers grant exactly one live reduction after commitment, preserving other weapons and proc reporting.
test('Gleam Saber declarations reduce only other sword recharges after commitment', () => {
  for (const [specialization, first, second, finisher, target] of [
    [
      'Core',
      ID.SUN_EDGE_NON_HOLOSMITH,
      ID.SUN_RIPPER_NON_HOLOSMITH,
      ID.GLEAM_SABER_NON_HOLOSMITH,
      ID.REFRACTION_CUTTER_NON_HOLOSMITH
    ],
    ['Holosmith', ID.SUN_EDGE, ID.SUN_RIPPER, ID.GLEAM_SABER, ID.REFRACTION_CUTTER]
  ]) {
    for (const cancelled of [false, true]) {
      const result = runEngineer(
        [first, second, { type: 'cast', skillId: finisher, interruptAfterMs: cancelled ? 100 : 400 }],
        {
          specialization,
          primaryWeapon: 'Sword',
          secondaryWeapon: 'Pistol',
          boons: { quickness: true }
        },
        {
          extend: (native) => ({
            catalog: withSkill(native.catalog, finisher, {
              castTimeMs: 1000,
              interruptCommitMs: 200,
              retainsCastLockoutAfterInterrupt: false
            })
          }),
          initialize(runtime) {
            for (const skillId of [target, ID.POISON_DART_VOLLEY])
              runtime.cooldownController.startRecharge(runtime.helpers.skillsById.get(skillId), 0, 60);
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(runtime.cooldowns.get(target), cancelled ? 48 : 47.2);
      assert.equal(runtime.cooldowns.get(ID.POISON_DART_VOLLEY), 48);
      const procs = result.events.filter((event) => event.type === 'proc' && event.sourceId === finisher);
      assert.equal(procs.length, cancelled ? 0 : 1);
      if (!cancelled) assert.equal(procs[0].cooldownReduction, 0.8);
    }
  }
});

// Removing a declaration must remove its intrinsic state change, without an ID-based hook restoring it.
test('Engineer lifecycle state follows the skill declarations', () => {
  for (const [skillId, config, active] of [
    [ID.GRENADE_KIT, { selectedSkills: ['Grenade Kit'] }, (state) => state.activeKit === ID.GRENADE_KIT],
    [ID.ENGAGE_PHOTON_FORGE, { specialization: 'Holosmith' }, (state) => state.photonForgeActive],
    [ID.EVOLVE_BASE, { specialization: 'Amalgam' }, (state) => state.evolvedUntil > 0],
    [
      ID.PLASMATIC_STATE,
      { specialization: 'Amalgam', selectedSkills: ['Plasmatic State'] },
      (state) => state.plasmaticStateUntil > 0
    ],
    [
      ID.HEALING_TURRET,
      { selectedSkills: ['Healing Turret'] },
      (state) => Boolean(state.availableFlips[ID.DETONATE_HEALING_TURRET])
    ]
  ]) {
    for (const declared of [true, false]) {
      const result = runEngineer([skillId], config, {
        extend: (native) => (declared ? {} : { catalog: withSkill(native.catalog, skillId, { sideEffects: [] }) })
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(active(result.planningState.profession), declared, String(skillId));
    }
  }
});

// Pending mines belong to their committed activation and cannot be recreated by the combat-boundary observer.
test('precast Mine Field requires its declaration to release damage at combat start', () => {
  for (const declared of [true, false]) {
    const result = runEngineer(
      [ID.MINE_FIELD, { type: 'wait', durationMs: 1000 }, '__combat_start'],
      { selectedSkills: ['Throw Mine'] },
      {
        observation: { kind: 'tail', durationMs: 1000 },
        extend: (native) => (declared ? {} : { catalog: withSkill(native.catalog, ID.MINE_FIELD, { sideEffects: [] }) })
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.type === 'damage' && event.skillId === ID.MINE_FIELD),
      declared
    );
    assert.deepEqual(observedRuntime(result).profession.core.pendingMineFieldActivationIds, []);
  }
});

// All three slot identities must retain Core-trait, intrinsic-retaliation, then Morph-trait ordering.
test('grouped Thorns variants own retaliation independently of their Morph trait rewards', () => {
  for (const [slot, skillId] of [
    ID.DEFENSIVE_PROTOCOL_THORNS_ID_77163,
    ID.DEFENSIVE_PROTOCOL_THORNS_ID_77104,
    ID.DEFENSIVE_PROTOCOL_THORNS
  ].entries()) {
    const selectedMorphSkillIds = [77103, 77203, 76954];
    selectedMorphSkillIds[slot] = skillId;
    for (const declared of [true, false]) {
      const result = runEngineer(
        [skillId],
        {
          specialization: 'Amalgam',
          selectedMorphSkillIds,
          selectedTraitIds: [TRAIT.STATIC_DISCHARGE, TRAIT.NEW_GENES],
          professionAssumptions: { inDamagingField: true }
        },
        {
          extend: (native) => (declared ? {} : { catalog: withSkill(native.catalog, skillId, { sideEffects: [] }) })
        }
      );
      assert.deepEqual(result.warnings, []);
      const core = result.events.findIndex((event) => event.name === 'Static Discharge');
      const retaliation = result.events.findIndex((event) => event.name === 'Thorns Retaliation');
      const morph = result.events.findIndex((event) => event.name === 'New Genes');
      assert.ok(core >= 0 && morph > core);
      if (declared) assert.ok(retaliation > core && retaliation < morph);
      else assert.equal(retaliation, -1);
    }
  }
});

// Canonical cannon edits change packets without removing the mech lane's reservation or its later resumption.
test('Overclock declaration and cannon payload independently own activation and damage', () => {
  const results = ['baseline', 'remove-strike', 'remove-trigger'].map((mode) =>
    runEngineer(
      [ID.OVERCLOCK_SIGNET, { type: 'wait', durationMs: 6000 }],
      { specialization: 'Mechanist', selectedSkills: ['Overclock Signet'] },
      {
        extend(native) {
          if (mode === 'baseline') return {};
          const id = mode === 'remove-trigger' ? ID.OVERCLOCK_SIGNET : ID.JADE_BUSTER_CANNON;
          return {
            catalog: withSkill(
              native.catalog,
              id,
              mode === 'remove-trigger'
                ? { sideEffects: [] }
                : { effects: native.catalog.skillsById.get(id).effects.filter((effect) => effect.type !== 'strike') }
            )
          };
        }
      }
    )
  );
  const [baseline, removed, untriggered] = results;
  for (const result of results) assert.deepEqual(result.warnings, []);
  const cannon = (result, type) =>
    result.events.filter((event) => event.type === type && event.skillId === ID.JADE_BUSTER_CANNON);
  assert.ok(cannon(baseline, 'damage').length > 0);
  assert.deepEqual(cannon(removed, 'damage'), []);
  const conditions = (result) =>
    cannon(result, 'condition').map(({ at, stacks, duration, actorType, summonOwner, independentConditionOwner }) => ({
      at,
      stacks,
      duration,
      actorType,
      summonOwner,
      independentConditionOwner
    }));
  assert.deepEqual(conditions(removed), conditions(baseline));
  const busyUntil = baseline.planningState.profession.mech.busyUntil;
  assert.ok(busyUntil > 0);
  assert.equal(removed.planningState.profession.mech.busyUntil, busyUntil);
  for (const result of [baseline, removed]) {
    const autos = result.events.filter((event) => event.type === 'damage' && event.mechBasicAttack);
    assert.ok(autos.length > 0);
    assert.ok(autos.every((event) => event.at >= busyUntil && event.actorType === 'summon'));
  }

  assert.deepEqual(cannon(untriggered, 'damage'), []);
  assert.deepEqual(cannon(untriggered, 'condition'), []);
  assert.equal(untriggered.planningState.profession.mech.busyUntil, 0);
});
