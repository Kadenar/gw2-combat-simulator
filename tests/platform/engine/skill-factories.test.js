import assert from 'node:assert/strict';
import test from 'node:test';

import { implemented } from '../../../js/platform/engine/skills/factories.js';

test('implemented returns a new fragment with its fields and a true marker', () => {
  const definition = {
    castTimeMs: 750,
    cooldown: 8,
    effects: []
  };

  const result = implemented(definition);

  assert.notStrictEqual(result, definition);
  assert.deepEqual(result, {
    ...definition,
    implemented: true
  });
  assert.equal(Object.hasOwn(definition, 'implemented'), false);
});

test('implemented cannot be disabled by a spread definition', () => {
  assert.equal(implemented({ implemented: false }).implemented, true);
});
