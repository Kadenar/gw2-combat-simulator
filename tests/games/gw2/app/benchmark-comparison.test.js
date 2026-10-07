import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  comparisonKey,
  comparisonResult,
  comparisonDamageAt,
  comparisonDpsAt,
  comparisonCurve
} from '#gw2/app/page/benchmark-comparison/model.js';
import { ComparisonRunner } from '#gw2/app/page/benchmark-comparison/runner.js';
import { prepareComparisonRequest } from '#gw2/app/page/benchmark-comparison/request.js';
import { loadProfessionAppAdapter } from '#gw2/profession-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// A minimal observation window protects packet ownership, tied boundaries, and rolling-DPS semantics.
const result = () =>
  comparisonResult({
    dpsStartTime: 10,
    combatEndTime: 16,
    deathTime: null,
    totalDamage: 180,
    dps: 30,
    warnings: ['Example warning'],
    resolvedEvents: [
      { type: 'damage', at: 9, damage: 999 },
      { type: 'damage', at: 10, damage: 30 },
      { type: 'damage', at: 11, damage: 20 },
      {
        type: 'condition',
        at: 10,
        damage: 999,
        damageTicks: [
          { at: 11, damage: 40 },
          { at: 15, damage: 50 },
          { at: 17, damage: 999 }
        ]
      },
      { type: 'damage', at: 16, damage: 40 },
      { type: 'action', at: 12, damage: 999 }
    ]
  });

test('comparison uses exact damage at boundaries and omits events outside the observation window', () => {
  const output = result();
  assert.equal(comparisonDamageAt(output.damage, -1), 0);
  assert.equal(comparisonDamageAt(output.damage, 0), 30);
  assert.equal(comparisonDamageAt(output.damage, 999), 30);
  assert.equal(comparisonDamageAt(output.damage, 1000), 90);
  assert.equal(comparisonDamageAt(output.damage, 6000), 180);
  assert.equal(comparisonDamageAt(output.damage, 9000), 180);
  assert.deepEqual(output.warnings, ['Example warning']);
  assert.equal(output.targetDied, false);
});

test('average and rolling DPS use partial windows and return no value after a run ends', () => {
  const output = result();
  assert.equal(comparisonDpsAt(output, 0, 'average'), 0);
  assert.equal(comparisonDpsAt(output, 500, '1'), 60);
  assert.equal(comparisonDpsAt(output, 1000, '1'), 90);
  assert.equal(comparisonDpsAt(output, 2000, '1'), 0);
  assert.equal(comparisonDpsAt(output, 6000, '5'), 18);
  assert.equal(comparisonDpsAt(output, 6000, 'average'), 30);
  assert.equal(comparisonDpsAt(output, 6001, 'average'), null);
  assert.equal(comparisonCurve(output, 'average').at(-1).v, 30);
});

const row = (id) => ({ profession: 'mesmer', build: `${id}.json`, rotation: `${id}-rotation.json`, label: id });
const deferred = () => Promise.withResolvers();

test('comparison runner bounds concurrency, retains successful caches, and isolates failures', async () => {
  const jobs = [];
  const runner = new ComparisonRunner(
    (preset, signal) => {
      const pending = deferred();
      jobs.push({ preset, signal, ...pending });
      return pending.promise;
    },
    () => {}
  );
  const rows = [row('a'), row('b'), row('c')];
  const done = runner.run(rows);
  assert.equal(jobs.length, 2);
  jobs[0].resolve(result());
  await Promise.resolve();
  assert.equal(jobs.length, 3);
  jobs[1].reject(new Error('Missing rotation'));
  jobs[2].resolve(result());
  await done;
  assert.equal(runner.running, false);
  assert.equal(runner.entries.get(comparisonKey(rows[1])).error, 'Missing rotation');
  const retry = runner.run(rows);
  assert.equal(jobs.length, 4);
  assert.equal(jobs[3].preset.build, rows[1].build);
  jobs[3].resolve(result());
  await retry;
  await runner.run(rows);
  assert.equal(jobs.length, 4);
});

test('cancellation aborts active work and stale completions cannot overwrite restarted results', async () => {
  const jobs = [];
  const runner = new ComparisonRunner(
    (preset, signal) => {
      const pending = deferred();
      jobs.push({ signal, ...pending });
      return pending.promise;
    },
    () => {}
  );
  const selected = row('same');
  const first = runner.run([selected]);
  runner.cancel();
  assert.equal(jobs[0].signal.aborted, true);
  assert.equal(runner.entries.size, 0);
  const second = runner.run([selected]);
  jobs[0].resolve(result());
  await first;
  assert.equal(runner.running, true);
  assert.equal(runner.entries.get(comparisonKey(selected)).status, 'running');
  const latest = { ...result(), warnings: [] };
  jobs[1].resolve(latest);
  await second;
  assert.equal(runner.entries.get(comparisonKey(selected)).result, latest);
});

test('cache identity includes profession and rotation, not the display label', () => {
  assert.equal(comparisonKey(row('a')), comparisonKey({ ...row('a'), label: 'Renamed' }));
  assert.notEqual(comparisonKey(row('a')), comparisonKey({ ...row('a'), rotation: 'variant.json' }));
  assert.notEqual(comparisonKey(row('a')), comparisonKey({ ...row('a'), profession: 'guardian' }));
});

// These smoke tests exercise canonical preset preparation and compare only total DPS to manifest values.
for (const profession of ['guardian', 'mesmer']) {
  test(`comparison prepares and simulates a saved ${profession} preset through the canonical pipeline`, async () => {
    const load = async (path) => JSON.parse(await readFile(new URL(`../../../../${path}`, import.meta.url), 'utf8'));
    const manifest = await load(`data/gw2/builds/${profession}/manifest.json`);
    const preset = manifest
      .flatMap((section) => section.presets)
      .find((preset) => preset.rotation && preset.upToDate !== false);
    const adapter = await loadProfessionAppAdapter(profession);
    const build = await load(preset.build);
    const rotation = await load(preset.rotation);
    assert.throws(() => prepareComparisonRequest(adapter, build, []), /saved rotation/);
    const request = prepareComparisonRequest(adapter, build, rotation.rotation ?? rotation);
    const output = simulateGw2({
      profession: adapter.profession,
      rotation: request.rotation,
      config: request.config,
      collectChartData: false
    });
    assert.ok(Math.abs(output.dps / preset.benchmarkDps - 1) <= 0.01);
    assert.deepEqual(output.warnings, [], `${profession}: ${preset.label}`);
  });
}
