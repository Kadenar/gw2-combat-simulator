import assert from 'node:assert/strict';
import test from 'node:test';
import { selectedSlotSkillAvailability } from '#gw2/platform/execution/availability.js';

// Minimal skills isolate selection identity and root inheritance from combat-state prerequisites.
test('slot selection distinguishes omission, empty loadouts, and explicitly selected roots', () => {
  const root = { id: 1, name: 'Root', type: 'Utility' };
  const flip = { id: 2, name: 'Flip', type: 'Utility', flipParentId: 1 };
  const next = { id: 3, name: 'Next', type: 'Utility', flipParentId: 2 };
  const catalog = { skillsById: new Map([root, flip, next].map((skill) => [skill.id, skill])) };
  for (const selectedSkillIds of [undefined, [], [1], [2]]) {
    const context = { config: { selectedSkillIds }, catalog };
    const verdict = selectedSlotSkillAvailability(context, next);
    if (selectedSkillIds === undefined || selectedSkillIds[0] === 1) {
      assert.equal(verdict, null);
    } else {
      assert.equal(verdict.code, 'gw2.slot-not-equipped');
      assert.equal(verdict.retryAt, null);
    }
  }

  const omitted = { config: {}, catalog };
  assert.equal(selectedSlotSkillAvailability(omitted, root, { omittedLoadout: 'deny' }).retryAt, null);
  assert.equal(selectedSlotSkillAvailability(omitted, { ...root, type: 'Weapon' }, { omittedLoadout: 'deny' }), null);
});

test('variant identity applies to both selected IDs and flip roots without comparing names', () => {
  const root = { id: 1, name: 'Same name', type: 'Utility' };
  const variant = { id: 2, name: 'Variant', type: 'Utility' };
  const flip = { id: 3, name: 'Flip', type: 'Utility', flipParentId: 2 };
  const unrelated = { id: 4, name: root.name, type: 'Utility' };
  const catalog = { skillsById: new Map([root, variant, flip, unrelated].map((skill) => [skill.id, skill])) };
  const policy = { identity: (id) => (id === 2 ? 1 : id) };
  for (const selectedSkillIds of [[1], [2]]) {
    const context = { config: { selectedSkillIds }, catalog };
    assert.equal(selectedSlotSkillAvailability(context, root, policy), null);
    assert.equal(selectedSlotSkillAvailability(context, flip, policy), null);
    assert.equal(selectedSlotSkillAvailability(context, unrelated, policy).code, 'gw2.slot-not-equipped');
  }
});
