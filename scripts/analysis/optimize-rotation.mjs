/** Local headless rotation search; uses the same build adapter and JSON importer as the application. */
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadProfessionAppAdapter } from '#gw2/profession-registry.js';
import { optimizeRotation } from '#gw2/app/optimizer/rotation/search.js';
import { getRotationItems } from '#gw2/app/import-export/files.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { simulateGw2 } from '#gw2/platform/index.js';

const { values } = parseArgs({
  options: {
    build: { type: 'string', default: 'data/gw2/builds/guardian/b-power-luminary.json' },
    duration: { type: 'string', default: '20' },
    budget: { type: 'string', default: '100' },
    'beam-width': { type: 'string', default: '4' },
    'search-seed': { type: 'string', default: '1' },
    'combat-seeds': { type: 'string', default: '11,12' },
    'validation-seeds': { type: 'string', default: '1011,1012' },
    'target-dps': { type: 'string' },
    'output-dir': { type: 'string', default: '.scratch/rotation-optimizer' },
    'baseline-rotation': { type: 'string' }
  }
});
const buildText = await readFile(values.build, 'utf8');
const saved = JSON.parse(buildText);
const adapter = await loadProfessionAppAdapter(saved.profession);
if (!adapter) throw new Error('Unknown build profession.');
const build = adapter.toApplicationBuild({ ...saved, rotation: [] });
const app = {
  build,
  adapter,
  profession: adapter.profession,
  skillByName: adapter.profession.catalog.skillsByName,
  skillById: adapter.profession.catalog.skillsById,
  attributeWeaponSet: 1
};
adapter.recalculate(app);
const prepared = adapter.simulationConfig(app);
// A practically immortal target keeps the build's armor, conditions and other combat assumptions.
const config = { ...prepared, target: { ...prepared.target, health: Number.MAX_SAFE_INTEGER } };
const durationMs = Number(values.duration) * 1000;
// Read only the manifest's scalar target; the saved rotation is never loaded unless explicitly requested after search.
let targetDps;
let targetSource = null;
if (values['target-dps'] != null) {
  targetDps = Number(values['target-dps']);
  targetSource = { kind: 'explicit' };
} else {
  const manifestPath = path.join('data/gw2/builds', saved.profession, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const preset = manifest
    ?.flatMap((section) => section.presets)
    .find((preset) => path.resolve(preset.build) === path.resolve(values.build));
  if (preset?.benchmarkDps != null) {
    targetDps = preset.benchmarkDps;
    targetSource = { kind: 'manifest', path: manifestPath, label: preset.label, upToDate: preset.upToDate };
  }
}

const parseSeeds = (value) => value.split(',').map((part) => (part.trim() === '' ? NaN : Number(part)));
let lastProgress = 0;
let lastBestDps = -Infinity;
const result = optimizeRotation({
  profession: adapter.profession,
  config,
  durationMs,
  budget: Number(values.budget),
  beamWidth: Number(values['beam-width']),
  searchSeed: Number(values['search-seed']),
  combatSeeds: parseSeeds(values['combat-seeds']),
  validationSeeds: parseSeeds(values['validation-seeds']),
  targetDps,
  // Report completed rotations only: improvements immediately, otherwise at most once per second.
  onProgress(progress) {
    const bestDps = progress.bestDamage / (durationMs / 1000);
    if (
      bestDps > lastBestDps ||
      progress.elapsedMs - lastProgress >= 1000 ||
      progress.evaluated === Number(values.budget)
    ) {
      console.error(
        `rotations=${progress.evaluated} bestDps=${bestDps.toFixed(1)}${targetDps == null ? '' : ` targetDps=${targetDps} gapDps=${(targetDps - bestDps).toFixed(1)}`} elapsed=${(progress.elapsedMs / 1000).toFixed(1)}s`
      );
      lastProgress = progress.elapsedMs;
      lastBestDps = bestDps;
    }
  }
});

// Optional post-search comparison never supplies actions, timing or scores to the optimizer.
const baselinePath = values['baseline-rotation'];
let existing = null;
if (baselinePath) {
  const raw = JSON.parse(await readFile(baselinePath, 'utf8'));
  const imported = normalizeRotation(getRotationItems(raw), adapter.profession.catalog, { strict: true });
  const commands = imported.filter((command) => command.type === 'cast' || command.type === 'wait');
  const baselineConfig = { ...config, randomness: { ...config.randomness, seed: result.settings.combatSeeds[0] } };
  const full = simulateGw2({
    profession: adapter.profession,
    config: baselineConfig,
    rotation: commands,
    combatStartTime: 0
  });
  const crossing = full.steps.find((step) => Math.max(step.end, step.castLockoutEnd ?? 0) > durationMs);
  let prefix = commands.slice(0, crossing?.ri ?? commands.length);
  // Every seed uses the same authored prefix and endpoint; no seed gets extra commands or a free damage tail.
  const scores = [];
  for (;;) {
    try {
      for (const seed of [...result.settings.combatSeeds, ...result.settings.validationSeeds]) {
        const score = simulateGw2({
          profession: adapter.profession,
          config: { ...config, randomness: { ...config.randomness, seed } },
          rotation: prefix,
          combatStartTime: 0,
          observationPolicy: { kind: 'absolute', endTimeMs: durationMs },
          output: 'score'
        });
        scores.push({
          seed,
          damage: score.totalDamage,
          dps: score.totalDamage / (durationMs / 1000),
          warnings: score.warnings
        });
      }

      break;
    } catch (error) {
      if (!(error instanceof RangeError) || !error.message.includes('cannot precede rotation end') || !prefix.length)
        throw error;
      prefix = prefix.slice(0, -1);
      scores.length = 0;
    }
  }

  existing = {
    path: baselinePath,
    adjustment:
      'Cold start at t=0; remove combat markers and cooldown resets; retain remaining commands through the fixed endpoint.',
    removedControls: imported.length - commands.length,
    scores
  };
}

const rotation = [{ type: 'combat-start' }, ...result.rotation];
const replayRotation = normalizeRotation(getRotationItems({ rotation }), adapter.profession.catalog, { strict: true });
for (const sample of [...result.score.samples, ...result.score.heldOut]) {
  const replay = simulateGw2({
    profession: adapter.profession,
    config: { ...config, randomness: { ...config.randomness, seed: sample.seed } },
    rotation: replayRotation,
    output: 'score'
  });
  if (
    replay.totalDamage !== sample.damage ||
    Math.abs(replay.observationEndTime * 1000 - durationMs) > 0.001 ||
    replay.warnings.length
  )
    throw new Error('Export did not reproduce the fixed-window score through the importer.');
}

let revision;
let dirty = null;
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
  dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', windowsHide: true }).trim().length > 0;
} catch {
  // Read Git's actual reference when process creation is unavailable in a sandbox.
  const head = (await readFile('.git/HEAD', 'utf8')).trim();
  if (!head.startsWith('ref: ')) revision = head;
  else {
    const ref = head.slice(5);
    try {
      revision = (await readFile(path.join('.git', ref), 'utf8')).trim();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const packed = await readFile('.git/packed-refs', 'utf8');
      revision =
        packed
          .split('\n')
          .find((line) => line.endsWith(` ${ref}`))
          ?.split(' ')[0] ?? 'unknown';
    }
  }
}

