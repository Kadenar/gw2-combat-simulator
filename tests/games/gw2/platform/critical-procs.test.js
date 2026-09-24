import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/critical-procs.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';

test('critical procs consume sampled facts and independent secondary rolls', () => {
  const streams = [];
  const request = {
    id: 'fixture',
    at: 0,
    chanceOnCriticalHit: 0.5,
    randomStream: 'secondary',
    roll: (_chance, stream) => {
      streams.push(stream);
      return streams.length === 2;
    }
  };
  assert.equal(advanceCriticalProc(criticalOpportunity(0.5, false), request), null);
  assert.deepEqual(advanceCriticalProc(criticalOpportunity(0.5, true, 2), request), { quantity: 1, kind: 'sampled' });
  assert.deepEqual(streams, ['secondary', 'secondary']);
  assert.throws(() => criticalOpportunity(0.5, undefined), /requires a sampled critical outcome/);
  assert.throws(() => criticalOpportunity(0.5, true, 1.5), /integer/);
  assert.throws(
    () => advanceCriticalProc(criticalOpportunity(1, true), { id: 'fixture', at: 0, chanceOnCriticalHit: 0.5 }),
    /requires a roll/
  );
});

test('critical ICDs block through the canonical deadline without spending secondary rolls', () => {
  const state = { readyAt: 5 };
  let rolls = 0;
  const request = {
    id: 'fixture',
    internalCooldown: 3,
    chanceOnCriticalHit: 0.5,
    roll: () => {
      rolls++;
      return true;
    }
  };
  for (const at of [4, 5, 5.0000001])
    assert.equal(advanceCriticalProc(criticalOpportunity(1, true), { ...request, at }, state), null);
  assert.equal(rolls, 0);
  assert.equal(state.readyAt, 5);
  assert.deepEqual(advanceCriticalProc(criticalOpportunity(1, true), { ...request, at: 5.000001 }, state), {
    quantity: 1,
    kind: 'sampled'
  });
  assert.equal(rolls, 1);
  assert.equal(state.readyAt, 5.000001 + 3);
  assert.ok(advanceCriticalProc(criticalOpportunity(1, true), { ...request, at: 0 }, { readyAt: 0 }));
});

test('scheduler procs use the canonical critical outcome and ignore rejected hits', () => {
  const streams = [];
  const context = {
    schedulerPolicy: {
      critical: () => ({ chance: 0.75 }),
      rollRandom: (_chance, stream) => {
        streams.push(stream);
        return true;
      }
    }
  };
  const event = { type: 'damage', at: 2, coefficient: 1, didCrit: true };
  const request = { id: 'fixture', chanceOnCriticalHit: 0.5 };
  assert.deepEqual(advanceScheduledCriticalProc(context, event, request), { quantity: 1, kind: 'sampled' });
  for (const changes of [{ cancelled: true }, { type: 'marker' }, { offTarget: true }])
    assert.equal(advanceScheduledCriticalProc(context, { ...event, ...changes, didCrit: undefined }, request), null);
  assert.deepEqual(streams, ['fixture']);
});
