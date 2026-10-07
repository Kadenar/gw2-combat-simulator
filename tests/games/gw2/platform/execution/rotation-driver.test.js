import assert from 'node:assert/strict';
import test from 'node:test';
import { createRotationDriver } from '#gw2/platform/execution/rotation-driver.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';

const skill = { id: 999001, name: 'Retry probe', castTimeMs: 0, effects: [] };
const catalog = createCanonicalCatalog({ generated: [skill] });

// Isolate GW2 retry scheduling from cast durations and the neutral event queue's finer clock.
function retryFixture(time, retryAt) {
  const driver = createRotationDriver({ catalog }, [{ type: 'cast', skillId: skill.id }]);
  const rejected = [];
  const accepted = [];
  const runtime = { time, inputReadyAt: 0, traits: new Set(), mechanicQueries: {} };
  const input = {
    runtime,
    evaluateReadiness: () =>
      runtime.time >= retryAt ? { ready: true } : { ready: false, retryAt, reason: 'Waiting', code: 'test.wait' },
    advanceFrontier() {},
    reject: (reason) => rejected.push(reason),
    acceptCast: () => accepted.push(runtime.time)
  };
  return { driver, input, rejected, accepted };
}

test('GW2 future retries round up to absolute 40 ms ticks without rounding a deadline backward', () => {
  for (const [time, retryAt, expected] of [
    [0, 0.0000004, 0.04],
    [0, 0.04, 0.04],
    [0, 0.0400004, 0.08],
    [0, 0.28, 0.28],
    [0, 1.5, 1.52],
    [0.039999, 0.0400004, 0.08],
    [9.99995, 10, 10],
    [-0.08, -0.0399996, 0]
  ]) {
    const { driver, input, rejected, accepted } = retryFixture(time, retryAt);
    const next = driver.advance(input);
    assert.equal(next, expected);
    assert.deepEqual(accepted, []);
    input.runtime.time = next;
    assert.equal(driver.advance(input), 'handled');
    assert.deepEqual(accepted, [expected]);
    assert.deepEqual(rejected, []);
  }
});

test('GW2 retry rounding does not repair nonfuture or nonfinite denials', () => {
  // An invalid readiness contract must reject instead of repeatedly pushing the command into another tick.
  for (const retryAt of [1, 0.999999, NaN, Infinity, -Infinity]) {
    const { driver, input, rejected, accepted } = retryFixture(1, retryAt);
    input.evaluateReadiness = () => ({ ready: false, retryAt, reason: 'Waiting', code: 'test.wait' });
    assert.equal(driver.advance(input), 'handled');
    assert.deepEqual(rejected, ['Waiting (no future retry boundary).']);
    assert.deepEqual(accepted, []);
  }
});
