import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPreviewGenerator } from '../../scripts/build/benchmark-previews.mjs';
import { professionRegistry } from '#gw2/profession-registry.js';
import { readBenchmarks } from '#gw2/app/page/benchmarks.js';
import { benchmarkPreviewPath, validateBenchmarkPreview } from '#gw2/app/page/benchmark-preview-data.js';

// Every listed benchmark, including outdated entries and shared build files, must have a deployable preview.
test('preview generation covers the manifests using source modules', async () => {
  const root = process.cwd();
  const generator = await createPreviewGenerator(root);
  try {
    const assets = await generator.generate();
    const expected = new Set();
    for (const entry of professionRegistry) {
      const manifest = JSON.parse(
        await readFile(path.join(root, 'data/gw2/builds', entry.id, 'manifest.json'), 'utf8')
      );
      for (const row of readBenchmarks(entry, manifest)) {
        const assetPath = benchmarkPreviewPath(row.build);
        expected.add(assetPath);
        const preview = validateBenchmarkPreview(JSON.parse(assets.get(assetPath)), row.build);
        assert.ok(preview.equipment.length > 0);
        assert.ok(preview.specializations.length > 0);
      }
    }

    assert.deepEqual(new Set(assets.keys()), expected);
  } finally {
    await generator.close();
  }
});

// A long-lived dev generator must reread presets and invalidate loaded source dependencies between refreshes.
test('preview refreshes pick up preset edits, source edits, and removed manifest entries', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gw2-preview-refresh-'));
  const build = 'data/gw2/builds/revenant/test.json';
  const files = {
    'js/games/gw2/profession-registry.ts': `import { name } from './name.ts';
      export const professionRegistry = [{ id: 'revenant', loadAppAdapter: async () => ({ name }) }];`,
    'js/games/gw2/name.ts': `export const name = 'Original';`,
    'js/games/gw2/app/page/benchmarks.ts': `export const readBenchmarks = (_entry, manifest) => manifest;`,
    'js/games/gw2/app/page/benchmark-preview-generation.ts': `export const createBenchmarkPreview = (adapter, candidate, build) => ({
      build, equipment: [{ label: adapter.name, value: candidate.weapon }], specializations: [], skills: []
    });`,
    'js/games/gw2/app/page/benchmark-preview-data.ts': await readFile(
      new URL('../../js/games/gw2/app/page/benchmark-preview-data.ts', import.meta.url),
      'utf8'
    ),
    'data/gw2/builds/revenant/manifest.json': JSON.stringify([{ build }]),
    [build]: JSON.stringify({ weapon: 'Hammer' })
  };
  let generator;
  try {
    for (const [file, contents] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), contents);
    }

    generator = await createPreviewGenerator(root);
    const equipment = async () => JSON.parse((await generator.generate()).get(benchmarkPreviewPath(build))).equipment;
    assert.deepEqual(await equipment(), [{ label: 'Original', value: 'Hammer' }]);
    await writeFile(path.join(root, build), JSON.stringify({ weapon: 'Sword' }));
    await writeFile(path.join(root, 'js/games/gw2/name.ts'), `export const name = 'Updated';`);
    assert.deepEqual(await equipment(), [{ label: 'Updated', value: 'Sword' }]);
    await writeFile(path.join(root, 'data/gw2/builds/revenant/manifest.json'), '[]');
    assert.equal((await generator.generate()).size, 0);
  } finally {
    await generator?.close();
    await rm(root, { recursive: true, force: true });
  }
});
