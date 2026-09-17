/** Measures the unchanged application/engine boundary so later migration stages have reproducible workloads. */
/* global window, Worker, requestAnimationFrame */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release, totalmem } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const readJson = async (file) => JSON.parse(await readFile(path.join(repoRoot, file), 'utf8'));
const samples = 7;
const warmups = 3;

// Keep raw observations alongside summaries; a seven-sample p95 is the maximum, not a stable population estimate.
function summarize(values) {
  assert.ok(values.length > 0 && values.every((value) => Number.isFinite(value) && value >= 0));
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samplesMs: values,
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]
  };
}

function measure(run) {
  const values = [];
  for (let index = -warmups; index < samples; index++) {
    const started = performance.now();
    run();
    if (index >= 0) values.push(performance.now() - started);
  }

  return summarize(values);
}

assert.equal(typeof globalThis.gc, 'function', 'Run with node --expose-gc to measure post-GC retained heap.');
assert.equal(summarize([3, 1, 2]).medianMs, 2);
const importStarted = performance.now();
const { loadProfessionAppAdapter } = await import('#gw2/app/profession/registry.js');
const { simulateGw2 } = await import('#gw2/platform/simulation/simulate.js');
const importMs = performance.now() - importStarted;
const workloads = [];
for (const profession of ['guardian', 'thief', 'ranger']) {
  const manifest = await readJson(`data/gw2/builds/${profession}/manifest.json`);
  const presets = manifest.flatMap((section) => section.presets);
  const preset =
    profession === 'guardian'
      ? presets.find((entry) => entry.build.endsWith('/b-condi-willbender-pistol-torch.json'))
      : presets.find((entry) => entry.rotation);
  assert.ok(preset?.rotation, `${profession}: missing benchmark preset`);
  const savedBuild = await readJson(preset.build);
  const savedRotation = await readJson(preset.rotation);
  const adapterStarted = performance.now();
  const adapter = await loadProfessionAppAdapter(profession);
  const adapterLoadMs = performance.now() - adapterStarted;
  const build = adapter.toApplicationBuild({ ...savedBuild, rotation: savedRotation.rotation ?? savedRotation });
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    attributeWeaponSet: 1,
    patchId: 'current',
    gameId: 'gw2',
    contentId: profession
  };
  adapter.recalculate(app);
  const config = adapter.baselineSimulationRequest(app).baseConfig;
  const options = { profession: adapter.profession, rotation: build.rotation, config };
  const warnings = new Set();
  const run = (output = 'detailed') => {
    const result = simulateGw2({ ...options, output });
    assert.ok(Number.isFinite(result.dps) && result.dps > 0, `${profession}: invalid score`);
    result.warnings.forEach((warning) => warnings.add(warning));
    return result;
  };

  const coldStarted = performance.now();
  app.results = run();
  const coldSimulationMs = performance.now() - coldStarted;
  const detailed = measure(() => run());
  const score = measure(() => run('score'));
  const prefix = {};
  for (const [label, index] of [
    ['start', 0],
    ['middle', Math.floor(build.rotation.length / 2)],
    ['append', build.rotation.length]
  ]) {
    // Force replay rather than measuring the append fast path that reuses an existing result.
    const replayApp = { ...app, results: null };
    prefix[label] = measure(() => assert.ok(Number.isFinite(adapter.rotationEndStateAt(replayApp, index).time)));
  }

  const retainedHeapBytes = [];
  globalThis.gc();
  retainedHeapBytes.push(process.memoryUsage().heapUsed);
  const batchStarted = performance.now();
  for (let batch = 0; batch < 2; batch++) {
    for (let index = 0; index < 10; index++) run('score');
    globalThis.gc();
    retainedHeapBytes.push(process.memoryUsage().heapUsed);
  }

  const batch20WithGcMs = performance.now() - batchStarted;
  const inputs = {};
  for (const file of [preset.build, preset.rotation]) {
    inputs[file] = createHash('sha256')
      .update(JSON.stringify(await readJson(file)))
      .digest('hex');
  }

  workloads.push({
    profession,
    preset: preset.label,
    inputs,
    adapterLoadMs,
    coldSimulationMs,
    detailed,
    score,
    prefix,
    batch20WithGcMs,
    retainedHeapBytes,
    dps: app.results.dps,
    warnings: [...warnings]
  });
}

const assets = await readdir(path.join(repoRoot, 'dist/site/assets'));
const bundle = { jsBytes: 0, jsGzipBytes: 0, baselineWorkerEntryBytes: 0 };
for (const file of assets.filter((file) => file.endsWith('.js'))) {
  const content = await readFile(path.join(repoRoot, 'dist/site/assets', file));
  bundle.jsBytes += content.length;
  bundle.jsGzipBytes += gzipSync(content).length;
  if (file.startsWith('baseline-simulation-worker-')) bundle.baselineWorkerEntryBytes += content.length;
}

