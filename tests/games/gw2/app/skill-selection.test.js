import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSelectedSkills } from '#gw2/app/build/state/skill-selection.js';

// Repairing an earlier slot must not consume a valid selection reserved by a later slot.
test('utility normalization repairs duplicate and unavailable IDs while preserving later choices', () => {
  const skills = [1, 2, 3].map((id) => ({ id, type: 'Utility' }));
  for (const invalid of [1, 999]) {
    const app = {
      skills,
      skillById: new Map(skills.map((skill) => [skill.id, skill])),
      profession: { ui: {} },
      adapter: { eliteSpecialization: () => 'Core', isSkillAvailable: () => true },
      build: { selectedSkillIds: { Heal: null, Utility1: invalid, Utility2: invalid, Utility3: 3, Elite: null } }
    };
    normalizeSelectedSkills(app);
    const { Utility1, Utility2, Utility3 } = app.build.selectedSkillIds;
    assert.equal(Utility3, 3);
    assert.deepEqual(new Set([Utility1, Utility2, Utility3]), new Set([1, 2, 3]));
  }
});