const hash = (value) => createHash('sha256').update(value).digest('hex');
// Include uncommitted engine/search edits in experiment identity, independently of Git's dirty status.
const sourceHash = createHash('sha256');
for (const file of (await readdir('js', { recursive: true })).filter((file) => file.endsWith('.ts')).sort()) {
  sourceHash.update(file.replaceAll('\\', '/')).update(await readFile(path.join('js', file)));
}

sourceHash.update(await readFile(import.meta.filename));
const report = {
  ...result,
  targetSource,
  build: {
    path: path.resolve(values.build),
    sha256: hash(buildText),
    profession: saved.profession,
    specialization: config.specialization
  },
  scenario: { config, sha256: hash(JSON.stringify(config)) },
  engine: { revision, dirty, sourceSha256: sourceHash.digest('hex'), node: process.version },
  existingRotation: existing,
  limitations: [
    'Guardian snapshots are enabled; Luminary is the validated build. Other families require an audit of private mutable state.',
    'Search and suffix refinement use event/cooldown/lane boundaries and up to one-second idle steps.',
    'No precast or cooldown resets; full cast reservations must fit inside the endpoint. No arbitrary cast interrupts or off-target variants.',
    'Finite stochastic beam search with static-priority/random continuations; this is the best rotation found, not a global optimum.',
    'Budget caps complete candidate evaluations. Search stops early only when every training seed exceeds the target; held-out replay occurs once afterward.',
    'A manifest benchmark is a scalar aspiration. The fixed-window immortal-target cold-start scenario does not establish a matched human-benchmark comparison.',
    'Held-out seeds validate the chosen result without selecting or tuning it.'
  ]
};
if (revision === 'unknown')
  report.warnings.push('Engine revision unavailable; use the source fingerprint for this experiment.');
const directory = path.resolve(values['output-dir']);
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'rotation.json'), JSON.stringify({ rotation }, null, 2) + '\n');
await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    outputDirectory: directory,
    damage: result.score.trainingDamage,
    dps: result.score.trainingDps,
    heldOutDps:
      result.score.heldOut.reduce((sum, sample) => sum + sample.damage, 0) /
      result.score.heldOut.length /
      (durationMs / 1000),
    goal: result.goal,
    evaluated: result.performance.evaluatedCandidates,
    elapsedMs: result.performance.elapsedMs
  })
);
