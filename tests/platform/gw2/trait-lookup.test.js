import assert from 'node:assert/strict';
import test from 'node:test';

import { hasTrait } from '../../../js/platform/gw2/combat/state/traits.js';

test('trait lookup accepts stable and numeric-string IDs from a normalized trait set', () => {
  assert.equal(hasTrait(new Set([123]), 123), true);
  assert.equal(hasTrait(new Set([123]), '123'), true);
  assert.equal(hasTrait({ traits: new Set([123]) }, 123), true);
  assert.equal(hasTrait({ traits: new Set([123]) }, '123'), true);
  assert.equal(hasTrait({ traits: new Set(['123']) }, 123), true);
  assert.equal(hasTrait({ traits: new Set([456]) }, 123), false);
});

test('trait lookup resolves catalog names against raw build configuration', () => {
  const context = {
    config: { selectedTraitIds: ['123'] },
    catalog: { traits: [{ id: 123, name: 'Fixture Trait' }] }
  };

  assert.equal(hasTrait(context, 123), true);
  assert.equal(hasTrait(context, '123'), true);
  assert.equal(hasTrait(context, 'Fixture Trait'), true);
  assert.equal(hasTrait(context, 'Missing Trait'), false);
  assert.equal(hasTrait(context.config, 123), true);
  assert.equal(hasTrait(context.config, '123'), true);
});

test('trait lookup safely rejects absent and malformed contexts', () => {
  assert.equal(hasTrait(undefined, 123), false);
  assert.equal(hasTrait(null, 123), false);
  assert.equal(hasTrait('invalid', 123), false);
  assert.equal(hasTrait({}, 123), false);
  assert.equal(hasTrait({ traits: [] }, 123), false);
  assert.equal(hasTrait({ config: { selectedTraitIds: '123' } }, 123), false);
  assert.equal(
    hasTrait({ catalog: { traits: 'invalid' }, config: { selectedTraitIds: [123] } }, 'Fixture Trait'),
    false
  );
});

test('normalized trait sets remain authoritative over raw configuration', () => {
  assert.equal(
    hasTrait(
      {
        traits: new Set(),
        config: { selectedTraitIds: [123] }
      },
      123
    ),
    false
  );
});
