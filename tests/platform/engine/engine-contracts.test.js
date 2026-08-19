import assert from 'node:assert/strict';
import test from 'node:test';

import { assertSimulationEvent, createEvent } from '../../../js/platform/engine/events.js';
import {
  assertScheduledEventStream,
  buildScheduledEventStream
} from '../../../js/platform/engine/scheduled-event-stream.js';

test('typed event boundary rejects values outside the declared contract', () => {
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
