import assert from 'node:assert/strict';
import test from 'node:test';

import { cloneData } from '#kernel/core/clone.js';

// Packet and result copies must be indistinguishable from structuredClone for the data shapes the engine emits.
test('cloneData detaches plain data with structuredClone graph semantics', () => {
  const shared = { stacks: 1, audience: { recipients: 'party' } };
  const source = { at: 1, nested: [shared, shared, undefined, -0], label: 'Bleeding', missing: undefined };
  source.self = source;
  const copy = cloneData(source);

  assert.deepEqual(copy, structuredClone(source));
  assert.notEqual(copy.nested[0], shared);
  assert.equal(copy.nested[0], copy.nested[1]);
  assert.equal(copy.self, copy);
  assert.ok(Object.hasOwn(copy, 'missing'));
  assert.ok(Object.is(copy.nested[3], -0));
  shared.audience.recipients = 'squad';
  assert.equal(copy.nested[0].audience.recipients, 'party');
});

// Non-plain values keep structuredClone's own conversion, and uncloneable values fail the same way.
test('cloneData delegates special values and rejects uncloneable data', () => {
  const at = new Date(0);
  const copy = cloneData({ at, owners: new Map([['clone', { count: 2 }]]), instance: new (class Box {})() });

  assert.ok(copy.at instanceof Date);
  assert.notEqual(copy.at, at);
  assert.deepEqual(copy.owners, new Map([['clone', { count: 2 }]]));
  assert.equal(Object.getPrototypeOf(copy.instance), Object.prototype);
  assert.throws(() => cloneData({ callback: () => {} }), { name: 'DataCloneError' });
  assert.throws(() => cloneData([Symbol('id')]), { name: 'DataCloneError' });
});
