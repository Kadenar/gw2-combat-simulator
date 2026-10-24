import assert from 'node:assert/strict';
import test from 'node:test';
import { AURA } from '#gw2/platform/constants.js';
import { normalizeEffect } from '#gw2/platform/effects/validation.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';

// Supported aura declarations retain the granting activation, audience, and parent when becoming runtime events.
test('aura effects materialize with their payload and causal ownership', () => {
  const effect = normalizeEffect({
    type: 'aura',
    aura: AURA.CHAOS,
    duration: 4,
    audience: { recipients: 'self' }
  });
  const source = {
    source: 'Trait',
    sourceId: 667,
    actorType: 'player',
    activationId: 'cast:1',
    parentEventOrder: 3
  };
  const [{ event }] = materializeSkillEffectApplications({
    skill: { id: 667, name: 'Illusionary Membrane' },
    effect,
    start: 0,
    fullEnd: 1,
    baseEvent: source
  });
  assert.equal(event.type, 'aura');
  assert.equal(event.aura, AURA.CHAOS);
  assert.equal(event.duration, 4);
  assert.deepEqual(event.audience, effect.audience);
  for (const [key, value] of Object.entries(source)) assert.equal(event[key], value);
});

// Malformed declarations fail at catalog construction rather than reaching aura reactions with invalid data.
test('aura effects require a canonical name and positive finite duration', () => {
  for (const aura of Object.values(AURA)) assert.equal(normalizeEffect({ type: 'aura', aura, duration: 4 }).aura, aura);

  for (const aura of [undefined, '', 'Unknown Aura'])
    assert.throws(() => normalizeEffect({ type: 'aura', aura, duration: 4 }), /canonical aura/);

  for (const duration of [undefined, 0, -1, NaN, Infinity, '4'])
    assert.throws(() => normalizeEffect({ type: 'aura', aura: AURA.CHAOS, duration }), /duration/);
});
