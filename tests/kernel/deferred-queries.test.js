// Deferred views retain only selected authority while following a replaceable owner's methods and receiver.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeferredQueries } from '#kernel/core/deferred-queries.js';

test('retained queries defer binding and invoke the current owner with its receiver', () => {
  let owner;
  const queries = createDeferredQueries(() => owner, ['value']);
  const value = queries.value;
  owner = {
    base: 3,
    value(amount = 0) {
      return this.base + amount;
    }
  };
  assert.equal(value(2), 5);
  owner = {
    base: 7,
    value(amount = 0) {
      return this.base * 2 + amount;
    }
  };
  assert.equal(value(), 14);
  assert.equal(value(1), 15);
});

test('query views omit unselected methods, reject replacement, and preserve owner errors', () => {
  const failure = new Error('owner query failed');
  const owner = {
    value() {
      throw failure;
    },
    mutate() {}
  };
  const queries = createDeferredQueries(() => owner, ['value']);
  assert.equal('mutate' in queries, false);
  assert.ok(Object.isFrozen(queries));
  assert.throws(() => {
    queries.value = () => 1;
  }, TypeError);
  assert.throws(
    () => queries.value(),
    (error) => error === failure
  );
});
