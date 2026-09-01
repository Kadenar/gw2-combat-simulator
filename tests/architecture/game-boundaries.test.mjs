import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// The manifest contract keeps runtime assets namespaced while preserving supported public aliases.
test('runtime data is game namespaced and declares legacy public aliases', async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const manifest = JSON.parse(await readFile(path.join(root, 'data/games.json'), 'utf8'));
  const gw2 = manifest.games.find(({ id }) => id === 'gw2');

  assert.deepEqual(
    gw2.runtimeData.map(({ source, publicPath, legacyPublicPaths }) => ({ source, publicPath, legacyPublicPaths })),
    [
      {
        source: 'data/gw2/builds',
        publicPath: 'data/gw2/builds',
        legacyPublicPaths: ['Builds']
      },
      {
        source: 'data/gw2/rotations',
        publicPath: 'data/gw2/rotations',
        legacyPublicPaths: ['Rotations']
      }
    ]
  );
});
