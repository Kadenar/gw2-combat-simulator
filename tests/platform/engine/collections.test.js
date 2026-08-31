import assert from 'node:assert/strict';
import test from 'node:test';

import { insertSorted, toEntries } from '#kernel/core/collections.js';

test('insertSorted preserves order and inserts after equal values', () => {
  const values = [
    { key: 1, label: 'first' },
    { key: 2, label: 'second' },
    { key: 2, label: 'third' },
    { key: 4, label: 'last' }
  ];

  insertSorted(values, { key: 2, label: 'inserted' }, (left, right) => left.key - right.key);
  insertSorted(values, { key: 3, label: 'between' }, (left, right) => left.key - right.key);

  assert.deepEqual(
    values.map((value) => value.label),
    ['first', 'second', 'third', 'inserted', 'between', 'last']
  );
});

test('toEntries normalizes maps and records to string-keyed tuples', () => {
  assert.deepEqual(toEntries(new Map([[1, 'one']])), [['1', 'one']]);
  assert.deepEqual(toEntries({ two: 2 }), [['two', 2]]);
});
