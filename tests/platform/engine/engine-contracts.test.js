import assert from 'node:assert/strict';
import test from 'node:test';

import { assertSimulationEvent, COMMON_EVENT_TYPES, createEvent } from '#gw2/platform/engine/events/events.js';
import { assertScheduledEventStream, buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { emitStateSnapshot, sameSnapshotValue } from '#gw2/platform/engine/events/state-snapshots.js';
import { skillDamageIdentityKey } from '#gw2/app/presentation/results/result-tables.js';

test('typed event boundary rejects values outside the declared contract', () => {
  assert.equal(
    assertSimulationEvent({
      type: 'condition_tick',
      at: 1,
      source: 'Environment',
      sourceId: 'environment.bleeding',
      actorType: 'environment',
      ownerActorType: 'environment'
    }).actorType,
    'environment'
  );
  assert.throws(
    () =>
      assertSimulationEvent({
        type: 'damage',
        at: 0,
        source: 'fixture',
        sourceId: 1
      }),
    /coefficient or flat strike value/
  );
  assert.throws(
    () =>
      assertSimulationEvent({
        type: 'condition',
        at: 0,
        source: 'fixture',
        sourceId: 1,
        condition: 'Bleeding',
        stacks: -1,
        duration: 2
      }),
    /stacks must be positive/
  );
  assert.throws(
    () =>
      assertSimulationEvent({
        type: 'damage',
        at: -1,
        source: 'fixture',
        sourceId: 1,
        coefficient: 1
      }),
    /non-negative finite number/
  );
  assert.throws(
    () =>
      assertSimulationEvent({
        type: 'damage',
        at: 0,
        source: 'fixture',
        sourceId: 1,
        actorType: 'invalid',
        coefficient: 1
      }),
    /actorType is invalid/
  );
  assert.throws(
    () =>
      assertSimulationEvent({
        type: 'damage',
        at: 0,
        source: 'fixture',
        sourceId: 1,
        ownerActorType: 'invalid',
        coefficient: 1
      }),
    /ownerActorType is invalid/
  );
  assert.throws(
    () =>
      assertSimulationEvent({
        type: 'damage',
        at: 0,
        source: 'fixture',
        sourceId: 1,
        actorType: 'summon',
        summonKind: '',
        coefficient: 1
      }),
    /summonKind must be a non-empty string/
  );
});

test('live snapshot event types are canonical and event-form boon is rejected', () => {
  for (const type of ['cooldown_snapshot', 'self_condition']) {
    assert.equal(COMMON_EVENT_TYPES.includes(type), true);
    assert.equal(assertSimulationEvent({ type, at: 0, source: 'fixture', sourceId: 1 }).type, type);
  }

  assert.throws(
    () => assertSimulationEvent({ type: 'boon', at: 0, source: 'fixture', sourceId: 1 }),
    /Unsupported simulation event type/
  );
});

test('summon subtype remains part of damage identity', () => {
  const cloneKey = skillDamageIdentityKey({ skillId: 1, actorType: 'summon', summonKind: 'clone', name: 'Attack' });
  const phantasmKey = skillDamageIdentityKey({
    skillId: 1,
    actorType: 'summon',
    summonKind: 'phantasm',
    name: 'Attack'
  });

  assert.notEqual(cloneKey, phantasmKey);
});

test('typed event and stream constructors return immutable envelopes', () => {
  const event = createEvent({
    type: 'damage',
    at: 0,
    source: 'fixture',
    sourceId: 1,
    actorType: 'player',
    coefficient: 1
  });
  const stream = buildScheduledEventStream({
    events: [event],
    rotationEndTime: 1,
    resolverHandoff: { profession: 'fixture' }
  });

  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(stream), true);
  assert.equal(Object.isFrozen(stream.events), true);
  assert.equal(Object.isFrozen(stream.resolverHandoff), true);
  assert.equal(stream.resolutionEndTime, stream.rotationEndTime);
  assert.equal(assertScheduledEventStream(stream), stream);

  const delayedStream = buildScheduledEventStream({
    events: [event],
    rotationEndTime: 1,
    resolutionEndTime: 2
  });

  assert.equal(delayedStream.rotationEndTime, 1);
  assert.equal(delayedStream.resolutionEndTime, 2);

  assert.throws(
    () =>
      assertScheduledEventStream({
        kind: stream.kind,
        version: stream.version,
        eventSchemaVersion: stream.eventSchemaVersion,
        rotationEndTime: stream.rotationEndTime,
        events: stream.events
      }),
    /Invalid scheduled event stream/
  );
});

test('scheduled stream horizons cannot precede time zero', () => {
  const stream = buildScheduledEventStream({ events: [], rotationEndTime: 0 });

  assert.equal(stream.resolutionEndTime, 0);
  assert.throws(
    () => buildScheduledEventStream({ events: [], rotationEndTime: -1 }),
    /finite, non-negative rotation end/
  );
  assert.throws(
    () => assertScheduledEventStream({ ...stream, rotationEndTime: -1, resolutionEndTime: -1 }),
    /Invalid scheduled event stream/
  );
});

test('state snapshot emission removes only matching adjacent synchronization checkpoints', () => {
  const events = [];
  const context = {
    events,
    emit(event) {
      const emitted = createEvent(event);
      events.push(emitted);
      return emitted;
    }
  };
  const event = (sourceId, state) => ({
    type: 'fixture.state',
    at: 1,
    source: 'fixture',
    sourceId,
    actorType: 'player',
    state
  });

  assert.equal(sameSnapshotValue({ values: [Number.NaN, -0] }, { values: [Number.NaN, -0] }), true);
  assert.ok(emitStateSnapshot(context, event('fixture.state.first', { resource: 10 })));
  assert.equal(emitStateSnapshot(context, event('fixture.state.first', { resource: 10 })), null);
  assert.ok(emitStateSnapshot(context, event('fixture.state.second', { resource: 10 })));
  assert.equal(
    emitStateSnapshot(context, event('fixture.state.third', { resource: 10 }), { dedupeAcrossSourceIds: true }),
    null
  );
  assert.ok(emitStateSnapshot(context, event('fixture.state.third', { resource: 9 })));
  const direct = emitStateSnapshot(context, 'fixture', 2, 'resource-update', { resource: 8 });
  assert.deepEqual(
    {
      type: direct.type,
      at: direct.at,
      source: direct.source,
      sourceId: direct.sourceId,
      reason: direct.reason,
      state: direct.state
    },
    {
      type: 'fixture.state',
      at: 2,
      source: 'fixture',
      sourceId: 'fixture.state.resource-update',
      reason: 'resource-update',
      state: { resource: 8 }
    }
  );
  assert.equal(events.length, 4);
});
