/** Profiles existing manifest rotations after warmup; loading and build preparation stay outside timed runs. */
import { mkdir, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { cpus } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';

import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

import { benchmarkProfessionIds, loadBenchmarkPresets, prepareBenchmarkPreset } from '../lib/benchmark-presets.mjs';

// Usage: node scripts/analysis/benchmark-supported-rotations.mjs [profession ...] > timings.json
// Add --filter Ritualist to match preset IDs, or --cpu-profile-dir .scratch/profiles for separate warmed CPU captures.
// Add --no-permanent-boons to measure generated boon pools without permanent boon assumptions.
// Player cast timings and recharge rates remain fixed by the engine even when boon presence assumptions are cleared.
const { values, positionals: requested } = parseArgs({
  allowPositionals: true,
  options: {
    filter: { type: 'string' },
    output: { type: 'string', default: 'detailed' },
    'no-permanent-boons': { type: 'boolean', default: false },
    'prefix-length': { type: 'string' },
    'cpu-profile-dir': { type: 'string' }
  }
});
const professions = requested.length ? requested : benchmarkProfessionIds;

if (!['detailed', 'score'].includes(values.output)) throw new TypeError('Output must be detailed or score.');

const prefixLength = values['prefix-length'] == null ? null : Number(values['prefix-length']);

if (prefixLength != null && (!Number.isSafeInteger(prefixLength) || prefixLength < 0)) {
  throw new TypeError('Prefix length must be a nonnegative safe integer.');
}

const cases = [];
for await (const preset of loadBenchmarkPresets(professions, { filter: values.filter })) {
  const { identity, profession, rotation, config } = prepareBenchmarkPreset(preset);

  // Explicitly clear every standard boon, including timing boons normally forced on by build preparation.
  if (values['no-permanent-boons'])
    config.boons = Object.fromEntries(GW2_STANDARD_BOONS.map((kind) => [kind, kind === 'might' ? 0 : false]));

  cases.push({
    id: identity.id,
    profession: identity.profession,
    build: identity.build,
    rotation: identity.rotation,
    benchmarkDps: identity.benchmarkDps,
    // Short prefixes exercise editor request overhead with the same preparation and warmup as full rotations.
    options: {
      profession,
      rotation: prefixLength == null ? rotation : rotation.slice(0, prefixLength),
      config,
      output: values.output
    },
    samples: []
  });
}

if (!cases.length) throw new TypeError(`No presets matched filter: ${values.filter}`);

const warmups = 5;
const repetitions = 15;
const roundMs = [];
// Alternate traversal order to reduce bias from JIT warmup, garbage collection, and machine drift.
for (let round = -warmups; round < repetitions; round += 1) {
  let totalMs = 0;
  for (const entry of round % 2 ? [...cases].reverse() : cases) {
    const phases = { preparation: 0, execution: 0, reporting: 0 };
    const phaseTimings = { preparation: [], execution: [], reporting: [] };
    const started = performance.now();
    const result = simulateGw2({
      ...entry.options,
      onPhase: (phase, duration) => {
        phases[phase] += duration;
        // Preserve individual callbacks to verify each candidate executes once.
        phaseTimings[phase].push(duration);
      }
    });
    const elapsedMs = performance.now() - started;
    totalMs += elapsedMs;

    if (round < 0) continue;

    entry.samples.push({ elapsedMs, ...phases, phaseTimings });
    // Count actual output packets outside the timer; warnings remain visible and attributable to their preset.
    entry.result = {
      executedEvents: result.events?.length,
      resolvedEvents: result.resolvedEvents?.length,
      rotationEndTime: result.rotationEndTime,
      burningApplications: result.resolvedEvents?.filter(
        (event) => event.type === 'condition' && event.condition === 'Burning'
      ).length,
      dps: result.dps,
      warnings: result.warnings
    };
  }

  if (round >= 0) roundMs.push(totalMs);
}

// Instrument one untimed run per case so queue counters never add cost to the wall-clock samples.
const { StableEventQueue } = await import('#kernel/events/queue.js');
const methods = Object.fromEntries(
  ['enqueue', 'dequeue', 'cancelWhere'].map((key) => [key, StableEventQueue.prototype[key]])
);
for (const entry of cases) {
  const counts = { enqueued: 0, dequeued: 0, cancelled: 0, peakQueue: 0, retainedReportBytes: 0 };
  StableEventQueue.prototype.enqueue = function (event) {
    const result = methods.enqueue.call(this, event);
    counts.enqueued++;
    counts.peakQueue = Math.max(counts.peakQueue, this.length);
    return result;
  };

  StableEventQueue.prototype.dequeue = function () {
    const event = methods.dequeue.call(this);

    if (event) counts.dequeued++;

    return event;
  };

  StableEventQueue.prototype.cancelWhere = function (matches) {
    return methods.cancelWhere.call(this, (event) => {
      const cancelled = matches(event);

      if (cancelled) counts.cancelled++;

      return cancelled;
    });
  };

  try {
    const result = simulateGw2(entry.options);
    counts.retainedReportBytes = Buffer.byteLength(JSON.stringify(result));
    entry.work = counts;
  } finally {
    Object.assign(StableEventQueue.prototype, methods);
  }
}

// Sampling runs after wall-clock measurement so inspector overhead never contaminates benchmark samples.
if (values['cpu-profile-dir']) {
  const directory = path.resolve(values['cpu-profile-dir']);
  await mkdir(directory, { recursive: true });
  const session = new Session();
  session.connect();
  try {
    await session.post('Profiler.enable');
    await session.post('Profiler.setSamplingInterval', { interval: 1000 });
    for (const [index, entry] of cases.entries()) {
      await session.post('Profiler.start');
      for (let repeat = 0; repeat < repetitions; repeat += 1) simulateGw2(entry.options);
      const { profile } = await session.post('Profiler.stop');
      entry.cpuProfile = path.join(directory, `${index + 1}-${path.basename(entry.build, '.json')}.cpuprofile`);
      await writeFile(entry.cpuProfile, JSON.stringify(profile));
    }
  } finally {
    session.disconnect();
  }
}

console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      cpu: cpus()[0]?.model,
      output: values.output,
      permanentBoons: values['no-permanent-boons'] ? 'disabled' : 'preset',
      note: values['no-permanent-boons']
        ? 'All configured boon presence is disabled; player cast timings and recharge rates retain engine policy.'
        : undefined,
      prefixLength,
      warmups,
      repetitions,
      roundMs,
      cases
    },
    (key, value) => (key === 'options' ? undefined : value),
    2
  )
);
