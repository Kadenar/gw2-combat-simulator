import assert from 'node:assert/strict';
import test from 'node:test';

import { rangerNativeModules } from '#gw2/professions/ranger/catalog.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

// Native ownership follows the trait line even when an elite invokes its behavior explicitly.
test('Ranger registers one canonical owner for cross-specialization traits', () => {
  const owners = new Map();
  for (const module of rangerNativeModules) {
    for (const definition of module.traitDefinitions) {
      assert.equal(owners.has(definition.id), false, definition.name);
      owners.set(definition.id, module.id);
    }
  }

  for (const id of [TRAIT.BESTIAL_RAGE, TRAIT.GO_FOR_THE_EYES, TRAIT.WILTING_STRIKE, TRAIT.LOUD_WHISTLE])
    assert.equal(owners.get(id), 'Core');
  assert.equal(owners.get(TRAIT.NATURAL_FORTITUDE), 'Untamed');
});
