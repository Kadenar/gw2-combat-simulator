/**
 * Compares the TypeScript combat engine with the pinned gw2combat C++ reference.
 *
 * Two lanes run on the frozen Willbender fixture:
 * - Deterministic: every random draw site is forced to a fixed outcome, so the
 *   C++ and TypeScript audit event streams must match exactly. The first
 *   differing event is printed to localize a translation defect.
 * - Canonical: the unmodified encounter uses random proc rolls. The C++ build
 *   seeds from std::random_device, so the lane compares DPS distributions over
 *   repeated runs instead of individual samples.
 *
 * Build first: node scripts/analysis/gw2combat-reference/build-reference.mjs
 * Usage: npm run build:modules && node scripts/analysis/gw2combat-reference/compare-reference.mjs
 *        [--runs=30] [--reference-dir=<dir>] [--write-results]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import {
  REFERENCE_FIXTURE_DIR,
  loadReferenceEncounter,
  readReferenceFile
} from '../../../tests/fixtures/gw2combat-reference/reference-encounter.js';
import { DEFAULT_REFERENCE_DIR, REFERENCE_REVISION, referenceExecutable } from './build-reference.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const workDir = path.join(repoRoot, '.scratch', 'gw2combat-reference');

const EVENT_TYPES = {
  actor_created_event: 'actor_created',
  skill_cast_begin_event: 'skill_cast_begin',
  skill_cast_end_event: 'skill_cast_end',
  equipped_bundle_event: 'equipped_bundle',
  dropped_bundle_event: 'dropped_bundle',
  effect_application_event: 'effect_application',
  damage_event: 'damage',
  combat_stats_update_event: 'combat_stats_update',
  effect_expired_event: 'effect_expired',
  actor_downstate_event: 'actor_downstate'
};

function option(name, fallback) {
  const match = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
}

/** Writes C++ inputs with absolute paths so the reference can run from any directory. */
function writeReferenceInputs(deterministic) {
  const variant = deterministic ? 'deterministic' : 'canonical';
  const dir = path.join(workDir, variant);
  mkdirSync(dir, { recursive: true });
  const encounter = JSON.parse(readFileSync(path.join(REFERENCE_FIXTURE_DIR, 'encounter.json'), 'utf8'));
  for (const actor of encounter.actors) {
    for (const key of ['build_path', 'rotation_path']) {
      if (!actor[key]) continue;
      const file = path.basename(actor[key]);
      const target = path.join(dir, file);
      writeFileSync(target, readReferenceFile(file, { deterministic }));
      actor[key] = target;
    }
  }

  const encounterPath = path.join(dir, 'encounter.json');
  writeFileSync(encounterPath, JSON.stringify(encounter, null, 2));
  return encounterPath;
}

function runReference(executable, encounterPath, auditPath) {
  // The reference logs every tick to stdout; only the audit file is needed.
  execFileSync(executable, ['--encounter', encounterPath, '--audit-path', auditPath], {
    stdio: ['ignore', 'ignore', 'inherit'],
    maxBuffer: 1024 * 1024 * 1024
  });
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
  if (audit.error) throw new Error(`Reference run failed: ${audit.error}`);
  const events = audit.tick_events;
  const totalDamage = events
    .filter((event) => event.event.event_type === 'damage_event')
    .reduce((sum, event) => sum + event.event.damage, 0);
  // The final tick always records the terminating health update for damage-based endings.
  const endTick = events.reduce((latest, event) => Math.max(latest, event.time_ms), 0);
  return { events, totalDamage, endTick, dps: endTick > 0 ? (totalDamage * 1000) / endTick : 0 };
}

function normalizeReferenceEvent(event) {
  const { event_type: type, ...fields } = event.event;
  const camel = Object.entries(fields).map(([key, value]) => [
    key.replaceAll(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    value
  ]);
  return JSON.stringify({
    timeMs: event.time_ms,
    actor: event.actor,
    type: EVENT_TYPES[type],
    ...Object.fromEntries(camel.sort())
  });
}

function normalizeEngineEvent(event) {
  const { timeMs, actor, type, ...fields } = event;
  return JSON.stringify({ timeMs, actor, type, ...Object.fromEntries(Object.entries(fields).sort()) });
}

function runEngine(deterministic, seed) {
  const result = runCombatEngine({ encounter: loadReferenceEncounter({ deterministic }), seed });
  if (!result.ok) throw new Error(`Engine run failed (${result.code}): ${result.message}`);
  return result;
}

function statistics(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);
  return {
    runs: values.length,
    meanDps: mean,
    standardDeviation: Math.sqrt(variance),
    minimumDps: Math.min(...values),
    maximumDps: Math.max(...values)
  };
}

