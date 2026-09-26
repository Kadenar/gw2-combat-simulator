import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { projectThiefPlanningState } from '#gw2/professions/thief/family-state.js';
import { runtimeFor } from '#tests/helpers/live-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Persistent queries cannot consume one-shot benefits; reservation spends them once on an eligible cast.
test('Elementalist queries preserve Core and Evoker benefits; an eligible cast consumes both once', () => {
  const config = {
    specialization: 'Evoker',
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Dagger',
    startAttunement: 'Fire',
    selectedTraitIds: [ELEMENTALIST_TRAIT_IDS.ELEMENTAL_BALANCE]
  };
  const native = elementalistProfession.liveRuntimeFor(config),
    skill = native.catalog.skillsByName.get('Raging Ricochet');
  const result = runElementalist({
    config,
    rotation: [skill.id],
    initialize: (r) => {
      Object.assign(r.profession.core, { spearNextRechargeReduction: true, dazingDischargeUntil: 10 });
      r.profession.specialization.state.elementalBalanceUntil = 10;
      const before = structuredClone(r.profession);
      for (const weapon of native.catalog.skills.filter((s) => s.type === 'Weapon'))
        native.rechargeWork(r, weapon, weapon.cooldown);
      assert.deepEqual(r.profession, before);
    },
    timeline: [
      {
        at: 0.001,
        run: (r) => {
          assert.equal(r.profession.core.dazingDischargeUntil, 0);
          assert.equal(r.profession.specialization.state.elementalBalanceUntil, 0);
          r.profession.core.dazingDischargeUntil = 20;
          r.profession.specialization.state.elementalBalanceUntil = 20;
        }
      }
    ]
  });
  const r = runtimeFor(result),
    action = result.events.find((e) => e.type === 'action');
  assert.ok(Math.abs(r.cooldowns.get(skill.id) - action.endsAt - skill.cooldown * 0.67 * 0.34) < 1e-9);
  assert.equal(r.profession.core.spearNextRechargeReduction, true);
  assert.equal(r.profession.core.dazingDischargeUntil, 20);
  assert.equal(r.profession.specialization.state.elementalBalanceUntil, 20);
  assert.deepEqual(result.warnings, []);
});

test('spear recharge empowerment survives an autoattack and belongs to the next non-autoattack cast', () => {
  const skill = elementalistProfession.catalog.skillsByName.get('Blazing Barrage');
  const auto = runElementalist({
    config: { primaryWeapon: 'Spear' },
    rotation: ['Flame Spear'],
    initialize: (r) => {
      r.profession.core.spearNextRechargeReduction = true;
    }
  });
  assert.equal(runtimeFor(auto).profession.core.spearNextRechargeReduction, true);
  const result = runElementalist({
    config: { primaryWeapon: 'Spear' },
    rotation: ['Flame Spear', skill.id],
    initialize: (r) => {
      r.profession.core.spearNextRechargeReduction = true;
    }
  });
  const action = result.events.find((e) => e.type === 'action' && e.skillId === skill.id);
  assert.equal(runtimeFor(result).profession.core.spearNextRechargeReduction, false);
  assert.ok(Math.abs(runtimeFor(result).cooldowns.get(skill.id) - action.endsAt - skill.cooldown * 0.67) < 1e-9);
  assert.deepEqual(result.warnings, []);
});

test('expired pistol and Elemental Balance windows cannot discount a new cast', () => {
  const skill = elementalistProfession.catalog.skillsByName.get('Raging Ricochet');
  const result = runElementalist({
    config: {
      specialization: 'Evoker',
      primaryWeapon: 'Pistol',
      selectedTraitIds: [ELEMENTALIST_TRAIT_IDS.ELEMENTAL_BALANCE]
    },
    rotation: [{ type: 'wait', durationMs: 1000 }, skill.id],
    initialize: (r) => {
      r.profession.core.dazingDischargeUntil = 1;
      r.profession.specialization.state.elementalBalanceUntil = 1;
    }
  });
  const action = result.events.find((e) => e.type === 'action');
  assert.ok(Math.abs(runtimeFor(result).cooldowns.get(skill.id) - action.endsAt - skill.cooldown) < 1e-9);
  assert.deepEqual(result.warnings, []);
});

