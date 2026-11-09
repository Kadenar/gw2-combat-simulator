// Import preserves both equipment sets without replaying a manifest rotation.
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

test('Ranger import preserves spear and alternate dual-wield equipment', async () => {
  const adapter = await loadProfessionAppAdapter('ranger');
  const build = adapter.toApplicationBuild({
    ...adapter.profession.createBuildDefaults(),
    weapons: ['Spear', ''],
    alternateWeapons: ['Axe', 'Axe'],
    weaponSigils: [
      ['Force', 'Impact'],
      ['Force', 'Impact']
    ]
  });
  assert.deepEqual(build.weapons, ['Spear', '']);
  assert.deepEqual(build.alternateWeapons, ['Axe', 'Axe']);
  assert.deepEqual(build.weaponSigils, [
    ['Force', 'Impact'],
    ['Force', 'Impact']
  ]);
});
