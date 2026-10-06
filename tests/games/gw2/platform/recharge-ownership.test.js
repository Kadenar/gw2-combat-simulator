import assert from 'node:assert/strict';
import test from 'node:test';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { gw2RechargeIntervals } from '#gw2/platform/combat/recharge.js';

const magazine = { id: 1, name: 'Magazine', ammo: 3, ammoRecharge: 5 };
const ordinary = { id: 2, name: 'Ordinary', cooldown: 10 };
const preserved = { id: 3, name: 'Preserved', cooldown: 20 };
function fixture() {
  const state = { time: 0 };
  const catalog = new Map([magazine, ordinary, preserved].map((skill) => [skill.id, skill]));
  const controller = createCooldownController({
    clock: state,
    skillFor: (id) => catalog.get(id),
    rechargeDuration: (skill) => skill.ammoRecharge ?? skill.cooldown
  });
  return { state, controller };
}

// Magazine reservation consumes charges now without advancing existing pools to a future completion anchor.
test('reserved magazine rounds recharge serially from their future anchor', () => {
  const { controller } = fixture();
  controller.ensureAmmo(magazine);
  assert.equal(controller.reserveAmmo(magazine, 2, { startedAt: 4, work: 5 }), 2);
  assert.equal(controller.readAmmo(1).charges, 1);
  assert.equal(controller.refreshAmmo(magazine, 3).charges, 1);
  controller.spendAmmo(magazine, 4, 5);
  assert.equal(controller.refreshAmmo(magazine, 9).charges, 1);
  assert.equal(controller.refreshAmmo(magazine, 14).charges, 2);
});

// Checkpoint ownership includes earned work, queued rounds and independent exclusions, without aliasing live stores.
test('recharge checkpoints restore relative work and preserve explicitly excluded live cooldowns', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0);
  controller.setReadyAt(preserved.id, 20);
  controller.spendAmmo(magazine, 0);
  controller.spendAmmo(magazine, 0);
  const excluded = new Set([preserved.id]);
  const saved = controller.checkpoint(2, excluded, 'independent');
  assert.deepEqual(saved.ammo.get(1).pendingRechargeWork, [3, 5]);
  controller.resetAll();
  controller.setReadyAt(preserved.id, 140);
  state.time = 100;
  controller.restoreCheckpoint(saved, 100, excluded, []);
  assert.equal(controller.readyAt(ordinary.id), 108);
  assert.equal(controller.readyAt(preserved.id), 140);
  assert.equal(controller.refreshAmmo(magazine, 103).charges, 2);
  assert.equal(controller.refreshAmmo(magazine, 108).charges, 3);
  assert.deepEqual(saved.ammo.get(1).pendingRechargeWork, [3, 5]);
});

// Linked identities share one queue; replacement and retirement remain explicit service-owned operations.
test('linked and temporary ammo pools share charges until explicitly retired', () => {
  const { controller } = fixture();
  controller.ensureAmmo(magazine);
  controller.linkAmmo(1, 9);
  controller.spendAmmo(magazine, 0);
  assert.equal(controller.readAmmo(9).charges, 2);
  controller.replaceAmmoCharges(magazine, 2, 2, []);
  assert.equal(controller.readAmmo(9).charges, 2);
  controller.replaceAmmoCharges(magazine, 1, 0, [{ startedAt: 0, work: 5 }]);
  assert.equal(controller.refreshAmmo(magazine, 5).charges, 1);
  controller.retireAmmo(9);
  assert.equal(controller.hasAmmo(9), false);
  assert.equal(controller.hasAmmo(1), true);
});

// Formula readiness keeps sub-tick precision and refreshes only the requested magazine on the live clock.
test('live readiness owns ordinary progress and ammo settlement', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0, 0.015);
  state.time = 0.01;
  assert.equal(controller.isOnCooldown(ordinary.id), true);
  state.time = 0.02;
  assert.equal(controller.isOnCooldown(ordinary.id), false);
  assert.equal(controller.readyAt(ordinary.id), 0.015);
  assert.throws(() => controller.isOnCooldown(ordinary.id, 1), /current clock/);

  const other = { ...magazine, id: 99 };
  for (let i = 0; i < 3; i++) {
    controller.spendAmmo(magazine, 0);
    controller.spendAmmo(other, 0);
  }

  state.time = 5;
  assert.equal(controller.isOnCooldown(magazine.id), false);
  assert.equal(controller.readAmmo(magazine.id).charges, 1);
  assert.equal(controller.readAmmo(other.id).charges, 0);
});

