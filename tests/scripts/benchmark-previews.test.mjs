import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { benchmarkPreviews, createPreviewGenerator } from '../../scripts/build/benchmark-previews.mjs';
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
    generator.invalidate();
    assert.deepEqual(await equipment(), [{ label: 'Updated', value: 'Sword' }]);
    await writeFile(path.join(root, 'data/gw2/builds/revenant/manifest.json'), '[]');
    assert.equal((await generator.generate()).size, 0);
  } finally {
    await generator?.close();
    await rm(root, { recursive: true, force: true });
  }
});

// Exercise the dev middleware with real source loading, without involving browser rendering or the full game.
test('dev previews are lazy, scoped, cached, invalidated, and retryable', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'gw2-preview-dev-'));
  const build = 'data/gw2/builds/revenant/test.json';
  const otherBuild = 'data/gw2/builds/revenant/other.json';
  const source = 'js/games/gw2/app/page/benchmark-preview-generation.ts';
  const files = {
    'js/games/gw2/profession-registry.ts': `import process from 'node:process';
      export const professionRegistry = [
      { id: 'revenant', loadAppAdapter: async () => {
        await new Promise(resolve => { if (!process.emit(${JSON.stringify(root)}, resolve)) resolve(); });
        return {};
      } },
      { id: 'mesmer', loadAppAdapter: async () => { throw new Error('Unrequested profession loaded'); } }
    ];`,
    'js/games/gw2/app/page/benchmarks.ts': `export const readBenchmarks = (_entry, manifest) => manifest;`,
    [source]: `let count = 0;
      export const createBenchmarkPreview = (_adapter, candidate, build) => ({
        build, equipment: [{ label: String(++count), value: candidate.weapon }], specializations: [], skills: []
      });`,
    'js/games/gw2/app/page/benchmark-preview-data.ts': await readFile(
      new URL('../../js/games/gw2/app/page/benchmark-preview-data.ts', import.meta.url),
      'utf8'
    ),
    'data/gw2/builds/revenant/manifest.json': JSON.stringify([{ build }, { build: otherBuild }]),
    'data/gw2/builds/mesmer/manifest.json': JSON.stringify([{ build: 'data/gw2/builds/mesmer/broken.json' }]),
    [build]: JSON.stringify({ weapon: 'Hammer' }),
    [otherBuild]: 'invalid JSON'
  };

  const watcher = new EventEmitter();
  watcher.add = () => {};

  const messages = [];
  const errors = [];
  let middleware;
  const plugin = benchmarkPreviews();
  t.after(async () => {
    await plugin.closeBundle();
    assert.equal(watcher.listenerCount('all'), 0);
    await rm(root, { recursive: true, force: true });
  });
  plugin.configResolved({ root });
  await plugin.configureServer({
    watcher,
    middlewares: { use: (handler) => (middleware = handler) },
    config: { logger: { error: (message) => errors.push(message) } },
    ws: { send: (message) => messages.push(message) }
  });

  async function request(url) {
    const headers = {};
    let body;
    const response = { setHeader: (key, value) => (headers[key] = value), end: (value) => (body = value) };
    await middleware({ url }, response, () => (response.statusCode = 204));
    return { status: response.statusCode, headers, body: body && JSON.parse(body) };
  }

  const changed = (file) => watcher.emit('all', 'change', path.join(root, file));
  const url = `/${benchmarkPreviewPath(build)}`;
  const otherUrl = `/${benchmarkPreviewPath(otherBuild)}`;

  // No source files exist yet: startup, unrelated requests, and invalid paths must not load the generator.
  assert.equal((await request('/index.html')).status, 204);
  assert.equal((await request('/data/gw2/benchmark-previews/revenant/nested/file.json')).status, 404);
  changed(build);
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.deepEqual(messages, [{ type: 'full-reload' }]);
  assert.deepEqual(errors, []);
  for (const [file, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), contents);
  }

  const [first, concurrent] = await Promise.all([request(url), request(url)]);
  assert.equal(first.status, 200);
  assert.equal(first.headers['Cache-Control'], 'no-store');
  assert.deepEqual(first.body.equipment, [{ label: '1', value: 'Hammer' }]);
  assert.deepEqual(concurrent, first);
  assert.deepEqual(await request(url), first);
  changed('css/style.css');
  assert.deepEqual(await request(url), first);
  assert.equal((await request('/data/gw2/benchmark-previews/revenant/unlisted.json')).status, 404);

  // A malformed requested preset fails in isolation, and a later request can retry without a poisoned cache.
  assert.equal((await request(otherUrl)).status, 500);
  assert.equal(errors.length, 1);
  await writeFile(path.join(root, otherBuild), JSON.stringify({ weapon: 'Staff' }));
  const other = await request(otherUrl);
  assert.equal(other.status, 200);
  assert.deepEqual(other.body.equipment, [{ label: '2', value: 'Staff' }]);
  assert.deepEqual(await request(url), first);

  await writeFile(path.join(root, build), JSON.stringify({ weapon: 'Sword' }));
  changed(build);
  assert.deepEqual((await request(url)).body.equipment, [{ label: '1', value: 'Sword' }]);
  await writeFile(path.join(root, source), files[source].replace('String(++count)', '`Updated ${++count}`'));
  changed(source);
  assert.deepEqual((await request(url)).body.equipment, [{ label: 'Updated 1', value: 'Sword' }]);

  // An edit during a suspended load must invalidate that result before an awaiting client receives it.
  changed(build);
  let release;
  const started = new Promise((resolve) => {
    process.once(root, (resume) => {
      release = resume;
      resolve();
    });
  });
  const inFlight = request(url);
  await started;
  try {
    await writeFile(path.join(root, build), JSON.stringify({ weapon: 'Axe' }));
    changed(build);
  } finally {
    release();
  }

  assert.deepEqual((await inFlight).body.equipment, [{ label: 'Updated 1', value: 'Axe' }]);
  await writeFile(path.join(root, 'data/gw2/builds/revenant/manifest.json'), '[]');
  changed('data/gw2/builds/revenant/manifest.json');
  assert.equal((await request(url)).status, 404);
});
