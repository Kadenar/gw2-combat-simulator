import assert from 'node:assert/strict';
import test from 'node:test';
import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Generic charges and Dragon's Roar magazines share the same one-at-a-time recharge contract.
const sequential = { id: 990060, name: 'Sequential ammo', ammo: 6, ammoRecharge: 5 };
const roar = warriorProfession.runtimeFor({ specialization: 'Bladesworn' }).catalog.skillsById.get(ID.DRAGONS_ROAR);
function magazine(skill = sequential, rate = 1) {
  const state = { time: 0 };
  const controller = createCooldownController({
    clock: state,
    rechargeDuration: () => skill.ammoRecharge / rate,
    rechargeIntervals: (_skill, start, end) => [{ start, end, rate }]
  });
  for (let round = 0; round < skill.ammo; round++) controller.spendAmmo(skill, 0);
  return controller;
}

test('ammo naturally recovers one charge per recharge interval', () => {
  for (const rate of [1, 1.25]) {
    const controller = magazine(sequential, rate);
    const interval = 5 / rate;
    assert.equal(controller.refreshAmmo(sequential, interval - 0.001).charges, 0);
    assert.equal(controller.refreshAmmo(sequential, interval).charges, 1);
    assert.equal(controller.refreshAmmo(sequential, interval * 2).charges, 2);
    // A lazy observation must process successive intervals, not recover the entire magazine at once.
    assert.equal(controller.refreshAmmo(sequential, interval * 5).charges, 5);
    assert.equal(controller.refreshAmmo(sequential, interval * 6).charges, 6);
    assert.deepEqual(controller.refreshAmmo(sequential, interval * 6).recharges, []);
  }
});

test('restoring and spending three rounds preserves the serial recharge already running', () => {
  const controller = magazine();
  assert.equal(controller.restoreAmmo(sequential, 3, 2), 3);
  for (let round = 0; round < 3; round++) controller.spendAmmo(sequential, 3);
  assert.equal(controller.refreshAmmo(sequential, 5).charges, 1);
  assert.equal(controller.refreshAmmo(sequential, 8).charges, 1);
  assert.equal(controller.refreshAmmo(sequential, 10).charges, 2);
  // Full restoration clears the queue so the next magazine starts a fresh interval.
  controller.restoreAmmo(sequential, 6, 11);
  controller.spendAmmo(sequential, 12);
  assert.equal(controller.refreshAmmo(sequential, 16).charges, 5);
  assert.equal(controller.refreshAmmo(sequential, 17).charges, 6);
});

test('serial recharge reductions consume work once across the queue and preserve cast lockouts', () => {
  const controller = magazine();
  controller.setAmmoLockout(sequential, 20, 0);
  assert.equal(controller.reduceSkillRecharge(sequential, 7, 2), 7);
  assert.equal(controller.refreshAmmo(sequential, 2).charges, 1);
  assert.equal(controller.refreshAmmo(sequential, 3).charges, 2);
  assert.equal(controller.refreshAmmo(sequential, 8).charges, 3);
  assert.equal(controller.refreshAmmo(sequential, 8).lockoutReadyAt, 20);
});

// Reloads preserve active progress, and reductions apply once across the magazine without shortening lockouts.
test("Dragon's Roar restores and reduces its queued rounds", () => {
  const controller = magazine(roar);
  controller.setAmmoLockout(roar, 20, 0);
  assert.equal(controller.restoreAmmo(roar, 3, 2), 3);
  for (let round = 0; round < 3; round++) controller.spendAmmo(roar, 3);
  assert.equal(controller.refreshAmmo(roar, 5).charges, 1);
  assert.equal(controller.reduceSkillRecharge(roar, 2, 5), 2);
  assert.equal(controller.refreshAmmo(roar, 7.999).charges, 1);
  assert.equal(controller.refreshAmmo(roar, 8).charges, 2);
  assert.equal(controller.refreshAmmo(roar, 8).lockoutReadyAt, 20);
  assert.equal(controller.refreshAmmo(roar, 28).charges, 6);
  assert.deepEqual(controller.refreshAmmo(roar, 28).recharges, []);
});

test("a live Dragon's Roar magazine recovers one round per interval", () => {
  const config = { specialization: 'Bladesworn', secondaryWeapon: 'Pistol', selectedTraitIds: [] };
  const result = observeGw2Runtime({
    profession: warriorProfession.runtimeFor(config),
    config,
    rotation: [ID.DRAGONS_ROAR, { type: 'wait', durationMs: 8500 }]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).cooldownController.readAmmo(ID.DRAGONS_ROAR).charges, 2);
});

test("Dragon's Roar begins natural recovery when its magazine is reserved", () => {
  const config = { specialization: 'Bladesworn', secondaryWeapon: 'Pistol', selectedTraitIds: [] };
  const result = observeGw2Runtime({
    profession: warriorProfession.runtimeFor(config),
    config,
    rotation: [ID.DRAGONS_ROAR]
  });
  const runtime = observedRuntime(result);
  const skill = runtime.helpers.skillsById.get(ID.DRAGONS_ROAR);
  const startedAt = result.steps[0].start / 1000;
  assert.deepEqual(result.warnings, []);
  assert.equal(runtime.cooldownController.refreshAmmo(skill, startedAt + 3.999).charges, 0);
  assert.equal(runtime.cooldownController.refreshAmmo(skill, startedAt + 4).charges, 1);
  assert.equal(runtime.cooldownController.refreshAmmo(skill, startedAt + 8).charges, 2);
  assert.equal(runtime.cooldownController.refreshAmmo(skill, startedAt + 24).charges, 6);
});
