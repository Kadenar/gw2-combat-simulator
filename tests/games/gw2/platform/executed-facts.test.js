import assert from 'node:assert/strict';
import test from 'node:test';
import { createExecutedFacts } from '#gw2/platform/combat/history/executed-facts.js';

// Gameplay history remains available independently of reporting, with recording granted separately from querying.
test('executed fact readers observe recorded and interrupted actions without acquiring writers', () => {
  const { reader, writer } = createExecutedFacts([]);
  assert.equal('record' in reader, false);
  assert.equal('interruptAction' in reader, false);
  writer.record({ type: 'action', at: 0, endsAt: 3, fullEndsAt: 3, activationId: 'cast:1' });
  writer.interruptAction('cast:1', 1);
  assert.equal(reader.actionFor('cast:1').endsAt, 1);
  assert.equal(reader.actionFor('cast:1').interrupted, true);
  assert.equal(reader.ofType('action').length, 1);
  assert.equal(reader.read().length, 1);
});
