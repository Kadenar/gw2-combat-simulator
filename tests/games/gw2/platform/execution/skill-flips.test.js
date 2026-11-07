import assert from 'node:assert/strict';
import test from 'node:test';

import { createSkillFlipController } from '#gw2/platform/execution/skill-flip-controller.js';
import {
  armSkillFlip,
  consumeSkillFlip,
  expireSkillFlip,
  skillFlipReady,
  skillFlipVisible
} from '#gw2/platform/execution/skill-flips.js';

// Uses share their grant identity and expiry, so consuming a charge cannot extend access or defeat cleanup.
test('charged flips deplete one use at a time and expire all unspent uses', () => {
  const flips = {};
  const grant = armSkillFlip(flips, 1, 0, 10, 0, undefined, 3);
  assert.equal(grant.remainingUses, 3);
  consumeSkillFlip(flips, 1);
  assert.deepEqual(flips[1], { ...grant, remainingUses: 2 });
  const detached = JSON.parse(JSON.stringify(flips));
  consumeSkillFlip(detached, 1);
  assert.deepEqual(detached[1], { ...grant, remainingUses: 1 });
  consumeSkillFlip(detached, 1);
  assert.equal(detached[1], undefined);
  expireSkillFlip(flips, 1, 10, grant.identity);
  assert.equal(flips[1], undefined);

  const old = armSkillFlip(flips, 1, 0, 10, 0, undefined, 3);
  consumeSkillFlip(flips, 1);
  const replacement = armSkillFlip(flips, 1, 5, 15, 5, undefined, 3);
  assert.equal(expireSkillFlip(flips, 1, 10, old.identity), undefined);
  assert.equal(flips[1], replacement);
  assert.equal(replacement.remainingUses, 3);
  for (const uses of [0, -1, 1.5, Infinity, NaN, '3'])
    assert.throws(() => armSkillFlip({}, 1, 0, 10, 0, undefined, uses), RangeError);
});

// One serialized window must retain visibility, readiness, and exact expiry without a second flag or deadline.
test('flip visibility and readiness use separate half-open windows', () => {
  const flips = {};
  const window = armSkillFlip(flips, 1, 0.1 + 0.2, 0.6, 0.1);
  for (const [at, visible, ready] of [
    [0.099999, false, false],
    [0.1, true, false],
    [0.299999, true, false],
    [0.3, true, true],
    [0.300001, true, true],
    [0.599999, true, true],
    [0.6, false, false],
    [0.600001, false, false]
  ]) {
    assert.equal(skillFlipVisible(window, at), visible);
    assert.equal(skillFlipReady(window, at), ready);
  }

  assert.deepEqual(JSON.parse(JSON.stringify(flips)), flips);
  assert.equal(expireSkillFlip(flips, 1, 0.599999), undefined);
  assert.equal(expireSkillFlip(flips, 1, 0.6), window);
  assert.equal(flips[1], undefined);
});

// Replacing or consuming a choice invalidates captured work even if the replacement has identical timestamps.
test('stale flip expiry cannot consume a rearmed window', () => {
  const flips = {};
  const old = armSkillFlip(flips, 1, 0, 5);
  const replacement = armSkillFlip(flips, 1, 0, 5);
  assert.equal(expireSkillFlip(flips, 1, 5, old.identity), undefined);
  assert.equal(flips[1], replacement);
  assert.equal(consumeSkillFlip(flips, 1), replacement);
  const rearmed = armSkillFlip(flips, 1, 0, 5);
  assert.notEqual(rearmed.identity, replacement.identity);
  assert.equal(expireSkillFlip(flips, 1, 5, replacement.identity), undefined);
  assert.equal(expireSkillFlip(flips, 1, 5, rearmed.identity), rearmed);
});

// Persistent choices survive expiry checks and JSON round trips; finite siblings still expire independently.
test('persistent flips survive expiry checks and repeated simulations are deterministic', () => {
  const flips = {};
  const permanent = armSkillFlip(flips, 1, 0);
  assert.deepEqual(permanent, armSkillFlip({}, 1, 0));
  armSkillFlip(flips, 2, 0, 3);
  expireSkillFlip(flips, 1, 100);
  expireSkillFlip(flips, 2, 100);
  assert.deepEqual(Object.keys(flips), ['1']);
  assert.equal(skillFlipReady(JSON.parse(JSON.stringify(permanent)), 100), true);
  assert.equal(consumeSkillFlip(flips, 1), permanent);
  assert.equal(consumeSkillFlip(flips, 1), undefined);
  assert.throws(() => armSkillFlip(flips, 1, NaN), RangeError);
  assert.throws(() => armSkillFlip(flips, 1, 2, 1), RangeError);
  assert.throws(() => armSkillFlip(flips, 1, 1, 2, 1.5), RangeError);
});

// Live lifecycle operations read one injected clock and schedule only finite expiry claims.
test('flip controller preserves replacement identity and consumption deadlines', () => {
  const clock = { time: 2 };
  const scheduled = [];
  const controller = createSkillFlipController({ clock, scheduleExpiry: (...args) => scheduled.push(args) });
  assert.deepEqual(scheduled, []);
  const old = controller.armFlip(1, { expiresAt: 5 });
  const replacement = controller.armFlip(1, { expiresAt: 5, uses: 2 });
  controller.consumeFlip(1);
  assert.equal(controller.flips[1].availableAt, 2);
  assert.equal(controller.flips[1].expiresAt, 5);
  assert.equal(controller.flips[1].remainingUses, 1);
  clock.time = 5;
  assert.equal(controller.expireFlip(1, old.identity), undefined);
  assert.equal(controller.flips[1].identity, replacement.identity);
  assert.equal(controller.expireFlip(1, replacement.identity).identity, replacement.identity);
  controller.armFlip(2);
  assert.equal(scheduled.length, 2);
  controller.clearFlip(2);
  assert.equal(controller.flips[2], undefined);
});
