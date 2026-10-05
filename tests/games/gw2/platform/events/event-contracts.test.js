import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSimulationEvent, COMMON_EVENT_TYPES } from '#gw2/platform/events/events.js';

// The live event boundary validates explicit ownership before execution.
test('event ownership is required regardless of legacy source labels', () => {
  for (const source of ['Player', 'Trait', 'Phantasm', 'Environment']) {
    assert.throws(
      () => assertSimulationEvent({ type: 'damage', at: 0, source, sourceId: 'missing-actor', coefficient: 1 }),
      /actorType.*required/
    );
  }
});

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
        actorType: 'player',
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
        actorType: 'player',
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
        actorType: 'player',
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
        actorType: 'player',
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

test('live snapshot event types are canonical and obsolete boon and blind events are rejected', () => {
  for (const type of ['cooldown_snapshot', 'self_condition']) {
    assert.equal(COMMON_EVENT_TYPES.includes(type), true);
    assert.equal(
      assertSimulationEvent({ type, actorType: 'player', at: 0, source: 'fixture', sourceId: 1 }).type,
      type
    );
  }

  for (const type of ['boon', 'blind']) {
    assert.throws(
      () => assertSimulationEvent({ type, actorType: 'player', at: 0, source: 'fixture', sourceId: 1 }),
      /Unsupported simulation event type/
    );
  }
});

// Trait formulas enter the damage sampler only through valid condition applications.
test('condition damage formulas reject invalid rates and non-condition packets', () => {
  const event = {
    type: 'condition',
    actorType: 'player',
    at: 0,
    source: 'fixture',
    sourceId: 1,
    condition: 'Fear',
    stacks: 1,
    duration: 1
  };
  const conditionDamageFormula = { base: 444, scaling: 0.4 };
  assert.equal(
    assertSimulationEvent({ ...event, conditionDamageFormula }).conditionDamageFormula,
    conditionDamageFormula
  );
  for (const formula of [null, 1, {}, { base: -1, scaling: 0.4 }, { base: 444, scaling: Infinity }])
    assert.throws(
      () => assertSimulationEvent({ ...event, conditionDamageFormula: formula }),
      /Condition damage formula/
    );
  assert.throws(
    () => assertSimulationEvent({ ...event, type: 'damage', coefficient: 1, conditionDamageFormula }),
    /Condition damage formula/
  );
});
