import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';
import { ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';

// Small authored skills isolate reservation ownership from profession damage and cast timing data.
function commitmentScheduler(ammo = false) {
  return createScheduler({
    profession: defineProfession({
      id: 'recharge-commit',
      name: 'Recharge Commit',
      catalog: createCanonicalCatalog({
        generated: [
          {
            id: 980001,
            name: 'Long Cast',
            castTimeMs: 1000,
            cooldown: 10,
            ...(ammo ? { ammo: 2, ammoRecharge: 10, ammoCastLockout: 6 } : {}),
            effects: []
          },
          { id: 980002, name: 'Concurrent Cast', castTimeMs: 0, cooldown: 10, effects: [] }
        ]
      }),
      resources: { createProfessionState: () => ({ charges: 1, commits: [], reject: false }) },
      castRules: {
        availability: ({ state }) =>
          state.profession.reject
            ? { ready: false, retryAt: null, code: 'test.rejected', reason: 'Intentionally unavailable.' }
            : { ready: true },
        modifyRechargeDuration: (_context, duration) => duration / 2,
        commitRechargeDuration: [
          ({ state, skill }, duration) => {
            state.profession.commits.push(skill.id);
            if (!state.profession.charges) return duration;
            state.profession.charges -= 1;
            return duration / 2;
          },
          (_context, duration) => duration * 0.8
        ]
      }
    })
  });
}

test('queries and ammo initialization do not commit; overlapping casts retain their selected recharge', () => {
  for (const ammo of [false, true]) {
    const scheduler = commitmentScheduler(ammo);
    const { context, state } = scheduler;
    const skill = context.catalog.skillsById.get(980001);
    assert.equal(context.rechargeDurationFor(skill, 2), 5);
    assert.equal(context.rechargeDurationFor(skill, 2), 5);
    context.cooldownController.ensureAmmo(skill);
    assert.equal(state.profession.charges, 1);
    assert.deepEqual(state.profession.commits, []);

    assert.equal(scheduler.cast({ type: 'cast', skillId: skill.id }), true);
    assert.equal(state.profession.charges, 0);
    assert.equal(scheduler.cast({ type: 'cast', skillId: 980002, concurrentOffsetMs: 100 }), true);
    // A new grant while the first cast is in flight belongs to a later cast.
    state.profession.charges = 1;
    scheduler.advanceTo(1);
    assert.equal(state.profession.charges, 1);
    assert.deepEqual(state.profession.commits, [980001, 980002]);
    assert.equal(state.cooldowns.get(980002), 4.1);
    if (ammo) {
      assert.equal(state.ammo.get(skill.id).rechargeDuration, 2);
      assert.equal(state.ammo.get(skill.id).nextRechargeAt, 3);
      assert.equal(state.ammo.get(skill.id).lockoutReadyAt, 4);
      assert.equal(state.cooldowns.get(skill.id), 4);
    } else {
      assert.equal(state.cooldowns.get(skill.id), 3);
    }

    assert.deepEqual(scheduler.warnings, []);
  }
});

test('unavailable and cancelled attempts leave recharge entitlements unspent', () => {
  const scheduler = commitmentScheduler();
  scheduler.state.profession.reject = true;
  assert.equal(scheduler.cast({ type: 'cast', skillId: 980001 }), false);
  assert.deepEqual(scheduler.warnings, ['Intentionally unavailable.']);
  scheduler.state.profession.reject = false;
  assert.equal(scheduler.cast({ type: 'cast', skillId: 980001, interruptAfterMs: 100 }), true);
  scheduler.advanceTo(1);
  assert.equal(scheduler.events.find((event) => event.type === 'action').cancelled, true);
  assert.equal(scheduler.state.profession.charges, 1);
  assert.deepEqual(scheduler.state.profession.commits, []);
});

test('non-cast recharge queries supply their requested time to legacy start-based rules', () => {
  const scheduler = createScheduler({
    profession: defineProfession({
      id: 'recharge-time',
      name: 'Recharge Time',
      castRules: { modifyRechargeDuration: ({ start }, duration) => (start < 5 ? duration / 2 : duration) }
    })
  });
  const skill = { id: 980001, cooldown: 10 };
  assert.equal(scheduler.context.rechargeDurationFor(skill, 4), 5);
  assert.equal(scheduler.context.rechargeDurationFor(skill, 5), 10);
  assert.equal(scheduler.state.time, 0);
});

test('Elementalist queries preserve Core and Evoker benefits; an eligible cast consumes both once', () => {
  const scheduler = createScheduler({
    profession: elementalistProfession,
    config: {
      specialization: 'Evoker',
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Dagger',
      startAttunement: 'Fire',
      selectedTraitIds: [ELEMENTALIST_TRAIT_IDS.ELEMENTAL_BALANCE]
    }
  });
  const { context, state } = scheduler;
  const core = state.profession.core;
  const evoker = state.profession.specialization.state;
  core.spearNextRechargeReduction = true;
  core.dazingDischargeUntil = 10;
  evoker.elementalBalanceUntil = 10;
  const before = structuredClone(state.profession);
  // Evoker's bulk-reduction caller visits all weapons, including skills that are already ready.
  for (const skill of context.catalog.skills.filter((candidate) => candidate.type === 'Weapon')) {
    assert.equal(context.rechargeDurationFor(skill, 1), context.rechargeDurationFor(skill, 1));
  }

  assert.deepEqual(state.profession, before);

  const skill = context.catalog.skillsByName.get('Raging Ricochet');
  const persistent = context.rechargeDurationFor(skill);
  assert.equal(scheduler.cast({ type: 'cast', skillId: skill.id }), true);
  assert.equal(core.spearNextRechargeReduction, true);
  assert.equal(core.dazingDischargeUntil, 0);
  assert.equal(evoker.elementalBalanceUntil, 0);
  const action = scheduler.events.find((event) => event.type === 'action');
  assert.ok(Math.abs(action.rechargeReadyAt - action.endsAt - persistent * 0.67 * 0.34) < 1e-9);
  core.dazingDischargeUntil = 20;
  evoker.elementalBalanceUntil = 20;
  scheduler.advanceTo(action.endsAt);
  assert.equal(core.dazingDischargeUntil, 20);
  assert.equal(evoker.elementalBalanceUntil, 20);
  assert.deepEqual(scheduler.warnings, []);
});

test('spear recharge empowerment survives an autoattack and belongs to the next non-autoattack cast', () => {
  const scheduler = createScheduler({
    profession: elementalistProfession,
    config: { primaryWeapon: 'Spear', startAttunement: 'Fire' }
  });
  const { context, state } = scheduler;
  state.profession.core.spearNextRechargeReduction = true;
  const auto = context.catalog.skillsByName.get('Flame Spear');
  assert.equal(scheduler.cast({ type: 'cast', skillId: auto.id }), true);
  assert.equal(state.profession.core.spearNextRechargeReduction, true);
  const skill = context.catalog.skillsByName.get('Blazing Barrage');
  const persistent = context.rechargeDurationFor(skill);
  assert.equal(scheduler.cast({ type: 'cast', skillId: skill.id }), true);
  assert.equal(state.profession.core.spearNextRechargeReduction, false);
  const action = scheduler.events.find((event) => event.type === 'action' && event.skillId === skill.id);
  assert.ok(Math.abs(action.rechargeReadyAt - action.endsAt - persistent * 0.67) < 1e-9);
  assert.deepEqual(scheduler.warnings, []);
});

test('expired pistol and Elemental Balance windows cannot discount a new cast', () => {
  const scheduler = createScheduler({
    profession: elementalistProfession,
    config: {
      specialization: 'Evoker',
      primaryWeapon: 'Pistol',
      startAttunement: 'Fire',
      selectedTraitIds: [ELEMENTALIST_TRAIT_IDS.ELEMENTAL_BALANCE]
    }
  });
  const { context, state } = scheduler;
  state.profession.core.dazingDischargeUntil = 1;
  state.profession.specialization.state.elementalBalanceUntil = 1;
  scheduler.advanceTo(1);
  const skill = context.catalog.skillsByName.get('Raging Ricochet');
  const persistent = context.rechargeDurationFor(skill);
  assert.equal(scheduler.cast({ type: 'cast', skillId: skill.id }), true);
  const action = scheduler.events.find((event) => event.type === 'action');
  assert.ok(Math.abs(action.rechargeReadyAt - action.endsAt - persistent) < 1e-9);
  assert.deepEqual(scheduler.warnings, []);
});

test('Antiquary preserves charges across queries and consumes FIFO once per utility, including preparation arming', () => {
  const scheduler = createScheduler({
    profession: thiefProfession,
    config: { specialization: 'Antiquary', selectedSkills: ['Prepare Thousand Needles', 'Prepare Pitfall'] }
  });
  const { context, state } = scheduler;
  const antiquary = state.profession.specialization.state;
  scheduler.advanceTo(1);
  antiquary.holoUtilityCooldownReductionExpirations = [0, 5, 10];
  antiquary.holoUtilityCooldownReductionExpiresAt = 10;
  const placement = context.catalog.skillsByName.get('Prepare Thousand Needles');
  const persistent = context.rechargeDurationFor(placement, 1);
  const before = structuredClone(antiquary);
  assert.equal(context.rechargeDurationFor(placement, 1), persistent);
  context.rechargeDurationFor(context.catalog.skillsByName.get('Backstab'), 1);
  assert.deepEqual(antiquary, before);

  assert.equal(scheduler.cast({ type: 'cast', skillId: placement.id }), true);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, [10]);
  const action = scheduler.events.find((event) => event.type === 'action');
  assert.ok(Math.abs(action.rechargeReadyAt - action.at - persistent * 0.2) < 1e-9);
  scheduler.advanceTo(action.endsAt);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, [10]);
  assert.equal(antiquary.holoUtilityCooldownReductionExpiresAt, 10);

  const pitfall = context.catalog.skillsByName.get('Prepare Pitfall');
  assert.equal(scheduler.cast({ type: 'cast', skillId: pitfall.id }), true);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, []);
  assert.equal(antiquary.holoUtilityCooldownReductionExpiresAt, 0);
  assert.deepEqual(scheduler.warnings, []);
});

