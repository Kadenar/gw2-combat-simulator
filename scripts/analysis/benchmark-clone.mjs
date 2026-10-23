/** Compare the clone hot path and complete simulations without changing production files or native clone callers. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { cpus } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

// Build first: npm run build:modules
// node scripts/analysis/benchmark-clone.mjs --report .scratch/clone-benchmark.json
const root = path.resolve(import.meta.dirname, '../..');
const { values } = parseArgs({
  options: {
    filter: { type: 'string', default: '' },
    rounds: { type: 'string', default: '15' },
    warmups: { type: 'string', default: '5' },
    report: { type: 'string' }
  }
});
const rounds = Number(values.rounds);
const warmups = Number(values.warmups);
assert.ok(Number.isSafeInteger(rounds) && rounds > 0);
assert.ok(Number.isSafeInteger(warmups) && warmups >= 0);

// A benchmark-only live export switches implementations before each run, with no dispatch wrapper in timed calls.
const cloneUrl = pathToFileURL(path.join(root, 'dist/js/kernel/core/clone.js')).href;
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);

    if (url !== cloneUrl) return loaded;

    const source = String(loaded.source);
    assert.ok(source.includes('export function cloneData('), 'Revisit benchmark hook after clone API changes.');
    return {
      ...loaded,
      source:
        source.replace('export function cloneData(', 'export function customCloneData(') +
        '\nexport let cloneData = customCloneData;\n' +
        'export function useClone(implementation) { cloneData = implementation; }\n'
    };
  }
});
const { customCloneData, useClone } = await import(cloneUrl);
const { loadBuildContext } = await import('#gw2/build-context/load.js');
const { deterministicSimulationConfig } = await import('#gw2/build-context/simulation-config.js');
const { normalizeTransitionDelays } = await import('#gw2/platform/execution/transition-lockouts.js');
const { professionOptions } = await import('#gw2/profession-registry.js');
const { simulateGw2 } = await import('#gw2/platform/simulation/simulate.js');
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const cases = [];
for (const { id: profession } of professionOptions) {
  const adapter = await loadBuildContext(profession);
  const manifest = await readJson(`data/gw2/builds/${profession}/manifest.json`);
  for (const section of manifest) {
    for (const preset of section.presets) {
      if (!preset.rotation) continue;

      const id = `${profession}|${section.section || ''}|${preset.label}`;

      if (!id.toLowerCase().includes(values.filter.toLowerCase())) continue;

      const [savedBuild, savedRotation] = await Promise.all([readJson(preset.build), readJson(preset.rotation)]);
      const build = adapter.toApplicationBuild({ ...savedBuild, rotation: savedRotation.rotation ?? savedRotation });
      const context = adapter.createBuildContext({
        build,
        transitionDelays: normalizeTransitionDelays(),
        patch: adapter.profession.resolvePatch({ id: 'current' })
      });
      cases.push({
        id,
        profession,
        options: {
          profession: context.profession,
          rotation: build.rotation,
          config: deterministicSimulationConfig(context.simulationConfig())
        }
      });
    }
  }
}

assert.ok(cases.length, 'No matching presets.');

// Audit actual inputs outside measurement; memoization is per call because simulation objects can later mutate.
function checkPlainData(value, seen = new Set()) {
  assert.ok(!['function', 'symbol'].includes(typeof value), 'Unsupported primitive');

  if (value === null || typeof value !== 'object' || seen.has(value)) return;

  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  const array = prototype === Array.prototype;
  assert.ok(array || prototype === Object.prototype || prototype === null, 'Non-plain input');
  assert.equal(Object.getOwnPropertySymbols(value).length, 0, 'Symbol keys');
  assert.ok(!Object.hasOwn(value, '__proto__'), 'Own __proto__');
  const keys = Object.keys(value);

  if (array) {
    assert.equal(keys.length, value.length, 'Sparse array or extra properties');
    for (let index = 0; index < value.length; index++) assert.equal(keys[index], String(index), 'Non-dense array');
  }

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert.ok(Object.hasOwn(descriptor, 'value'), 'Accessor');
    checkPlainData(descriptor.value, seen);
  }
}

// Deterministic reservoirs retain detached real inputs for a separate, bounded clone-only benchmark.
const corpus = { packet: { count: 0, inputs: [], capacity: 256 }, report: { count: 0, inputs: [], capacity: 32 } };
let randomState = 123456789;
let cloneCalls = 0;
function auditedClone(value) {
  checkPlainData(value);
  const copied = customCloneData(value);
  assert.ok(isDeepStrictEqual(copied, structuredClone(value)), 'Clone output differs');
  cloneCalls++;
  const bucket = Array.isArray(value) || (value && Object.hasOwn(value, 'tracks')) ? corpus.report : corpus.packet;
  bucket.count++;
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  const index =
    bucket.inputs.length < bucket.capacity ? bucket.inputs.length : Math.floor((randomState / 2 ** 32) * bucket.count);

  if (index < bucket.capacity) bucket.inputs[index] = structuredClone(value);

  return copied;
}

const parity = [];
for (const [index, entry] of cases.entries()) {
  const row = { id: entry.id, cloneCalls: 0, outputsEqual: [], warnings: {} };
  const before = cloneCalls;
  for (const output of ['detailed', 'score']) {
    useClone(auditedClone);
    const custom = simulateGw2({ ...entry.options, output });
    useClone(structuredClone);
    const native = simulateGw2({ ...entry.options, output });
    // Live A/B comparison only: no saved result snapshots or numerical preset regressions.
    assert.ok(isDeepStrictEqual(custom, native), `${entry.id}/${output}: simulation results differ`);
    row.outputsEqual.push(output);
    row.warnings[output] = custom.warnings;
  }

  row.cloneCalls = cloneCalls - before;
  parity.push(row);

  if ((index + 1) % 10 === 0 || index + 1 === cases.length)
    console.error(`Audited ${index + 1}/${cases.length} presets`);
}

const implementations = { custom: customCloneData, native: structuredClone };
const median = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function summarize(samples) {
  const customMs = median(samples.custom);
  const nativeMs = median(samples.native);
  return {
    customMs,
    nativeMs,
    nativeOverCustom: nativeMs / customMs,
    reductionPercent: 100 * (1 - customMs / nativeMs),
    samples
  };
}

// Time the first and last matching manifest presets per profession, covering all professions without timing every preset.
const selected = professionOptions.flatMap(({ id }) => {
  const entries = cases.filter((entry) => entry.profession === id);
  return [...new Set([entries[0], entries.at(-1)])].filter(Boolean);
});
const timings = selected.flatMap((entry) =>
  ['detailed', 'score'].map((output) => ({ entry, output, samples: { custom: [], native: [] } }))
);
for (let round = -warmups; round < rounds; round++) {
  for (const timing of round % 2 ? [...timings].reverse() : timings) {
    for (const name of round % 2 ? ['native', 'custom'] : ['custom', 'native']) {
      useClone(implementations[name]);
      const start = performance.now();
      simulateGw2({ ...timing.entry.options, output: timing.output });
      const elapsed = performance.now() - start;

      if (round >= 0) timing.samples[name].push(elapsed);
    }
  }

  console.error(`Simulation round ${round + 1}/${rounds} (${warmups} warmups)`);
}

const microbenchmarks = {};
for (const [name, bucket] of Object.entries(corpus)) {
  if (!bucket.inputs.length) continue;

  const samples = { custom: [], native: [] };
  const batches = name === 'packet' ? 100 : 1;
  let sink;
  for (let round = -warmups; round < rounds; round++) {
    for (const implementation of round % 2 ? ['native', 'custom'] : ['custom', 'native']) {
      const clone = implementations[implementation];
      const start = performance.now();
      for (let batch = 0; batch < batches; batch++) {
        for (const input of bucket.inputs) sink = clone(input);
      }

      const elapsed = performance.now() - start;

      if (round >= 0) samples[implementation].push(elapsed);
    }
  }

  assert.ok(sink !== undefined || bucket.inputs.at(-1) === undefined);
  microbenchmarks[name] = {
    observedCalls: bucket.count,
    corpusSize: bucket.inputs.length,
    clonesPerSample: batches * bucket.inputs.length,
    ...summarize(samples)
  };
}

const simulations = timings.map(({ entry, output, samples }) => ({ id: entry.id, output, ...summarize(samples) }));
const totals = Object.fromEntries(
  ['detailed', 'score'].map((output) => {
    const matching = simulations.filter((row) => row.output === output);
    const samples = Object.fromEntries(
      ['custom', 'native'].map((name) => [
        name,
        Array.from({ length: rounds }, (_, index) => matching.reduce((sum, row) => sum + row.samples[name][index], 0))
      ])
    );
    return [output, summarize(samples)];
  })
);
const report = {
  node: process.version,
  v8: process.versions.v8,
  platform: process.platform,
  cpu: cpus()[0]?.model,
  warmups,
  rounds,
  auditedPresets: cases.length,
  cloneCalls,
  parity,
  microbenchmarks,
  totals,
  simulations
};

if (values.report) await writeFile(path.resolve(values.report), `${JSON.stringify(report, null, 2)}\n`);

// Keep warnings attributable even when the caller requests only the console summary rather than a full report.
const warnings = parity
  .filter((row) => Object.values(row.warnings).some((entries) => entries.length))
  .map(({ id, warnings }) => ({ id, warnings }));
console.log(JSON.stringify({ ...report, parity: undefined, simulations: undefined, warnings }, null, 2));
