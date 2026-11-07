import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assembleNativeApplicationCatalog,
  createNativeModuleData
} from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { createDodgeSkill } from '#gw2/platform/skills/shared-actions.js';

const declaration = { name: 'Fixture', icon: 'fixture.png', effects: [] };

// Complete declarations preserve their identity vocabulary and join generated actions without a second input path.
test('native module skills retain numeric and string identities and detach their collection', () => {
  const authored = materializeSkillDefinitions({ 1: declaration, 'fixture.skill': declaration });
  const dodge = createDodgeSkill();
  const skills = [...authored, dodge];
  const data = createNativeModuleData({ id: 'Core', skills });
  skills.length = 0;
  assert.deepEqual(
    data.skills.map((skill) => skill.id),
    [1, 'fixture.skill', dodge.id]
  );
  assert.equal(Object.hasOwn(declaration, 'id'), false);
  assert.equal(Object.isFrozen(data.skills), true);
});

// Array composition cannot silently replace one owner when a generated action repeats an authored identity.
test('native skill assembly rejects duplicate identities across authored and generated declarations', () => {
  const dodge = createDodgeSkill();
  const data = createNativeModuleData({
    id: 'Core',
    skills: [...materializeSkillDefinitions({ [dodge.id]: declaration }), dodge]
  });
  const module = defineNativeModule({ id: 'Core', data, state: { create: () => ({}) } });
  assert.throws(() => assembleNativeApplicationCatalog([module]), /Duplicate skill id/);
});

// JavaScript callers must use the same complete-record collection accepted by typed native modules.
test('native module data rejects unsupported authoring inputs', () => {
  for (const field of ['skillMechanics', 'extraSkills']) {
    assert.throws(
      () => createNativeModuleData({ id: 'Core', [field]: [] }),
      new RegExp(`Unsupported native module data field: ${field}`)
    );
  }
});