// Exercise the real profession gates and completion hooks, beyond the shared scheduler cancellation check.
test('rejected and cancelled Elementalist casts preserve empowerments for the next committed weapon cast', () => {
  const scheduler = createScheduler({
    profession: elementalistProfession,
    config: {
      specialization: 'Evoker',
      primaryWeapon: 'Pistol',
      startAttunement: 'Fire',
      selectedTraitIds: [ELEMENTALIST_TRAIT_IDS.ELEMENTAL_BALANCE]
    }
  });
  const { context, state } = scheduler;
  const core = state.profession.core;
  const evoker = state.profession.specialization.state;
  core.dazingDischargeUntil = 10;
  evoker.elementalBalanceUntil = 10;
  const explosion = context.catalog.skillsByName.get('Elemental Explosion');
  assert.equal(scheduler.cast({ type: 'cast', skillId: explosion.id }), false);
  assert.equal(scheduler.warnings.length, 1);
  assert.match(scheduler.warnings[0], /requires all four elemental bullets/);
  assert.equal(core.dazingDischargeUntil, 10);
  assert.equal(evoker.elementalBalanceUntil, 10);

  const ricochet = context.catalog.skillsByName.get('Raging Ricochet');
  assert.equal(scheduler.cast({ type: 'cast', skillId: ricochet.id, interruptAfterMs: 0 }), true);
  scheduler.advanceTo(0);
  assert.equal(scheduler.events.find((event) => event.type === 'action').cancelled, true);
  assert.equal(core.dazingDischargeUntil, 10);
  assert.equal(evoker.elementalBalanceUntil, 10);
  const salvo = context.catalog.skillsByName.get('Searing Salvo');
  assert.equal(scheduler.cast({ type: 'cast', skillId: salvo.id }), true);
  assert.equal(core.dazingDischargeUntil, 0);
  assert.equal(evoker.elementalBalanceUntil, 0);
  assert.equal(scheduler.warnings.length, 1);
});

