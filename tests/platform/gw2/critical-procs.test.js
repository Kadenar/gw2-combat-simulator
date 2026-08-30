import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceCriticalProc,
  criticalOpportunity,
  CRITICAL_PROC_PROGRESS_TOLERANCE
} from '#gw2/platform/combat/critical-procs.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/scheduler/critical-facts.js';

function request(overrides = {}) {
  return {
    id: 'fixture.critical-proc',
    at: 0,
    stochastic: false,
    roll: () => false,
    ...overrides
  };
}

test('threshold critical procs retain floating-point progress consistently', () => {
  const state = { progress: 0, readyAt: 0 };
  let quantity = 0;

  for (let hit = 0; hit < 2100; hit += 1) {
    quantity += advanceCriticalProc(criticalOpportunity(1 / 2100), request(), state)?.quantity || 0;
  }

  assert.equal(quantity, 1);
  assert.ok(state.progress <= CRITICAL_PROC_PROGRESS_TOLERANCE);
});

test('weighted critical procs preserve per-hit expected quantity without progress state', () => {
  const application = advanceCriticalProc(
    criticalOpportunity(0.75),
    request({ chanceOnCriticalHit: 1 / 3, materialization: 'weighted' })
  );

  assert.deepEqual(application, { quantity: 0.25, kind: 'weighted' });
});

test('stochastic critical procs consume sampled facts and stable secondary rolls', () => {
  const streams = [];
  const application = advanceCriticalProc(
    { expectedCriticals: 1.5, sampledCriticals: 2 },
    request({
      stochastic: true,
      chanceOnCriticalHit: 0.5,
      randomStream: 'fixture.secondary',
      roll: (_chance, stream) => {
        streams.push(stream);
        return streams.length === 2;
      }
    }),
    { progress: 0, readyAt: 0 }
  );

  assert.deepEqual(application, { quantity: 1, kind: 'sampled' });
  assert.deepEqual(streams, ['fixture.secondary', 'fixture.secondary']);
  assert.throws(
    () => advanceCriticalProc({ expectedCriticals: 0.5 }, request({ stochastic: true }), { progress: 0, readyAt: 0 }),
    /requires sampled criticals/
  );
});

test('critical proc ICDs ignore ineligible hits without progress or random rolls', () => {
  const state = { progress: 0.25, readyAt: 5 };
  let rolls = 0;

  assert.equal(
    advanceCriticalProc(
      { expectedCriticals: 1, sampledCriticals: 1 },
      request({
        at: 4,
        stochastic: true,
        chanceOnCriticalHit: 0.5,
        internalCooldown: 3,
        roll: () => {
          rolls += 1;
          return true;
        }
      }),
      state
    ),
    null
  );
  assert.deepEqual(state, { progress: 0.25, readyAt: 5 });
  assert.equal(rolls, 0);
});

test('legacy ICD banking must be selected explicitly', () => {
  const ignored = { progress: 0.25, readyAt: 5 };
  const accumulated = { ...ignored };

  advanceCriticalProc(criticalOpportunity(0.5), request({ at: 4, internalCooldown: 3 }), ignored);
  advanceCriticalProc(
    criticalOpportunity(0.5),
    request({ at: 4, internalCooldown: 3, progressDuringCooldown: 'accumulate' }),
    accumulated
  );

  assert.equal(ignored.progress, 0.25);
  assert.equal(accumulated.progress, 0.75);
});

test('weighted critical procs reject positive internal cooldowns', () => {
  assert.throws(
    () =>
      advanceCriticalProc(criticalOpportunity(0.5), request({ materialization: 'weighted', internalCooldown: 1 }), {
        progress: 0,
        readyAt: 0
      }),
    /weighted critical proc cannot use an internal cooldown/
  );
});

test('scheduler critical procs adapt canonical chance, sampled facts, and RNG', () => {
  const streams = [];
  const context = {
    config: { randomness: { mode: 'stochastic' } },
    schedulerPolicy: {
      critical: () => ({ chance: 0.75 }),
      rollRandom: (_chance, stream) => {
        streams.push(stream);
        return true;
      }
    }
  };
  const application = advanceScheduledCriticalProc(
    context,
    { type: 'damage', at: 2, coefficient: 1, didCrit: true },
    {
      id: 'fixture.scheduler-critical-proc',
      chanceOnCriticalHit: 0.5,
      randomStream: 'fixture.scheduler-secondary'
    },
    { progress: 0, readyAt: 0 }
  );

  assert.deepEqual(application, { quantity: 1, kind: 'sampled' });
  assert.deepEqual(streams, ['fixture.scheduler-secondary']);
});
