import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  toApplicationBuild,
  validateMesmerBuild
} from '#gw2/professions/mesmer/build/build.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

// Shared labels never choose a different variant while loading a saved build.
test('Mesmer build loading preserves explicit variant IDs across specialization selections', () => {
  const rotation = [ID.BLADECALL, ID.BLADECALL_NON_VIRTUOSO, ID.AXES_OF_SYMMETRY, ID.AXES_OF_SYMMETRY_NON_MIRAGE].map(
    (skillId) => ({ type: 'cast', skillId })
  );
  for (const load of [migrateMesmerBuild, toApplicationBuild]) {
    for (const specialization of ['Core', 'Mirage', 'Virtuoso', 'Troubadour']) {
      const build = load({ ...createMesmerBuildDefaults(), specialization, rotation });
      assert.deepEqual(build.rotation, rotation);
      assert.deepEqual(validateMesmerBuild(build), { valid: true, errors: [] });
    }
  }
});

// A display label is optional metadata, while a missing cast identity is invalid input.
test('Mesmer loading uses supplied IDs and drops name-only cast objects', () => {
  const build = migrateMesmerBuild({
    ...createMesmerBuildDefaults(),
    rotation: [
      { type: 'cast', skillId: ID.BLADECALL_NON_VIRTUOSO, name: 'Bladecall' },
      { type: 'cast', name: 'Bladecall' }
    ]
  });
  assert.deepEqual(build.rotation, [{ type: 'cast', skillId: ID.BLADECALL_NON_VIRTUOSO }]);
});