test('Holo-Dancer charges survive healing, unavailable utilities, and cancellation, then expire independently', () => {
  const scheduler = createScheduler({
    profession: thiefProfession,
    config: {
      specialization: 'Antiquary',
      selectedSkills: ['Hide in Shadows', 'Prepare Thousand Needles', 'Prepare Pitfall']
    }
  });
  const { context, state } = scheduler;
  const antiquary = state.profession.specialization.state;
  antiquary.holoUtilityCooldownReductionExpirations = [30, 40];
  antiquary.holoUtilityCooldownReductionExpiresAt = 40;
  const heal = context.catalog.skillsByName.get('Hide in Shadows');
  assert.equal(scheduler.cast({ type: 'cast', skillId: heal.id }), true);
  scheduler.advanceTo(scheduler.events.find((event) => event.type === 'action').endsAt);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, [30, 40]);
  const unselected = context.catalog.skillsByName.get("Assassin's Signet");
  assert.equal(scheduler.cast({ type: 'cast', skillId: unselected.id }), false);
  assert.equal(scheduler.warnings.length, 1);
  assert.match(scheduler.warnings[0], /not equipped/);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, [30, 40]);

  const needles = context.catalog.skillsByName.get('Prepare Thousand Needles');
  assert.equal(scheduler.cast({ type: 'cast', skillId: needles.id, interruptAfterMs: 0 }), true);
  scheduler.advanceTo(state.time);
  const cancelled = scheduler.events.find((event) => event.type === 'action' && event.skillId === needles.id);
  assert.equal(cancelled.cancelled, true);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, [30, 40]);
  const pitfall = context.catalog.skillsByName.get('Prepare Pitfall');
  assert.equal(scheduler.cast({ type: 'cast', skillId: pitfall.id }), true);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, [40]);
  assert.equal(antiquary.holoUtilityCooldownReductionExpiresAt, 40);

  scheduler.advanceTo(40);
  const persistent = context.rechargeDurationFor(needles);
  assert.equal(scheduler.cast({ type: 'cast', skillId: needles.id }), true);
  const action = scheduler.events.findLast((event) => event.type === 'action');
  assert.equal(action.rechargeReadyAt - action.at, persistent);
  assert.deepEqual(antiquary.holoUtilityCooldownReductionExpirations, []);
  assert.equal(antiquary.holoUtilityCooldownReductionExpiresAt, 0);
  assert.equal(scheduler.warnings.length, 1);
});
