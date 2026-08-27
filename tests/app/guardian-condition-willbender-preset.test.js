import assert from 'node:assert/strict';
import test from 'node:test';

import { readFile } from 'node:fs/promises';

const repoUrl = (path) => new URL(`../../${path}`, import.meta.url);

test('Scepter/Pistol condition Willbender changes only the replaced weapon set and benchmark relic', async () => {
  const [pistolBuild, scepterBuild] = await Promise.all(
    [
      'data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json',
      'data/gw2/builds/guardian/b-condi-willbender-scepter-pistol.json'
    ].map((path) => readFile(repoUrl(path), 'utf8').then(JSON.parse))
  );

  // This variant preserves the established condition build except for its benchmark-specific weapon set and relic.
  assert.deepEqual(scepterBuild.alternateWeapons, ['Scepter', 'Pistol']);
  assert.equal(scepterBuild.relic, 'Warrior');
  assert.deepEqual(
    {
      ...scepterBuild,
      alternateWeapons: pistolBuild.alternateWeapons,
      relic: pistolBuild.relic
    },
    pistolBuild
  );
});
