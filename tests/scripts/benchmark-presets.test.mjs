/** Benchmark preparation preserves saved inputs and manifest identity while measurement stays with each caller. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadBuildContext } from '#gw2/build-context/load.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { professionOptions } from '#gw2/profession-registry.js';

import { simulateBenchmarkPreset } from '../../scripts/analysis/capture-supported-build-metrics.mjs';
import {
  benchmarkProfessionIds,
  loadBenchmarkPresets,
  prepareBenchmarkPreset
} from '../../scripts/lib/benchmark-presets.mjs';

const collect = async (cases) => Array.fromAsync(cases);

test('manifest loading uses declared roots, skips build-only entries, and filters before reading inputs', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'gw2-benchmark-cases-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const writeJson = async (file, value) => {
    const destination = path.join(root, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(value));
  };

  await writeJson('data/games.json', {
    games: [{ id: 'gw2', runtimeData: [{ kind: 'builds', source: 'fixtures/builds' }] }]
  });
  const preset = {
    label: 'Selected',
    build: 'fixtures/build.json',
    rotation: 'fixtures/rotation.json',
    benchmarkDps: 123
  };
  await writeJson('fixtures/builds/warrior/manifest.json', [
    { section: 'Core', presets: [{ label: 'Build only', build: 'missing.json' }, preset] },
    {
      presets: [
        { ...preset, label: 'Another' },
        { label: 'Unselected', build: 'missing.json', rotation: 'missing.json' }
      ]
    }
  ]);
  await writeJson('fixtures/build.json', { assumptions: { might: 12 } });
  await writeJson('fixtures/rotation.json', { rotation: [] });

  const cases = await collect(loadBenchmarkPresets(['warrior'], { root, filter: 'WARRIOR|CORE|SELECTED' }));
  assert.equal(cases.length, 1);
  assert.deepEqual(cases[0].identity, {
    ...preset,
    id: 'warrior|Core|Selected',
    profession: 'warrior',
    section: 'Core'
  });
  assert.deepEqual(cases[0].savedBuild, { assumptions: { might: 12 } });
  assert.deepEqual(cases[0].savedRotation, { rotation: [] });
  assert.equal(cases[0].adapter, await loadBuildContext('warrior'));
  const [unsectioned] = await collect(loadBenchmarkPresets(['warrior'], { root, filter: '|another' }));
  assert.equal(unsectioned.identity.id, 'warrior||Another');
  assert.deepEqual(await collect(loadBenchmarkPresets(['warrior'], { root, filter: 'no match' })), []);
  await assert.rejects(collect(loadBenchmarkPresets(['warrior'], { root, filter: 'unselected' })), /ENOENT/);
});

test('benchmark loading derives professions from the registry and rejects invalid selections before IO', async () => {
  assert.deepEqual(
    benchmarkProfessionIds,
    professionOptions.map(({ id }) => id)
  );
  await assert.rejects(collect(loadBenchmarkPresets(['warrior', 'unknown'])), /Unknown professions: unknown/);
  await assert.rejects(collect(loadBenchmarkPresets([], { gameId: 'other' })), /has no benchmark simulator/);
});

test('preparation detaches builds, rotations, and patch configurations without imposing measurement settings', async () => {
  const adapter = await loadBuildContext('warrior');
  const savedBuild = adapter.profession.createBuildDefaults();
  const savedRotation = { rotation: [{ type: 'wait', durationMs: 100 }] };
  const identity = { id: 'fixture', profession: 'warrior' };
  const preset = { identity, adapter, savedBuild, savedRotation };
  const snapshot = structuredClone({ savedBuild, savedRotation });
  const current = prepareBenchmarkPreset(preset);
  const preview = prepareBenchmarkPreset(preset, activePatchPreview.id);
  const repeated = prepareBenchmarkPreset({ ...preset, savedRotation: savedRotation.rotation });

  assert.equal(current.identity, identity);
  assert.equal(current.profession, adapter.profession);
  assert.equal(current.config.patchId, 'current');
  assert.equal(preview.config.patchId, activePatchPreview.id);
  assert.deepEqual(current.config, repeated.config);
  assert.deepEqual(current.rotation, repeated.rotation);
  assert.notEqual(current.build, repeated.build);
  assert.notEqual(current.config, preview.config);
  current.rotation.push({ type: 'wait', durationMs: 200 });
  current.build.assumptions.might = 0;
  current.config.boons.might = 0;
  assert.deepEqual(prepareBenchmarkPreset(preset).config, repeated.config);
  assert.deepEqual({ savedBuild, savedRotation }, snapshot);
  assert.throws(() => prepareBenchmarkPreset(preset, 'missing'), /Unknown .*patch/);
});

test('preparation returns adapter configuration without invoking the simulator or forcing deterministic settings', () => {
  const config = { randomness: { mode: 'stochastic', seed: 42 }, boons: { might: 7 } };
  const patch = { id: 'preview' };
  const profession = {};
  const adapter = {
    profession: {
      resolvePatch: ({ id }) => {
        assert.equal(id, patch.id);
        return patch;
      }
    },
    toApplicationBuild: (build) => build,
    createBuildContext(input) {
      assert.equal(input.patch, patch);
      assert.ok(input.transitionDelays);
      return { profession, simulationConfig: () => config };
    }
  };
  const prepared = prepareBenchmarkPreset({ adapter, savedBuild: {}, savedRotation: [] }, patch.id);
  assert.equal(prepared.profession, profession);
  assert.equal(prepared.config, config);
});

test('representative manifest presets load and simulate with attributable warnings', async () => {
  for (const profession of ['warrior', 'guardian']) {
    // One saved case per owner proves the loading path without fixing its rotation shape or individual damage packets.
    const { value: preset } = await loadBenchmarkPresets([profession]).next();
    assert.ok(preset, profession);
    const { result } = simulateBenchmarkPreset(preset.adapter, preset.savedBuild, preset.savedRotation);
    assert.ok(Number.isFinite(result.dps) && result.dps > 0, preset.identity.id);
    assert.deepEqual(result.warnings, [], preset.identity.id);
  }
});
