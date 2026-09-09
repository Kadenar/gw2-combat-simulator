import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Runtime assets have one game-owned public location so deployment does not duplicate presets.
test('runtime data declares only game namespaced public paths', async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const manifest = JSON.parse(await readFile(path.join(root, 'data/games.json'), 'utf8'));
  const gw2 = manifest.games.find(({ id }) => id === 'gw2');

  assert.deepEqual(gw2.runtimeData, [
    {
      kind: 'builds',
      source: 'data/gw2/builds',
      publicPath: 'data/gw2/builds'
    },
    {
      kind: 'rotations',
      source: 'data/gw2/rotations',
      publicPath: 'data/gw2/rotations'
    }
  ]);
});
