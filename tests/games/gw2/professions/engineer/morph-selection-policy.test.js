import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild
} from '#gw2/professions/engineer/build/build.js';
import {
  DEFAULT_AMALGAM_MORPHS,
  amalgamProtocolOptions,
  normalizeAmalgamMorphs,
  selectAmalgamMorph,
  validAmalgamMorphs
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { bindAmalgamUi } from '#gw2/professions/engineer/specializations/amalgam/presentation.js';

// Both colliding labels and slot-specific translations must leave identity decisions unchanged.
test('morph normalization, validation, option order, and UI swaps ignore display names', () => {
  for (const rename of [() => 'Same label', (skill) => `Localized ${skill.id}`]) {
    const skills = engineerCatalog.skills.map((skill) => ({ ...skill, name: rename(skill) }));
    const catalog = { ...engineerCatalog, skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
    for (const input of [undefined, [], [0, 77103, 76866, 76954], [77103, 77203, 76954]]) {
      const normalized = normalizeAmalgamMorphs(catalog, input);
      assert.deepEqual(normalized, normalizeAmalgamMorphs(engineerCatalog, input));
      assert.equal(validAmalgamMorphs(catalog, normalized), true);
    }

    assert.equal(validAmalgamMorphs(catalog, [77103, 76866, 76954]), false);
    for (const slot of [2, 3, 4]) {
      const options = amalgamProtocolOptions(catalog, slot).map((skill) => skill.id);
      assert.deepEqual(
        options,
        amalgamProtocolOptions(engineerCatalog, slot).map((skill) => skill.id)
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
test('morph policy rejects unknown IDs, wrong slots, invalid loadouts, and unavailable swaps atomically', () => {
  const current = [...DEFAULT_AMALGAM_MORPHS];
  for (const [index, id] of [
    [-1, 77103],
    [3, 77103],
    [0, 77203],
    [0, 0]
  ]) {
    assert.equal(selectAmalgamMorph(engineerCatalog, current, index, id), null);
    assert.deepEqual(current, DEFAULT_AMALGAM_MORPHS);
  }

  for (const invalid of [null, [], [77103, 77103, 76954], [77103, 77203, 77285], [77103, 77203, 0]]) {
    assert.equal(validAmalgamMorphs(engineerCatalog, invalid), false);
    assert.equal(validAmalgamMorphs(engineerCatalog, normalizeAmalgamMorphs(engineerCatalog, invalid)), true);
  }

  const skills = engineerCatalog.skills.filter((skill) => skill.id !== 76866);
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
    for (const skill of amalgamProtocolOptions(engineerCatalog, slot)) {
      const selectedMorphSkillIds = selectAmalgamMorph(engineerCatalog, DEFAULT_AMALGAM_MORPHS, slot - 2, skill.id);
      const build = migrateEngineerBuild({ ...defaults, selectedMorphSkillIds });
      assert.deepEqual(build.selectedMorphSkillIds, selectedMorphSkillIds);
      assert.equal(validateEngineerBuild(build).valid, true);
      assert.deepEqual(migrateEngineerBuild(build), build);
    }
  }
});
