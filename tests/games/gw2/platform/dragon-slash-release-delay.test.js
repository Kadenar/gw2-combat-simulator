import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { warriorCatalog } from '#gw2/professions/warrior/profession.js';
import {
  createWarriorBuildDefaults,
  migrateWarriorBuild,
  validateWarriorBuild
} from '#gw2/professions/warrior/build/build.js';

// Saved holds survive canonical loading; zero means the ordinary release and invalid timing stays visible.
test('Dragon Slash release delays survive saved-build loading and clear at zero', () => {
  const command = { type: 'cast', skillId: 62797, releaseAtCharges: 10, releaseDelayMs: 80 };
  const build = { ...createWarriorBuildDefaults(), rotation: [command] };
  assert.equal(validateWarriorBuild(build).valid, true);
  assert.deepEqual(migrateWarriorBuild(JSON.parse(JSON.stringify(build))).rotation, [command]);
  assert.deepEqual(normalizeRotation([{ ...command, releaseDelayMs: 0 }], warriorCatalog, { strict: true }), [
    { type: 'cast', skillId: 62797, releaseAtCharges: 10 }
  ]);
  for (const value of [-40, Infinity, NaN]) {
    assert.throws(
      () => normalizeRotation([{ ...command, releaseDelayMs: value }], warriorCatalog, { strict: true }),
      /Release delay/
    );
    assert.equal(validateWarriorBuild({ ...build, rotation: [{ ...command, releaseDelayMs: value }] }).valid, false);
  }

  for (const other of [
    { type: 'wait', durationMs: 80 },
    { type: 'cast', skillId: 14364 }
  ]) {
    assert.match(
      validateWarriorBuild({ ...build, rotation: [{ ...other, releaseDelayMs: 80 }] }).errors.join(' '),
      /only Dragon Slash/
    );
  }
});
