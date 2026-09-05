import assert from 'node:assert/strict';
import test from 'node:test';
import { HandlerRegistry, OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/engine/resolution/handler-registry.js';

// Handler registries reject ambiguous or missing dispatch targets before events can be lost.
test('handler registry rejects duplicates and missing required handlers', () => {
  const registry = new HandlerRegistry().register('damage', () => {}).register('observable', OBSERVABLE_EVENT_HANDLER);

  assert.equal(registry.dispatch({ type: 'observable' }, {}), undefined);
  assert.throws(() => registry.register('damage', () => {}), /Duplicate event handler/);
  assert.throws(() => registry.require(['condition']), /Missing required/);
  assert.throws(() => registry.dispatch({ type: 'unknown' }, {}), /No event handler/);
});
