/**
 * Measures C++ DPS distributions for the additional examples and checks the port within 1%.
 * The separate 40 ms baseline records current TypeScript behavior, not C++ or game parity.
 * Usage: node scripts/analysis/gw2combat-reference/compare-examples.mjs [--runs=10] [--write-results]
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { COMBAT_ENGINE_REVISION, prepareEncounter, runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import {
  EXAMPLE_FIXTURE_DIR,
  exampleLocalEncounter,
  loadExampleEncounter,
  readExampleManifest
} from '../../../tests/fixtures/gw2combat-reference/example-encounters.js';
import { DEFAULT_REFERENCE_DIR, REFERENCE_REVISION, referenceExecutable } from './build-reference.mjs';

const { values: options } = parseArgs({
  options: {
    runs: { type: 'string', default: '10' },
    'reference-dir': { type: 'string', default: DEFAULT_REFERENCE_DIR },
    'write-results': { type: 'boolean' }
  }
});
const runs = Number(options.runs);
assert.ok(Number.isSafeInteger(runs) && runs > 0, '--runs must be a positive integer');
const referenceDir = path.resolve(options['reference-dir']);
const executable = referenceExecutable(referenceDir);
const revision = execFileSync('git', ['-C', referenceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(revision, REFERENCE_REVISION, 'reference checkout must match the pinned revision');
const workRoot = path.resolve('.scratch/gw2combat-reference/examples');

/** Keep original JSON semantics for C++, resolving external recipes to the frozen copies. */
function writeInputs(id, dir) {
  mkdirSync(dir, { recursive: true });
  const encounter = exampleLocalEncounter(id);
  for (const actor of encounter.actors) {
    const build = JSON.parse(readFileSync(path.join(EXAMPLE_FIXTURE_DIR, actor.build_path), 'utf8'));
    if (build.recipe_paths) build.recipe_paths = build.recipe_paths.map((file) => path.join(EXAMPLE_FIXTURE_DIR, file));
    const buildPath = path.join(dir, `${actor.name}-build.json`);
    writeFileSync(buildPath, JSON.stringify(build));
    actor.build_path = buildPath;
    if (actor.rotation_path) actor.rotation_path = path.join(EXAMPLE_FIXTURE_DIR, actor.rotation_path);
  }

  const file = path.join(dir, 'encounter.json');
  writeFileSync(file, JSON.stringify(encounter));
  return file;
}

/** Read the actual completion tick from the CLI log: rotation endings may have no audit event on their last tick. */
function referenceDps(encounterPath, dir) {
  const auditPath = path.join(dir, 'audit.json');
  const logPath = path.join(dir, 'reference.log');
  const log = openSync(logPath, 'w');
  try {
    execFileSync(executable, ['--encounter', encounterPath, '--audit-path', auditPath], {
      stdio: ['ignore', log, 'inherit'],
      timeout: 60000
    });
  } finally {
    closeSync(log);
  }

  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  if (audit.error) throw new Error(audit.error);
  const match = readFileSync(logPath, 'utf8').match(/\[(\d+)\] combat loop completed for encounter\./);
  assert.ok(match, 'reference completion tick is missing');
  const endTick = Number(match[1]);
  assert.ok(endTick > 0);
  const total = audit.tick_events.reduce(
    (sum, entry) => sum + (entry.event.event_type === 'damage_event' ? entry.event.damage : 0),
    0
  );
  return (total * 1000) / endTick;
}

const manifest = readExampleManifest();
assert.equal(manifest.referenceRevision, REFERENCE_REVISION);
const results = {
  referenceRevision: REFERENCE_REVISION,
  engineRevision: COMBAT_ENGINE_REVISION,
  generatedBy: 'scripts/analysis/gw2combat-reference/compare-examples.mjs',
  platform: `${process.platform}-${process.arch}`,
  seed: 1,
  dpsDefinition: 'All audit damage divided by the actual completion tick in seconds.',
  step40Baseline: 'Current TypeScript behavior; not a C++ or game-correctness reference.',
  examples: {}
};
let failed = false;
for (const example of manifest.examples) {
  const dir = path.join(workRoot, example.id);
  const encounterPath = writeInputs(example.id, dir);
  const samples = Array.from({ length: runs }, () => referenceDps(encounterPath, dir));
  const meanDps = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const standardDeviation = Math.sqrt(
    samples.reduce((sum, value) => sum + (value - meanDps) ** 2, 0) / Math.max(1, runs - 1)
  );
  const encounter = prepareEncounter(loadExampleEncounter(example.id));
  const run = (stepMs) => {
    const result = runCombatEngine({ encounter, output: 'score', seed: results.seed, stepMs });
    assert.equal(result.ok, true, `${example.id}: ${result.message}`);

    return result.dps;
  };

  const step1Dps = run(1);
  const step40Dps = run(40);
  const error = Math.abs(step1Dps - meanDps) / meanDps;
  if (error > 0.01) failed = true;
  results.examples[example.id] = { reference: { runs, meanDps, standardDeviation }, step40: { dps: step40Dps } };
  console.log(
    `${example.id}: C++ ${meanDps.toFixed(2)}, TS 1 ms ${step1Dps.toFixed(2)} (${(error * 100).toFixed(3)}% error), TS 40 ms ${step40Dps.toFixed(2)}`
  );
}

assert.equal(failed, false, 'At least one example exceeds the 1% C++ DPS tolerance; baselines were not written');
if (options['write-results']) {
  writeFileSync(path.join(EXAMPLE_FIXTURE_DIR, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
}
