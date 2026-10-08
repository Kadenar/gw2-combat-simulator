import { castReachedFullDuration, castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Completion and interruption partition finite scheduler instants without an early-completion grace window.
test('cast lifecycle distinguishes adjacent microseconds at completion', () => {
  for (const [effectiveEnd, interrupted] of [
    [0.999999, true],
    [1, false],
    [1.000001, false]
  ]) {
    const cast = { fullEnd: 1, effectiveEnd };
    assert.equal(castWasInterrupted(cast), interrupted);
    assert.equal(castReachedFullDuration(cast), !interrupted);
  }
});

test('cast lifecycle treats arithmetic representations of the same scheduler instant equally', () => {
  for (const cast of [
    { fullEnd: 0.1 + 0.2, effectiveEnd: 0.3 },
    { fullEnd: 0.3, effectiveEnd: 0.1 + 0.2 }
  ]) {
    assert.equal(castWasInterrupted(cast), false);
    assert.equal(castReachedFullDuration(cast), true);
  }
});

test('non-finite cast endpoints cannot establish interruption or completion', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    for (const cast of [
      { fullEnd: invalid, effectiveEnd: 1 },
      { fullEnd: 1, effectiveEnd: invalid }
    ]) {
      assert.equal(castWasInterrupted(cast), false);
      assert.equal(castReachedFullDuration(cast), false);
    }
  }
});
