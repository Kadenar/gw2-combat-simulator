/** Reproduce preparation/serialization throughput; --cpu-prof and --heap-prof capture engine and allocation costs. */
import { readFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createGroupedOptimizer } from '#gw2/app/simulation/gear-optimizer-space.js';
import {
  captureGearOptimizerRequest,
  createOptimizerSpace,
  createOptimizerEvaluator,
  ordinaryEquipmentAt,
  optimizerScore
} from '#gw2/app/simulation/gear-optimizer.js';

const professions = process.argv.slice(2);
const gc = [];
const observer = new PerformanceObserver((list) => gc.push(...list.getEntries().map((entry) => entry.duration)));
observer.observe({ entryTypes: ['gc'] });
const rows = [];
for (const profession of professions.length
  ? professions
  : ['elementalist', 'mesmer', 'necromancer', 'ranger', 'revenant']) {
  const setupStart = performance.now();
  const adapter = await loadProfessionAppAdapter(profession);
  const manifest = JSON.parse(await readFile(`data/gw2/builds/${profession}/manifest.json`, 'utf8'));
  const preset = manifest.flatMap((section) => section.presets).find((entry) => entry.rotation);
  const saved = JSON.parse(await readFile(preset.build, 'utf8'));
  const rotation = JSON.parse(await readFile(preset.rotation, 'utf8'));
  const build = adapter.toApplicationBuild({ ...saved, rotation: rotation.rotation ?? rotation });
  const request = captureGearOptimizerRequest(
    { build, adapter, profession: adapter.profession, contentId: profession, buildRevision: 0, patchId: 'current' },
    {}
  );
  const space = createOptimizerSpace(request, adapter);
  const evaluator = createOptimizerEvaluator(request, adapter);
  const coldSetupMs = performance.now() - setupStart;
  const timings = [];
  const scoreTimings = [];
  let result;
  let schedulingPasses = 0;
  for (let run = -3; run < 10; run++) {
    const start = performance.now();
    const equipment = ordinaryEquipmentAt(space, 0n);
    const generated = performance.now();
    const config = evaluator.prepare(equipment);
    const prepared = performance.now();
    const phases = { scheduling: 0, resolution: 0, reporting: 0, refinement: 0 };
    schedulingPasses = 0;
    result = simulateGw2({
      profession: adapter.profession,
      rotation: build.rotation,
      config,
      observationPolicy: request.observationPolicy,
      onPhase(phase, duration) {
        phases[phase] += duration;
        if (phase === 'scheduling') schedulingPasses++;
      }
    });
    const simulated = performance.now();
    structuredClone({ equipment, score: optimizerScore(result) });
    const serialized = performance.now();
    if (run >= 0)
      timings.push({
        ...phases,
        generation: generated - start,
        preparation: prepared - generated,
        simulation: simulated - prepared,
        serialization: serialized - simulated,
        total: serialized - start
      });
  }

  for (let run = -3; run < 10; run++) {
    const start = performance.now();
    const config = evaluator.prepare(ordinaryEquipmentAt(space, 0n));
    simulateGw2({
      profession: adapter.profession,
      rotation: build.rotation,
      config,
      observationPolicy: request.observationPolicy,
      output: 'score'
    });
    if (run >= 0) scoreTimings.push(performance.now() - start);
  }

  // A small but mixed-prefix space measures generation, cache reuse, and detailed finalist verification end to end.
  const searchRequest = captureGearOptimizerRequest(
    { build, adapter, profession: adapter.profession, contentId: profession, buildRevision: 0, patchId: 'current' },
    {
      prefixes: ["Berserker's", "Assassin's"],
      locks: Object.keys(build.gear)
        .filter((slot) => !['Helm', 'Shoulders', 'Gloves'].includes(slot))
        .concat(
          build.alternateWeapons[0]
            ? [
                'AlternateWeapon1',
                ...(adapter.weaponData[build.alternateWeapons[0]]?.wielding === '2h' ? [] : ['AlternateWeapon2'])
              ]
            : []
        )
        .filter((slot) => !(slot === 'Weapon2' && adapter.weaponData[build.weapons[0]]?.wielding === '2h'))
    }
  );
  const searchStart = performance.now();
  const grouped = createGroupedOptimizer(searchRequest, adapter);
  const preparedSearch = performance.now();
  const search = grouped.evaluateRange(0n, grouped.space.count);
  const searched = performance.now();
  for (const candidate of search.winners) grouped.evaluator.evaluate(candidate.equipment);
  const verified = performance.now();

  const median = (key) => timings.map((timing) => timing[key]).sort((a, b) => a - b)[5];
  rows.push({
    profession,
    preset: preset.label,
    coldSetupMs,
    medianMs: Object.fromEntries(
      [
        'generation',
        'preparation',
        'scheduling',
        'resolution',
        'refinement',
        'reporting',
        'simulation',
        'serialization',
        'total'
      ].map((key) => [key, median(key)])
    ),
    candidatesPerSecond: 1000 / median('total'),
    scoreMedianMs: scoreTimings.sort((a, b) => a - b)[5],
    search: {
      rawCount: grouped.space.ordinary.rawCount.toString(),
      groupedCount: grouped.space.count.toString(),
      simulations: search.simulations,
      preparationMs: preparedSearch - searchStart,
      evaluationMs: searched - preparedSearch,
      verificationMs: verified - searched,
      totalMs: verified - searchStart
    },
    duration: result.duration,
    events: result.resolvedEvents.length,
    ticks: result.resolvedEvents.reduce((sum, event) => sum + (event.damageTicks?.length || 0), 0),
    schedulingPasses,
    warnings: result.warnings
  });
}

await new Promise((resolve) => setImmediate(resolve));
observer.disconnect();
console.log(
  JSON.stringify(
    {
      node: process.version,
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      memoryBytes: totalmem(),
      workerCount: 1,
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      workingTree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
      memory: process.memoryUsage(),
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      gcCount: gc.length,
      gcMs: gc.reduce((sum, duration) => sum + duration, 0),
      rows
    },
    null,
    2
  )
);
