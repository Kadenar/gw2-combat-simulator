import assert from 'node:assert/strict';
import test from 'node:test';
import { claimActivation } from '#gw2/platform/combat/activation-claims.js';

// Identity, rather than elapsed time or packet order, determines whether a reaction has already run.
test('activation claims isolate scopes, activations, and state owners', () => {
  const claims = {};
  assert.equal(claimActivation(claims, 'burst', 'cast-1'), true);
  assert.equal(claimActivation(claims, 'burst', 'cast-1'), false);
  assert.equal(claimActivation(claims, 'malice', 'cast-1'), true);
  assert.equal(claimActivation(claims, 'burst', 'cast-2'), true);
  assert.equal(claimActivation(claims, 'burst', 'cast-1'), false);
  assert.equal(claimActivation({}, 'burst', 'cast-1'), true);
});

test('activation claim identities survive separators, prototype names, and detached snapshots', () => {
  const claims = {};
  for (const [scope, activation] of [
    ['a:b', 'c'],
    ['a', 'b:c'],
    ['__proto__', 'constructor'],
    ['', '']
  ]) {
    assert.equal(claimActivation(claims, scope, activation), true);
    assert.equal(claimActivation(structuredClone(claims), scope, activation), false);
  }

  const snapshot = structuredClone(claims);
  assert.equal(claimActivation(snapshot, 'new', 'cast'), true);
  assert.equal(claimActivation(claims, 'new', 'cast'), true);
});
