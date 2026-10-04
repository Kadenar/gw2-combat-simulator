import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectedSkillIdsFromSlots,
  selectedSkillIdSet,
  prepareSelectedSkillLoadout
} from '#gw2/platform/builds/selected-skills.js';
import { selectedSlotSkillAvailability } from '#gw2/platform/engine/skills/availability.js';
import { hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { availableSlotSkills } from '#gw2/app/build/panels/skills.js';

const first = { id: 1, name: 'Shared name', type: 'Utility' };
const second = { id: '1', name: 'Shared name', type: 'Utility' };
const catalog = {
  skillsById: new Map([
    [first.id, first],
    [second.id, second]
  ])
};

// UI choices group only explicitly authored variants, never unrelated skills sharing a label.
test('slot choices retain duplicate labels and group authored loadout variants', () => {
  const app = {
    skills: [first, second, { ...first, id: 3, paletteTileId: first.id }],
    build: {},
    activeCatalog: catalog,
    profession: { ui: {} },
    adapter: { eliteSpecialization: () => 'Core', isSkillAvailable: () => true }
  };
  assert.deepEqual(
    availableSlotSkills(app, 'Utility').map((skill) => skill.id),
    [1, '1']
  );
});

// String IDs remain distinct from numeric IDs; labels cannot create catalog identity.
test('selection boundaries retain canonical IDs and reject malformed or unknown values', () => {
  assert.deepEqual(selectedSkillIdsFromSlots({ Heal: null, Utility1: 1, Utility2: '1' }), [1, '1']);
  assert.deepEqual(prepareSelectedSkillLoadout([1, '1'], catalog), [1, '1']);
  assert.deepEqual(prepareSelectedSkillLoadout([], catalog), []);
  for (const input of [null, {}, [null], [undefined], [''], [NaN], [Infinity], [true], [{}], ['Shared name'], [2]]) {
    assert.throws(() => prepareSelectedSkillLoadout(input, catalog), TypeError);
  }

  assert.throws(() => selectedSkillIdsFromSlots({ Utility1: undefined }), TypeError);
});

test('prepared membership is reused and isolated without freezing mutable editor inputs', () => {
  const slots = { Heal: null, Utility1: 1 };
  const prepared = prepareSelectedSkillLoadout(selectedSkillIdsFromSlots(slots), catalog);
  const membership = selectedSkillIdSet(prepared);
  assert.equal(selectedSkillIdSet(prepared), membership);
  slots.Utility1 = '1';
  assert.deepEqual([...selectedSkillIdSet(prepared)], [1]);
  assert.deepEqual([...selectedSkillIdSet(slots)], ['1']);
  assert.equal(Object.isFrozen(slots), false);
  assert.equal(Object.isFrozen(prepared), true);
});

test('duplicate names and renames never change availability or passive membership', () => {
  const config = { selectedSkillIds: prepareSelectedSkillLoadout([first.id], catalog) };
  assert.equal(selectedSlotSkillAvailability({ config, catalog }, first), null);
  assert.equal(selectedSlotSkillAvailability({ config, catalog }, second).ready, false);
  assert.equal(hasSelectedSkillId({ config }, first.id), true);
  assert.equal(hasSelectedSkillId({ config }, second.id), false);
  const renamed = { ...first, name: 'Renamed skill' };
  assert.equal(selectedSlotSkillAvailability({ config, catalog }, renamed), null);
  assert.equal(hasSelectedSkillId({ config }, renamed.id), true);
  assert.equal(selectedSlotSkillAvailability({ config: {}, catalog }, second), null);
  assert.equal(selectedSlotSkillAvailability({ config: { selectedSkillIds: [] }, catalog }, first).ready, false);
});
