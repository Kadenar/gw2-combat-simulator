import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGeneratedSkill } from '#gw2/professions/shared/catalog-data.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';

// Generated defaults replace only their owned fields and must never mutate the source declaration.
test('generated normalization preserves extension fields and uses the caller-selected flip parent', () => {
  const effects = Object.freeze([Object.freeze({ type: 'strike', coefficient: 1 })]);
  const extension = Object.freeze({ owner: 'fixture' });
  const source = Object.freeze({ id: 1, name: 'Fixture', cooldown: 12, flipParentId: 2, effects, extension });
  const normalized = normalizeGeneratedSkill(source, 3);

  assert.notEqual(normalized, source);
  assert.deepEqual(normalized, { ...source, cooldown: 12, flipParentId: 3, effects: [] });
  assert.equal(normalized.extension, extension);
  assert.equal(source.flipParentId, 2);
  assert.equal(source.effects, effects);
  assert.equal(source.cooldown, 12);
  assert.equal(normalizeGeneratedSkill(source, null).flipParentId, null);
  assert.notEqual(normalizeGeneratedSkill(source, null).effects, normalized.effects);
});

test('generated recharge defaults distinguish missing inputs and explicit zero without inventing legacy fields', () => {
  for (const [fields, cooldown] of [
    [{}, 0],
    [{ cooldown: 0 }, 0],
    [{ cooldown: 0, ammoCastLockout: 12 }, 0],
    [{ ammo: 2, ammoRecharge: 8, ammoCastLockout: 1 }, 8]
  ]) {
    const source = Object.freeze({ id: 1, name: 'Fixture', ...fields });
    const normalized = normalizeGeneratedSkill(source, null);
    assert.equal(Object.hasOwn(normalized, 'cooldown'), true);
    assert.equal(normalized.cooldown, cooldown);
    assert.equal(Object.hasOwn(normalized, 'recharge'), false);
    assert.equal(normalized.ammoCastLockout, source.ammoCastLockout);
    assert.equal(normalized.flipParentId, null);
    assert.deepEqual(normalized.effects, []);
  }
});

// Authored extras bypass generated defaults, including the three retained supplemental normalization paths.
test('profession module preparation preserves authored supplemental effects and omitted cooldowns', () => {
  const effects = Object.freeze([Object.freeze({ type: 'strike', coefficient: 1 })]);
  const extra = Object.freeze({ id: 990001, name: 'Authored extra', effects });
  for (const createData of [
    createEngineerModuleData,
    createMesmerModuleData,
    createRevenantModuleData,
    createThiefModuleData
  ]) {
    const data = createData('Core', { skillMechanics: {}, extraSkills: [extra] });
    assert.equal(data.extraSkills[0].effects, effects);
    assert.equal(Object.hasOwn(data.extraSkills[0], 'cooldown'), false);
  }

  for (const [createData, skillId, flipParentId] of [
    [createEngineerModuleData, 5806, null],
    [createRevenantModuleData, 42752, 45773],
    [createThiefModuleData, 13005, null]
  ]) {
    const data = createData('Core', { skillMechanics: { [skillId]: {} } });
    const supplemental = data.extraSkills.find((skill) => skill.id === skillId);
    assert.ok(supplemental);
    assert.equal(supplemental.flipParentId, flipParentId);
    assert.equal(Object.hasOwn(supplemental, 'cooldown'), false);
    assert.equal(Object.hasOwn(supplemental, 'effects'), false);
  }
});
