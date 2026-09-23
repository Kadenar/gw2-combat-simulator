/** Profiles existing manifest rotations after warmup; loading and build preparation stay outside timed runs. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { cpus } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Usage: node scripts/analysis/benchmark-supported-rotations.mjs [profession ...] > timings.json
// Add --filter Ritualist to match preset IDs, or --cpu-profile-dir .scratch/profiles for separate warmed CPU captures.
const root = path.resolve(import.meta.dirname, '../..');
const { values, positionals: requested } = parseArgs({
  allowPositionals: true,
  options: {
    filter: { type: 'string' },
    'cpu-profile-dir': { type: 'string' }
  }
});
const professions = requested.length ? requested : professionOptions.map(({ id }) => id);
for (const id of professions) {
  if (!professionOptions.some((profession) => profession.id === id)) throw new TypeError(`Unknown profession: ${id}`);
}

const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const cases = [];
for (const profession of professions) {
  const adapter = await loadProfessionAppAdapter(profession);
  const manifest = await readJson(`data/gw2/builds/${profession}/manifest.json`);
  for (const section of manifest) {
    for (const preset of section.presets) {
      if (!preset.rotation) continue;
      const id = `${profession}|${section.section || ''}|${preset.label}`;
      if (values.filter && !id.toLowerCase().includes(values.filter.toLowerCase())) continue;
      const [savedBuild, savedRotation] = await Promise.all([readJson(preset.build), readJson(preset.rotation)]);
      const build = adapter.toApplicationBuild({ ...savedBuild, rotation: savedRotation.rotation ?? savedRotation });
      const app = {
        build,
        adapter,
        profession: adapter.profession,
        skillByName: adapter.profession.catalog.skillsByName,
        skillById: adapter.profession.catalog.skillsById,
        attributeWeaponSet: 1
      };
      adapter.recalculate(app);
      cases.push({
        id,
        profession,
        build: preset.build,
        rotation: preset.rotation,
        benchmarkDps: preset.benchmarkDps,
        options: { profession: adapter.profession, rotation: build.rotation, config: adapter.simulationConfig(app) },
        samples: []
      });
    }
  }
}

if (!cases.length) throw new TypeError(`No presets matched filter: ${values.filter}`);

const warmups = 5;
const repetitions = 15;
const roundMs = [];
// Alternate traversal order to reduce bias from JIT warmup, garbage collection, and machine drift.
for (let round = -warmups; round < repetitions; round += 1) {
  let totalMs = 0;
  for (const entry of round % 2 ? [...cases].reverse() : cases) {
    const phases = { scheduling: 0, resolution: 0, reporting: 0, refinement: 0 };
    const phaseTimings = { scheduling: [], resolution: [], reporting: [], refinement: [] };
    const started = performance.now();
    const result = simulateGw2({
      ...entry.options,
      onPhase: (phase, duration) => {
        phases[phase] += duration;
        // Preserve individual callbacks so full pipeline replays are visible instead of hidden in phase totals.
        phaseTimings[phase].push(duration);
      }
    });
    const elapsedMs = performance.now() - started;
    totalMs += elapsedMs;
    if (round < 0) continue;
    entry.samples.push({ elapsedMs, ...phases, phaseTimings });
    // Count actual output packets outside the timer; warnings remain visible and attributable to their preset.
    entry.result = {
      scheduledEvents: result.events.length,
      resolvedEvents: result.resolvedEvents.length,
      rotationEndTime: result.rotationEndTime,
      burningApplications: result.resolvedEvents.filter(
        (event) => event.type === 'condition' && event.condition === 'Burning'
      ).length,
      dps: result.dps,
      warnings: result.warnings
    };
  }

  if (round >= 0) roundMs.push(totalMs);
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
      warmups,
      repetitions,
      roundMs,
      cases
    },
    (key, value) => (key === 'options' ? undefined : value),
    2
  )
);