// Production assets avoid measuring Vite's development transforms as application worker startup.
const server = await preview({ root: repoRoot, preview: { host: '127.0.0.1', port: 4181, strictPort: true } });
let browser;
let browserMeasurements;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const loadStarted = performance.now();
  await page.goto('http://127.0.0.1:4181/guardian.html');
  await page.waitForFunction(() => window.professionApp?.simulationStatus === 'idle');
  const pageReadyMs = performance.now() - loadStarted;
  const build = await readJson('data/gw2/builds/guardian/b-condi-willbender-pistol-torch.json');
  const rotation = await readJson('data/gw2/rotations/guardian/r-condi-willbender-pistol-torch-bench.json');
  await page.evaluate(
    async ({ build, rotation }) => {
      const app = window.professionApp;
      // Isolate baseline latency; these unrelated automatic analyses have separate benchmark tools.
      for (const runner of [app.randomDistributionRunner, app.modifierContributionRunner, app.relicComparisonRunner]) {
        runner.cancel();
        runner.schedule = () => {};
      }

      app.build = app.adapter.toApplicationBuild({ ...build, rotation: rotation.rotation ?? rotation });
      app.changed();
    },
    { build, rotation }
  );
  await page.waitForFunction(() => window.professionApp.resultRevision === window.professionApp.buildRevision);
  const workerUrl = page
    .workers()
    .find((worker) => worker.url().includes('baseline-simulation-worker'))
    ?.url();
  assert.ok(workerUrl, 'The production baseline worker must be present.');
  const measurements = await page.evaluate(
    async ({ workerUrl, samples }) => {
      const app = window.professionApp;
      const request = app.adapter.baselineSimulationRequest(app);
      const send = (worker, message) =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Baseline worker timed out'));
          }, 60_000);
          const cleanup = () => {
            clearTimeout(timeout);
            worker.removeEventListener('message', receive);
            worker.removeEventListener('error', fail);
          };

          const fail = (event) => {
            cleanup();
            reject(new Error(event.message));
          };

          const receive = ({ data }) => {
            if (data.requestId !== message.requestId) return;
            cleanup();
            if (data.error) reject(new Error(data.error));
            else resolve(data);
          };

          worker.addEventListener('message', receive);
          worker.addEventListener('error', fail);
          worker.postMessage(message);
        });
      const startup = [];
      const roundTrip = [];
      const workerWarnings = new Set();
      for (let run = 0; run < 3; run++) {
        const started = performance.now();
        const worker = new Worker(workerUrl, { type: 'module' });
        try {
          await send(worker, { requestId: 0, revision: -1, warmup: true, request });
          startup.push(performance.now() - started);
          // The final fresh worker supplies a first run and seven warm round trips, including cloning.
          if (run === 2) {
            for (let index = -1; index < samples; index++) {
              const begin = performance.now();
              const data = await send(worker, { requestId: index + 2, revision: 1, request });
              if (!Number.isFinite(data.output?.result?.dps)) throw new Error('Invalid browser worker result');
              data.output.result.warnings.forEach((warning) => workerWarnings.add(warning));
              if (index >= 0) roundTrip.push(performance.now() - begin);
            }
          }
        } finally {
          worker.terminate();
        }
      }

      const edits = [];
      // Append/remove one ordinary wait through the actual edit path; include debounce, worker, and render costs.
      const original = app.build.rotation;
      for (let index = -1; index < samples; index++) {
        app.build.rotation = index % 2 === 0 ? [...original, { type: 'wait', durationMs: 1 }] : [...original];
        const started = performance.now();
        app.changed(false);
        const deadline = started + 60_000;
        while (app.resultRevision !== app.buildRevision) {
          if (app.simulationStatus === 'error' || performance.now() > deadline)
            throw new Error(app.simulationError || 'Edit timed out');
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (index >= 0) edits.push(performance.now() - started);
      }

      return {
        startup,
        roundTrip,
        edits,
        warnings: [...workerWarnings],
        pageHeapBytes: performance.memory?.usedJSHeapSize ?? null
      };
    },
    { workerUrl, samples }
  );
  assert.deepEqual(pageErrors, [], 'Browser page errors');
  browserMeasurements = {
    version: browser.version(),
    pageReadyMs,
    workerStartup: summarize(measurements.startup),
    workerRoundTrip: summarize(measurements.roundTrip),
    editToPaint: summarize(measurements.edits),
    warnings: measurements.warnings,
    pageHeapBytes: measurements.pageHeapBytes
  };
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => (error ? reject(error) : resolve())));
}

const report = {
  capturedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
  environment: {
    node: process.version,
    platform: platform(),
    osRelease: release(),
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem()
  },
  samples,
  warmups,
  importMs,
  workloads,
  browser: browserMeasurements,
  bundle,
  peakRssBytes: process.resourceUsage().maxRSS * 1024
};
const output = path.resolve(repoRoot, process.argv[2] ?? '.scratch/gw2combat-phase-3-baseline.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Baseline recorded: ${output}`);
