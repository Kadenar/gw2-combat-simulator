import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild
} from '#gw2/professions/engineer/build/build.js';
import { resolveSelectedAmalgamMorphId } from '#gw2/professions/engineer/build/morphs.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { bindAmalgamUi } from '#gw2/professions/engineer/specializations/amalgam/presentation.js';
import {
  amalgamProtocolOptions,
  DEFAULT_AMALGAM_MORPHS,
  normalizeAmalgamMorphs,
  selectAmalgamMorph,
  validAmalgamMorphs
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';

// Slot-specific IDs refer to the same protocol; absent protocols must remain unavailable instead of changing kind.
test('rotation normalization binds every morph variant to its selected slot and retains unselected kinds', () => {
  const defaults = createEngineerBuildDefaults();
  for (const slot of [2, 3, 4]) {
    for (const selected of amalgamProtocolOptions(engineerCatalog, slot)) {
      const selectedMorphSkillIds = selectAmalgamMorph(engineerCatalog, DEFAULT_AMALGAM_MORPHS, slot - 2, selected.id);
      for (const { id: skillId, morphKind: kind } of engineerCatalog.skills.filter((skill) => skill.morphKind)) {
        const command = { type: 'cast', skillId, concurrentOffsetMs: 80 };
        const build = migrateEngineerBuild({
          ...defaults,
          selectedMorphSkillIds,
          rotation: [command, { type: 'wait', durationMs: 100 }]
        });
        const expectedId = selectedMorphSkillIds.find((id) => engineerCatalog.skillsById.get(id)?.morphKind === kind);
        assert.deepEqual(build.rotation, [
          { ...command, skillId: expectedId ?? skillId },
          { type: 'wait', durationMs: 100 }
        ]);
        assert.deepEqual(build.selectedMorphSkillIds, selectedMorphSkillIds);
        assert.deepEqual(migrateEngineerBuild(build), build);
      }
    }
  }
});

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

// Protocol kind and slot, rather than a fixed ID registry, govern selection and recorded-action rebinding.
test('morph selection and rebinding support catalog-owned protocol identities', () => {
  const remap = (id) => id + 1000000;
  const skills = engineerCatalog.skills.map((skill) => (skill.morphKind ? { ...skill, id: remap(skill.id) } : skill));
  const catalog = { ...engineerCatalog, skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) };
  const selected = DEFAULT_AMALGAM_MORPHS.map(remap);
  assert.equal(validAmalgamMorphs(catalog, selected), true);
  assert.deepEqual(normalizeAmalgamMorphs(catalog, selected), selected);
  const shred = amalgamProtocolOptions(catalog, 3).find((skill) => skill.morphKind === 'shred');
  assert.equal(resolveSelectedAmalgamMorphId(catalog, shred.id, selected), selected[0]);
  const changed = selectAmalgamMorph(catalog, selected, 1, shred.id);
  assert.equal(validAmalgamMorphs(catalog, changed), true);
  assert.equal(changed[1], shred.id);
  assert.equal(catalog.skillsById.get(changed[0]).morphKind, 'protect');
});
