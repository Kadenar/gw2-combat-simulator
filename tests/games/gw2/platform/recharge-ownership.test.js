import assert from 'node:assert/strict';
import test from 'node:test';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';

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
test('reserved magazine rounds recharge serially from their future anchor and retain lockouts', () => {
  const { controller } = fixture();
  controller.ensureAmmo(magazine);
  controller.setAmmoLockout(magazine, 20, 0);
  assert.equal(controller.reserveAmmo(magazine, 2, { startedAt: 4, work: 5 }), 2);
  assert.equal(controller.readAmmo(1).charges, 1);
  assert.equal(controller.refreshAmmo(magazine, 3).charges, 1);
  controller.spendAmmo(magazine, 4, 5);
  assert.equal(controller.refreshAmmo(magazine, 9).charges, 1);
  assert.equal(controller.refreshAmmo(magazine, 14).charges, 2);
  assert.equal(controller.readAmmo(1).lockoutReadyAt, 20);
});

// Checkpoint ownership includes earned work, queued rounds and independent exclusions, without aliasing live stores.
test('recharge checkpoints restore relative work and preserve explicitly excluded live cooldowns', () => {
  const { state, controller } = fixture();
  controller.startRecharge(ordinary, 0);
  controller.setReadyAt(preserved.id, 20);
  controller.spendAmmo(magazine, 0);
  controller.spendAmmo(magazine, 0);
  controller.setAmmoLockout(magazine, 20, 0);
  const excluded = new Set([preserved.id]);
  const saved = controller.checkpoint(2, excluded, 'independent');
  assert.deepEqual(saved.ammo.get(1).pendingRechargeWork, [3, 5]);
  controller.resetAll();
  controller.setReadyAt(preserved.id, 140);
  state.time = 100;
  controller.restoreCheckpoint(saved, 100, excluded, []);
  controller.refresh(100);
  assert.equal(controller.readyAt(ordinary.id), 108);
  assert.equal(controller.readyAt(preserved.id), 140);
  assert.equal(controller.refreshAmmo(magazine, 103).charges, 2);
  assert.equal(controller.refreshAmmo(magazine, 108).charges, 3);
  assert.equal(controller.readAmmo(1).lockoutReadyAt, 118);
  assert.deepEqual(saved.ammo.get(1).pendingRechargeWork, [3, 5]);
});

// Linked identities share one queue; replacement and retirement remain explicit service-owned operations.
test('linked and temporary ammo pools preserve their independent lockout until explicitly reset', () => {
  const { controller } = fixture();
  controller.ensureAmmo(magazine);
  controller.linkAmmo(1, 9);
  controller.spendAmmo(magazine, 0);
  assert.equal(controller.readAmmo(9).charges, 2);
  controller.setAmmoLockout(magazine, 20, 0);
  controller.replaceAmmoCharges(magazine, 2, 2, []);
  assert.equal(controller.readAmmo(9).charges, 2);
  assert.equal(controller.readAmmo(1).lockoutReadyAt, 20);
  controller.replaceAmmoCharges(magazine, 1, 0, [{ startedAt: 0, work: 5 }]);
  assert.equal(controller.refreshAmmo(magazine, 5).charges, 1);
  controller.clearAmmoLockout(1);
  assert.equal(controller.readAmmo(9).lockoutReadyAt, 0);
  controller.retireAmmo(9);
  assert.equal(controller.hasAmmo(9), false);
  assert.equal(controller.hasAmmo(1), true);
});

// Formula readiness keeps sub-tick precision and refreshes only the requested magazine on the live clock.
test('live readiness owns ordinary progress, ammo settlement, and independent lockouts', () => {
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
  controller.setAmmoLockout(magazine, 2, 5);
  assert.equal(controller.isOnCooldown(magazine.id), true);
  state.time = 7;
  assert.equal(controller.isOnCooldown(magazine.id), false);
});
