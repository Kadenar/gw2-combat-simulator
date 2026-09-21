import assert from 'node:assert/strict';
import test from 'node:test';
import {
  armSkillFlip,
  consumeSkillFlip,
  expireSkillFlip,
  pruneSkillFlips,
  skillFlipReady,
  skillFlipVisible
} from '#gw2/platform/engine/skills/skill-flips.js';

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

// Persistent choices survive pruning and JSON round trips; finite siblings still expire independently.
test('persistent flips survive pruning and repeated simulations are deterministic', () => {
  const flips = {};
  const permanent = armSkillFlip(flips, 1, 0);
  assert.deepEqual(permanent, armSkillFlip({}, 1, 0));
  armSkillFlip(flips, 2, 0, 3);
  pruneSkillFlips(flips, 100);
  assert.deepEqual(Object.keys(flips), ['1']);
  assert.equal(skillFlipReady(JSON.parse(JSON.stringify(permanent)), 100), true);
  assert.equal(consumeSkillFlip(flips, 1), permanent);
  assert.equal(consumeSkillFlip(flips, 1), undefined);
  assert.throws(() => armSkillFlip(flips, 1, NaN), RangeError);
  assert.throws(() => armSkillFlip(flips, 1, 2, 1), RangeError);
  assert.throws(() => armSkillFlip(flips, 1, 1, 2, 1.5), RangeError);
});
