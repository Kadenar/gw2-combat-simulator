import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfessionAppAdapter } from '../../../js/app/profession/registry.js';

const repoUrl = (path) => new URL(`../../../${path}`, import.meta.url);

// A two-skill rotation isolates the instant-cast scheduling rule without
// depending on the composition or indices of a saved full rotation.
test('delayed Tempest shouts do not advance the serial rotation lane', async () => {
  const [savedBuild, adapter] = await Promise.all([
    readFile(repoUrl('Builds/elementalist/b-condi-alac-tempest-pistol.json'), 'utf8').then(JSON.parse),
    loadProfessionAppAdapter('elementalist')
  ]);
  const build = adapter.toApplicationBuild({
    ...savedBuild,
    rotation: ['Feel the Burn!', 'Scorching Shot']
  });
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1
  };

  adapter.recalculate(app);
  const result = adapter.runSimulation(app);
  const [shout, followingSerialCast] = result.steps;

  assert.equal(shout.skill, 'Feel the Burn!');
  assert.equal(followingSerialCast.skill, 'Scorching Shot');
  assert.equal(shout.start, shout.end);
  assert.equal(followingSerialCast.start, shout.start);
  assert.equal(
    result.warnings.some((warning) => warning.includes('Feel the Burn!')),
    false
  );
});
