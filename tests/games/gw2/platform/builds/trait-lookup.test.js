import assert from 'node:assert/strict';
import test from 'node:test';

import { hasTrait, normalizeSelectedTraitIds } from '#gw2/platform/builds/selected-traits.js';

// Runtime membership contains canonical IDs only; names in catalogs cannot become trait aliases.
test('selected trait normalization retains IDs without expanding display names', () => {
  const config = { selectedTraitIds: ['123', 123, 'fixture.trait'] };
  const traits = normalizeSelectedTraitIds(config.selectedTraitIds);
  assert.deepEqual([...traits], [123, 'fixture.trait']);
  assert.equal(hasTrait({ traits, catalog: { traits: [{ id: 123, name: 'Fixture Trait' }] } }, 'Fixture Trait'), false);
  assert.deepEqual([...normalizeSelectedTraitIds()], []);
  assert.deepEqual([...normalizeSelectedTraitIds('123')], []);
});

test('trait lookup accepts stable and numeric-string IDs from a normalized trait set', () => {
  assert.equal(hasTrait(new Set([123]), 123), true);
  assert.equal(hasTrait(new Set([123]), '123'), true);
  assert.equal(hasTrait({ traits: new Set([123]) }, 123), true);
  assert.equal(hasTrait({ traits: new Set([123]) }, '123'), true);
  assert.equal(hasTrait({ traits: new Set(['123']) }, 123), true);
  assert.equal(hasTrait({ traits: new Set([456]) }, 123), false);
});

test('trait lookup reads raw configured IDs without resolving catalog names', () => {
  const context = {
    config: { selectedTraitIds: ['123'] },
    catalog: { traits: [{ id: 123, name: 'Fixture Trait' }] }
  };

  assert.equal(hasTrait(context, 123), true);
  assert.equal(hasTrait(context, '123'), true);
  assert.equal(hasTrait(context, 'Fixture Trait'), false);
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