test('Antiquary preserves charges across queries and consumes FIFO once per utility, including preparation arming', () => {
  const config = { specialization: 'Antiquary', selectedSkills: ['Prepare Thousand Needles', 'Prepare Pitfall'] };
  const native = thiefProfession.liveRuntimeFor(config);
  const placement = thiefProfession.catalog.skillsByName.get('Prepare Thousand Needles');
  const rotation = [{ type: 'wait', durationMs: 1000 }, 'Prepare Thousand Needles', 'Prepare Pitfall'];
  const holo = (runtime) => runtime.profession.specialization.state.holoUtilityCooldownReductionExpirations;
  const projected = (runtime) =>
    projectThiefPlanningState({ profession: runtime.profession, time: runtime.time })
      .holoUtilityCooldownReductionExpirations;
  const observed = {};
  const recharge = (result) => runtimeFor(result).cooldowns.get(placement.id) - 1;
  const persistent = recharge(runThief(rotation.slice(0, 2), config));
  const result = runThief(rotation, config, {
    initialize(runtime) {
      // Grant order differs from expiry order: the first live grant must be consumed first.
      runtime.profession.specialization.state.holoUtilityCooldownReductionExpirations = [0, 10, 5];
    },
    probes: [
      [
        1,
        (runtime) => {
          observed.projected = projected(runtime);
          observed.keys = [
            Object.hasOwn(runtime.profession.specialization.state, 'holoUtilityCooldownReductionExpiresAt'),
            Object.hasOwn(snapshotProfessionState(runtime.profession), 'holoUtilityCooldownReductionExpiresAt')
          ];
          // Recharge queries are pure; only an accepted cast reserves an entitlement.
          const before = structuredClone(holo(runtime));
          native.rechargeWork(runtime, placement, 10);
          native.rechargeWork(runtime, thiefProfession.catalog.skillsByName.get('Backstab'), 10);
          observed.afterQueries = [...holo(runtime)];
          observed.before = before;
        }
      ],
      [1.0005, (runtime) => (observed.afterNeedles = [[...holo(runtime)], projected(runtime)])]
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(observed.projected, [10, 5]);
  assert.deepEqual(observed.keys, [false, false]);
  assert.deepEqual(observed.afterQueries, observed.before);
  assert.deepEqual(observed.afterNeedles, [[5], [5]]);
  assert.ok(Math.abs(recharge(result) - persistent * 0.2) < 1e-9);
  assert.deepEqual(holo(runtimeFor(result)), []);
  assert.deepEqual(result.planningState.profession.holoUtilityCooldownReductionExpirations, []);
});

// Rejection and precommit cancellation leave discounts available for the next committed weapon activation.
test('rejected and cancelled Elementalist casts preserve empowerments for the next committed weapon cast', () => {
  const config = {
    specialization: 'Evoker',
    primaryWeapon: 'Pistol',
    selectedTraitIds: [ELEMENTALIST_TRAIT_IDS.ELEMENTAL_BALANCE]
  };
  const ricochet = elementalistProfession.catalog.skillsByName.get('Raging Ricochet');
  const rotation = ['Elemental Explosion', { type: 'cast', skillId: ricochet.id, interruptAfterMs: 0 }];
  const initialize = (r) => {
    r.profession.core.dazingDischargeUntil = 10;
    r.profession.specialization.state.elementalBalanceUntil = 10;
  };

  const cancelled = runElementalist({ config, rotation, initialize });
  assert.equal(cancelled.warnings.length, 1);
  assert.match(cancelled.warnings[0], /requires all four elemental bullets/);
  assert.equal(runtimeFor(cancelled).profession.core.dazingDischargeUntil, 10);
  assert.equal(runtimeFor(cancelled).profession.specialization.state.elementalBalanceUntil, 10);
  const committed = runElementalist({ config, rotation: [...rotation, 'Searing Salvo'], initialize });
  assert.equal(runtimeFor(committed).profession.core.dazingDischargeUntil, 0);
  assert.equal(runtimeFor(committed).profession.specialization.state.elementalBalanceUntil, 0);
  assert.equal(committed.warnings.length, 1);
});

test('Holo-Dancer charges survive healing, unavailable utilities, and cancellation, then expire independently', () => {
  const config = {
    specialization: 'Antiquary',
    selectedSkills: ['Hide in Shadows', 'Prepare Thousand Needles', 'Prepare Pitfall']
  };
  const needles = thiefProfession.catalog.skillsByName.get('Prepare Thousand Needles');
  const holo = (runtime) => [...runtime.profession.specialization.state.holoUtilityCooldownReductionExpirations];
  const projected = (runtime, time = runtime.time) =>
    projectThiefPlanningState({ profession: runtime.profession, time }).holoUtilityCooldownReductionExpirations;
  const observed = [];
  const rotation = [
    'Hide in Shadows',
    "Assassin's Signet",
    { type: 'cast', skillId: needles.id, interruptAfterMs: 0 },
    'Prepare Pitfall',
    { type: 'wait', durationMs: 40000 },
    'Prepare Thousand Needles'
  ];
  const result = runThief(rotation, config, {
    initialize(runtime) {
      runtime.profession.specialization.state.holoUtilityCooldownReductionExpirations = [30, 35, 40];
    },
    // Heal, rejected, and cancelled casts spend nothing; the committed utility spends the oldest entry.
    probes: [
      [
        20,
        (runtime) => observed.push(holo(runtime), projected(runtime), projected(runtime, 35), projected(runtime, 40))
      ]
    ]
  });
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /not equipped/);
  const cancelled = result.events.find((event) => event.type === 'action' && event.skillId === needles.id);
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual(observed, [[35, 40], [35, 40], [40], []]);

  // After natural expiry the final utility receives its full recharge and finds nothing to spend.
  const last = result.steps.at(-1);
  const recharge = runtimeFor(result).cooldowns.get(needles.id) - last.start / 1000;
  const persistent = runtimeFor(runThief(['Prepare Thousand Needles'], config)).cooldowns.get(needles.id) - 0;
  assert.ok(Math.abs(recharge - persistent) < 1e-9);
  assert.deepEqual(result.planningState.profession.holoUtilityCooldownReductionExpirations, []);
});
