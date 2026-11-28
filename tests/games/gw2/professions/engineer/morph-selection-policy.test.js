import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild
} from '#gw2/professions/engineer/build/build.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { bindAmalgamUi } from '#gw2/professions/engineer/specializations/amalgam/presentation.js';
import {
  amalgamProtocolOptions,
  DEFAULT_AMALGAM_MORPHS,
  normalizeAmalgamMorphs,
  selectAmalgamMorph,
  validAmalgamMorphs
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';

// Saved button IDs and shorthand casts migrate without rewriting command options or slot order.
test('old protocol selections and casts load with canonical IDs', () => {
  const build = migrateEngineerBuild({
    ...createEngineerBuildDefaults(),
    selectedMorphSkillIds: [77163, 76866, 76954],
    rotation: [{ type: 'cast', skillId: 77103, concurrentOffsetMs: 80 }, 77104]
  });
  assert.deepEqual(build.selectedMorphSkillIds, [76640, 76568, 76693]);
  assert.deepEqual(build.rotation, [
    { type: 'cast', skillId: 76568, concurrentOffsetMs: 80 },
    { type: 'cast', skillId: 76640 }
  ]);
  assert.deepEqual(migrateEngineerBuild(build), build);
});

// Translated labels do not affect selection.
test('morph normalization, validation, option order, and UI swaps ignore display names', () => {
  for (const rename of [() => 'Same label', (skill) => `Localized ${skill.id}`]) {
    const skills = engineerCatalog.skills.map((skill) => ({ ...skill, name: rename(skill) }));
    const catalog = { ...engineerCatalog, skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
    for (const input of [undefined, [], [0, 76568, 76568, 76693], [76568, 76959, 76693]]) {
      const normalized = normalizeAmalgamMorphs(catalog, input);
      assert.deepEqual(normalized, normalizeAmalgamMorphs(engineerCatalog, input));
      assert.equal(validAmalgamMorphs(catalog, normalized), true);
    }

    assert.equal(validAmalgamMorphs(catalog, [76568, 76568, 76693]), false);
    for (const slot of [2, 3, 4]) {
      const options = amalgamProtocolOptions(catalog).map((skill) => skill.id);
      assert.deepEqual(
        options,
        amalgamProtocolOptions(engineerCatalog).map((skill) => skill.id)
      );
      for (const skillId of options) {
        const build = { selectedMorphSkillIds: [...DEFAULT_AMALGAM_MORPHS] };
        const expected = selectAmalgamMorph(engineerCatalog, build.selectedMorphSkillIds, slot - 2, skillId);
        assert.equal(
          bindAmalgamUi(catalog).updateSkillBarSelection(
            { build },
            { key: 'selectedMorphSkillIds', index: slot - 2, skillId }
          ),
          true
        );
        assert.deepEqual(build.selectedMorphSkillIds, expected);
        assert.equal(validAmalgamMorphs(catalog, expected), true);
      }
    }
  }
});

// Invalid selections cannot partially mutate an editable build, including a failed conflict replacement.
test('morph policy rejects unknown IDs, invalid slots and unavailable skills atomically', () => {
  const current = [...DEFAULT_AMALGAM_MORPHS];
  for (const [index, id] of [
    [-1, 76568],
    [3, 76568],
    [0, 0]
  ]) {
    assert.equal(selectAmalgamMorph(engineerCatalog, current, index, id), null);
    assert.deepEqual(current, DEFAULT_AMALGAM_MORPHS);
  }

  for (const invalid of [null, [], [76568, 76568, 76693], [76568, 76959, 76959], [76568, 76959, 0]]) {
    assert.equal(validAmalgamMorphs(engineerCatalog, invalid), false);
    assert.equal(validAmalgamMorphs(engineerCatalog, normalizeAmalgamMorphs(engineerCatalog, invalid)), true);
  }

  const skills = engineerCatalog.skills.filter((skill) => skill.id !== 76568);
  const catalog = { ...engineerCatalog, skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
  const build = { selectedMorphSkillIds: current };
  assert.equal(
    bindAmalgamUi(catalog).updateSkillBarSelection(
      { build },
      { key: 'selectedMorphSkillIds', index: 0, skillId: 76959 }
    ),
    false
  );
  assert.strictEqual(build.selectedMorphSkillIds, current);
});

// Every accepted slot change remains canonical when persisted and normalized again.
test('morph swaps round trip through the Engineer build codec', () => {
  const defaults = createEngineerBuildDefaults();
  for (const slot of [2, 3, 4]) {
    for (const skill of amalgamProtocolOptions(engineerCatalog)) {
      const selectedMorphSkillIds = selectAmalgamMorph(engineerCatalog, DEFAULT_AMALGAM_MORPHS, slot - 2, skill.id);
      const build = migrateEngineerBuild({ ...defaults, selectedMorphSkillIds });
      assert.deepEqual(build.selectedMorphSkillIds, selectedMorphSkillIds);
      assert.equal(validateEngineerBuild(build).valid, true);
      assert.deepEqual(migrateEngineerBuild(build), build);
    }
  }
});

// Selection follows the active catalog.
test('morph selection supports catalog-owned protocol identities', () => {
  const remap = (id) => id + 1000000;
  const skills = engineerCatalog.skills.map((skill) => (skill.morphKind ? { ...skill, id: remap(skill.id) } : skill));
  const catalog = { ...engineerCatalog, skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
  const selected = DEFAULT_AMALGAM_MORPHS.map(remap);
  assert.equal(validAmalgamMorphs(catalog, selected), true);
  assert.deepEqual(normalizeAmalgamMorphs(catalog, selected), selected);
  const shred = amalgamProtocolOptions(catalog).find((skill) => skill.morphKind === 'shred');
  const changed = selectAmalgamMorph(catalog, selected, 1, shred.id);
  assert.equal(validAmalgamMorphs(catalog, changed), true);
  assert.equal(changed[1], shred.id);
  assert.equal(catalog.skillsById.get(changed[0]).morphKind, 'protect');
});