// Expose interval reads so tests can distinguish cached deadlines from recomputation without timing benchmarks.
function rateFixture(skills) {
  const state = { time: 0, windows: [{ start: -Infinity, end: Infinity, active: false }] };
  const intervalReads = [];
  const catalog = new Map(skills.map((skill) => [skill.id, skill]));
  const controller = createCooldownController({
    clock: state,
    skillFor: (id) => catalog.get(id),
    rechargeDuration: (skill) => skill.cooldown,
    rechargeIntervals(skill, start, end) {
      intervalReads.push(skill.id);
      return gw2RechargeIntervals(1.25, () => state.windows, skill, start, end);
    }
  });
  return { state, intervalReads, controller };
}

// Clock advances and live queries reuse fixed projections, but completed work remains available to mechanics.
test('constant-rate deadlines are cached and completed recharge progress is retained', () => {
  for (const metadata of [
    {},
    { rechargeBuffAudience: 'self' },
    { rechargeIgnoresAlacrity: true },
    { rechargeBuffAudience: 'summon', rechargeIgnoresAlacrity: true }
  ]) {
    const skill = { ...ordinary, ...metadata };
    const { state, intervalReads, controller } = rateFixture([skill]);
    const readyAt = controller.startRecharge(skill, 0, 10);
    const progress = controller.rechargeFor(skill.id);
    intervalReads.length = 0;
    for (const at of [readyAt - 1, readyAt, readyAt + 1]) {
      state.time = at;
      controller.refresh(at);
      assert.equal(controller.isOnCooldown(skill.id), at < readyAt);
      assert.equal(controller.readyAt(skill.id), readyAt);
      assert.equal(controller.rechargeFor(skill.id), progress);
    }

    assert.deepEqual(intervalReads, []);
  }
});

// Copy and explicit reductions publish new deadlines even when routine refresh no longer projects player work.
test('cached cooldowns reflect reductions and copied recharge immediately', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0);
  state.time = 2;
  assert.equal(controller.reduceSkillRecharge(ordinary, 3), 3);
  assert.equal(controller.readyAt(ordinary.id), 7);
  controller.copy(ordinary.id, preserved.id);
  assert.equal(controller.readyAt(preserved.id), 7);
  assert.deepEqual(controller.rechargeFor(preserved.id), { startedAt: 2, work: 5 });
  assert.notEqual(controller.rechargeFor(preserved.id), controller.rechargeFor(ordinary.id));
  state.time = 7;
  controller.refresh(7);
  assert.equal(controller.isOnCooldown(ordinary.id), false);
  assert.equal(controller.isOnCooldown(preserved.id), false);
  assert.deepEqual(controller.rechargeFor(ordinary.id), { startedAt: 2, work: 5 });
});

// A received boon can change live readiness before refresh; copied summon identities follow the recipient's rate.
test('summon recharge observes received Alacrity on demand and during refresh', () => {
  const summon = { ...ordinary, id: 4, rechargeBuffAudience: 'summon' };
  const { state, intervalReads, controller } = rateFixture([ordinary, summon]);
  controller.startRecharge(ordinary, 0, 10);
  controller.copy(ordinary.id, summon.id);
  controller.refresh(0);
  assert.equal(controller.readyAt(summon.id), 10);
  state.time = 2;
  assert.equal(controller.isOnCooldown(summon.id), true);
  state.windows = [
    { start: -Infinity, end: 2, active: false },
    { start: 2, end: 6, active: true },
    { start: 6, end: Infinity, active: false }
  ];
  intervalReads.length = 0;
  assert.equal(controller.isOnCooldown(summon.id), true);
  assert.deepEqual(intervalReads, [summon.id]);
  state.time = 9;
  assert.equal(controller.isOnCooldown(summon.id), false);
  assert.equal(controller.readyAt(summon.id), 10);
  controller.refresh(9);
  assert.equal(controller.readyAt(summon.id), 9);
  assert.deepEqual(controller.rechargeFor(summon.id), { startedAt: 0, work: 10 });
});

// Restoring earned work uses the new timeline immediately, without relying on a later global refresh.
test('checkpoint restoration projects work before returning', () => {
  const summon = { ...ordinary, id: 4, rechargeBuffAudience: 'summon' };
  const { state, controller } = rateFixture([ordinary, summon]);
  for (const skill of [ordinary, summon]) controller.startRecharge(skill, 0, 10);
  const saved = controller.checkpoint(2, new Set(), ordinary.id);
  assert.equal(saved.remainingCooldowns.has(ordinary.id), false);
  controller.resetAll();
  state.time = 100;
  state.windows = [
    { start: -Infinity, end: 100, active: false },
    { start: 100, end: 120, active: true },
    { start: 120, end: Infinity, active: false }
  ];
  controller.restoreCheckpoint(saved, 100, new Set(), []);
  assert.equal(controller.readyAt(ordinary.id), 106);
  assert.equal(controller.readyAt(summon.id), 106.4);
  assert.equal(controller.isOnCooldown(ordinary.id), true);
  assert.deepEqual(controller.rechargeFor(summon.id), { startedAt: 100, work: 8 });
});
