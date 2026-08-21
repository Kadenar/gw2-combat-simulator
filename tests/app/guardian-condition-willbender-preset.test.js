import assert from 'node:assert/strict';
import test from 'node:test';

import { readFile } from 'node:fs/promises';

const repoUrl = (path) => new URL(`../../${path}`, import.meta.url);

test('Scepter/Pistol condition Willbender changes only the replaced weapon set', async () => {
  const [pistolBuild, scepterBuild] = await Promise.all(
    [
      'Builds/guardian/b-condi-willbender-pistol-torch.json',
      'Builds/guardian/b-condi-willbender-scepter-pistol.json'
    ].map((path) => readFile(repoUrl(path), 'utf8').then(JSON.parse))
  );

  // This variant intentionally preserves the established condition build while replacing Pistol/Pistol with Scepter/Pistol.
  assert.deepEqual(scepterBuild.alternateWeapons, ['Scepter', 'Pistol']);
  assert.deepEqual({ ...scepterBuild, alternateWeapons: pistolBuild.alternateWeapons }, pistolBuild);
});
