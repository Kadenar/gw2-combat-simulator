/** Profiles existing manifest rotations after warmup; loading and build preparation stay outside timed runs. */
import { readFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Usage: node scripts/analysis/benchmark-supported-rotations.mjs [profession ...] > timings.json
const root = path.resolve(import.meta.dirname, '../..');
const requested = process.argv.slice(2);
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
        id: `${profession}|${section.section || ''}|${preset.label}`,
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

const warmups = 5;
const repetitions = 15;
const roundMs = [];
// Alternate traversal order to reduce bias from JIT warmup, garbage collection, and machine drift.
for (let round = -warmups; round < repetitions; round += 1) {
  let totalMs = 0;
  for (const entry of round % 2 ? [...cases].reverse() : cases) {
    const phases = { scheduling: 0, resolution: 0, reporting: 0, refinement: 0 };
    const started = performance.now();
    const result = simulateGw2({
      ...entry.options,
      onPhase: (phase, duration) => {
        phases[phase] += duration;
      }
    });
    const elapsedMs = performance.now() - started;
    totalMs += elapsedMs;
    if (round < 0) continue;
    entry.samples.push({ elapsedMs, ...phases });
    // Count actual output packets outside the timer; warnings remain visible and attributable to their preset.
    entry.result = {
      scheduledEvents: result.events.length,
      resolvedEvents: result.resolvedEvents.length,
      burningApplications: result.resolvedEvents.filter(
        (event) => event.type === 'condition' && event.condition === 'Burning'
      ).length,
      dps: result.dps,
      warnings: result.warnings
    };
  }

  if (round >= 0) roundMs.push(totalMs);
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
