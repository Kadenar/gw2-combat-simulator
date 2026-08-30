import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSelectedSkillNames, selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';

test('selected skill names normalize array and slot-keyed loadouts', () => {
  assert.deepEqual(normalizeSelectedSkillNames(['One', 'Two']), ['One', 'Two']);
  assert.deepEqual(normalizeSelectedSkillNames({ Heal: 'Three', Utility1: 'Four' }), ['Three', 'Four']);
});

test('selected skill names read embedded skill objects', () => {
  const selected = [{ id: 1, name: 'One' }, 'Two', { id: 3, name: 'Three' }];

  assert.deepEqual(normalizeSelectedSkillNames(selected), ['One', 'Two', 'Three']);
  assert.deepEqual([...selectedSkillNameSet(selected)], ['One', 'Two', 'Three']);
});

test('selected skill names reject empty input and malformed entries', () => {
  assert.deepEqual(normalizeSelectedSkillNames(undefined), []);
  assert.deepEqual(normalizeSelectedSkillNames(null), []);
  assert.deepEqual(normalizeSelectedSkillNames([]), []);
  assert.deepEqual(normalizeSelectedSkillNames({}), []);
  assert.deepEqual(normalizeSelectedSkillNames(['Valid', '', null, undefined, 42, {}, { name: '' }, { name: 42 }]), [
    'Valid'
  ]);
});