function compareDeterministic(executable) {
  const reference = runReference(
    executable,
    writeReferenceInputs(true),
    path.join(workDir, 'deterministic-audit.json')
  );
  const engine = runEngine(true, 1);
  const expected = reference.events.map(normalizeReferenceEvent);
  const actual = engine.events.map(normalizeEngineEvent);
  const firstDifference = expected.findIndex((event, index) => event !== actual[index]);
  const mismatch = firstDifference !== -1 || expected.length !== actual.length;

  console.log('Deterministic lane');
  console.log(`  reference: end ${reference.endTick} ms, damage ${reference.totalDamage}, ${expected.length} events`);
  console.log(`  engine:    end ${engine.endTick} ms, damage ${engine.totalDamage}, ${actual.length} events`);
  if (!mismatch) {
    console.log('  audit event streams are identical');
  } else {
    const index = firstDifference === -1 ? Math.min(expected.length, actual.length) : firstDifference;
    console.log(`  first difference at event ${index}`);
    console.log(`    reference: ${expected[index] ?? '(none)'}`);
    console.log(`    engine:    ${actual[index] ?? '(none)'}`);
  }

  return {
    mismatch,
    results: {
      endTick: reference.endTick,
      totalDamage: reference.totalDamage,
      dps: reference.dps,
      eventCount: expected.length
    }
  };
}

function compareCanonical(executable, runs) {
  const encounterPath = writeReferenceInputs(false);
  const referenceDps = [];
  for (let run = 0; run < runs; run += 1) {
    referenceDps.push(runReference(executable, encounterPath, path.join(workDir, 'canonical-audit.json')).dps);
  }

  const engineDps = [];
  for (let seed = 1; seed <= runs; seed += 1) engineDps.push(runEngine(false, seed).dps);

  const reference = statistics(referenceDps);
  const engine = statistics(engineDps);
  const relative = (engine.meanDps - reference.meanDps) / reference.meanDps;
  const format = (stats) =>
    `mean ${stats.meanDps.toFixed(1)}, sd ${stats.standardDeviation.toFixed(1)}, range ${stats.minimumDps.toFixed(1)}-${stats.maximumDps.toFixed(1)}`;
  console.log(`Canonical lane (${runs} runs each)`);
  console.log(`  reference DPS: ${format(reference)}`);
  console.log(`  engine DPS:    ${format(engine)} (seeds 1-${runs})`);
  console.log(`  mean difference: ${(relative * 100).toFixed(3)}%`);
  return reference;
}

if (import.meta.main) {
  const referenceDir = path.resolve(option('reference-dir', DEFAULT_REFERENCE_DIR));
  const executable = referenceExecutable(referenceDir);
  if (!existsSync(executable)) {
    throw new Error(`Missing ${executable}; run scripts/analysis/gw2combat-reference/build-reference.mjs first.`);
  }

  const runs = Number(option('runs', '30'));
  const deterministic = compareDeterministic(executable);
  const canonical = compareCanonical(executable, runs);

  if (process.argv.includes('--write-results')) {
    const results = {
      referenceRevision: REFERENCE_REVISION,
      generatedBy: 'scripts/analysis/gw2combat-reference/compare-reference.mjs',
      platform: `${process.platform}-${process.arch}`,
      dpsDefinition: 'Sum of every audit damage event divided by the final tick in seconds.',
      canonical,
      deterministic: deterministic.results
    };
    const target = path.join(REFERENCE_FIXTURE_DIR, 'reference-results.json');
    writeFileSync(target, `${JSON.stringify(results, null, 2)}\n`);
    console.log(`Wrote ${path.relative(repoRoot, target)}`);
  }

  if (deterministic.mismatch) process.exitCode = 1;
}
