import assert from 'node:assert/strict';
import test from 'node:test';

import { advanceCriticalProc, criticalOpportunity } from '#gw2/platform/combat/procs/critical.js';
import { createProcRegistry } from '#gw2/platform/combat/procs/registry.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';

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
  assert.deepEqual(advanceCriticalProc(criticalOpportunity(0.5, true, 2), request), { quantity: 1 });
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
    quantity: 1
  });
  assert.equal(rolls, 1);
  assert.equal(state.readyAt, 5.000001 + 3);
  assert.ok(advanceCriticalProc(criticalOpportunity(1, true), { ...request, at: 0 }, { readyAt: 0 }));
});

test('critical handlers reject nullish cooldown keys at declaration', () => {
  // Invalid untyped declarations cannot accidentally share the registry's stringified undefined/null keys.
  for (const internalCooldown of [{ duration: 1 }, { key: undefined, duration: 1 }, { key: null, duration: 1 }])
    assert.throws(
      () => criticalProcHandler({ id: 'fixture.invalid', internalCooldown, handler() {} }),
      /internal cooldown requires a key/
    );
});

// Registry binding preserves admission order and writes only successful claims before any reentrant reward.
test('critical handlers gate registry reads and reserve successful claims before rewards', () => {
  const reads = [];
  const writes = [];
  const rolls = [];
  const rewards = [];
  let succeeds = false;
  const registry = createProcRegistry(() => context);
  const context = {
    duration: 2,
    procs: {
      ...registry,
      deadline(key) {
        reads.push(key);
        return registry.deadline(key);
      },
      setDeadline(key, at) {
        writes.push([key, at]);
        registry.setDeadline(key, at);
      }
    },
    random: {
      roll(chance, stream) {
        rolls.push([chance, stream]);
        return succeeds;
      }
    }
  };
  const details = { hitContext: { critical: { chance: 1, didCrit: true } } };
  const event = { actorType: 'player', sourceId: 7, at: 0 };
  const reaction = criticalProcHandler({
    id: 'fixture.display',
    randomStream: 'fixture.secondary',
    chanceOnCriticalHit: 0.5,
    when: (_context, event) => event.sourceId === 7,
    internalCooldown: { key: 101, duration: (context) => context.duration },
    handler(context, event, details, application) {
      rewards.push(application.quantity);
      assert.equal(registry.deadline(101), event.at + context.duration);
      reaction(context, event, details);
    }
  });
  reaction(context, { ...event, actorType: 'summon' }, details);
  reaction(context, { ...event, sourceId: 8 }, details);
  assert.deepEqual(reads, []);
  assert.deepEqual(rolls, []);
  reaction(context, event, { hitContext: { critical: { chance: 1, didCrit: false } } });
  assert.deepEqual(rolls, []);
  reaction(context, event, details);
  assert.deepEqual(writes, []);
  assert.equal(registry.deadline(101), 0);
  assert.deepEqual(rewards, []);
  succeeds = true;
  reaction(context, event, details);
  assert.deepEqual(writes, [[101, 2]]);
  assert.deepEqual(rewards, [1]);
  for (const at of [1, 2, 2.0000001]) reaction(context, { ...event, at }, details);
  assert.equal(rolls.length, 2);
  assert.deepEqual(writes, [[101, 2]]);
  context.duration = 3;
  reaction(context, { ...event, at: 2.000001 }, details);
  assert.deepEqual(writes, [
    [101, 2],
    [101, 2.000001 + 3]
  ]);
  assert.deepEqual(rewards, [1, 1]);
  assert.ok(reads.every((key) => key === 101));
  assert.deepEqual(rolls, Array(3).fill([0.5, 'fixture.secondary']));
});

test('critical handlers preserve unarmed zero deadlines and omit registry access without a cooldown', () => {
  const details = { hitContext: { critical: { chance: 1, didCrit: true } } };
  const event = { actorType: 'player', at: 0 };
  const context = { procs: createProcRegistry(() => context) };
  let rewards = 0;
  const reaction = criticalProcHandler({
    id: 'fixture.zero',
    internalCooldown: { key: 'zero', duration: 0 },
    handler() {
      rewards++;
    }
  });
  for (const at of [0, 0, 1, 1, 1.0000001, 1.000001]) reaction(context, { ...event, at }, details);
  assert.equal(rewards, 4);
  assert.equal(context.procs.deadline('zero'), 1.000001);
  const fresh = { procs: createProcRegistry(() => fresh) };
  reaction(fresh, event, details);
  assert.equal(rewards, 5);
  assert.equal(context.procs.deadline('zero'), 1.000001);

  // A declaration without an ICD does not acquire or reserve any registry state.
  const unrestricted = criticalProcHandler({
    id: 'fixture.unrestricted',
    handler() {
      rewards++;
    }
  });
  const noRegistry = {
    get procs() {
      return assert.fail('No-cooldown handler read the registry');
    }
  };
  unrestricted(noRegistry, event, details);
  unrestricted(noRegistry, event, details);
  assert.equal(rewards, 7);
});
