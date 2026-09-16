/** Profiles a warmed, deterministic reference run without changing simulation timing or writing profiler artifacts. */
import { Session } from 'node:inspector/promises';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';

import { prepareEncounter, runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { runCombatLoop } from '#gw2/platform/combat-engine/loop.js';
import { createRegistry, Pool } from '#gw2/platform/combat-engine/registry.js';
import { createRandomSource } from '#gw2/platform/combat-engine/rng.js';
import { setupEncounter } from '#gw2/platform/combat-engine/systems/setup.js';
import { loadReferenceEncounter } from '../../tests/fixtures/gw2combat-reference/reference-encounter.js';

// Keep the same requested step for timing, CPU samples, and workload counts so coarse-step runs are comparable.
const { values: options } = parseArgs({
  options: { 'step-ms': { type: 'string', default: '1' }, workload: { type: 'boolean' } }
});
const stepMs = Number(options['step-ms']);
assert.ok(Number.isSafeInteger(stepMs) && stepMs > 0, '--step-ms must be a positive integer');
const encounter = prepareEncounter(loadReferenceEncounter({ deterministic: true }));
const run = () => {
  const result = runCombatEngine({ encounter, output: 'score', seed: 1, stepMs });
  if (!result.ok) throw new Error(result.message);
  return result;
};

const reference = run();
console.log(`Step: ${stepMs} ms; end: ${reference.endTick} ms; termination: ${reference.terminatedBy}`);
const timings = [];
for (let index = 0; index < 3; index += 1) {
  const start = performance.now();
  const result = run();
  timings.push(performance.now() - start);
  console.log(`Run ${index + 1}: ${timings.at(-1).toFixed(1)} ms; ${result.dps.toFixed(2)} DPS`);
}

console.log(`Warm median: ${timings.sort((left, right) => left - right)[1].toFixed(1)} ms`);

const session = new Session();
session.connect();
try {
  await session.post('Profiler.enable');
  await session.post('Profiler.start');
  run();
  const { profile } = await session.post('Profiler.stop');
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map(profile.nodes.flatMap((node) => (node.children ?? []).map((child) => [child, node.id])));
  const totals = new Map();
  let total = 0;
  // Inclusive samples count descendants once per function, exposing callers hidden behind generic pool loops.
  profile.samples.forEach((id, index) => {
    const duration = profile.timeDeltas[index];
    total += duration;
    const seen = new Set();
    for (let current = id; current !== undefined; current = parents.get(current)) {
      const { callFrame } = nodes.get(current);
      const key = `${callFrame.functionName || '(anonymous)'} ${callFrame.url.split('/').at(-1)}:${callFrame.lineNumber + 1}`;
      const entry = totals.get(key) ?? { function: key, self: 0, inclusive: 0 };
      if (current === id) entry.self += duration;
      if (!seen.has(key)) entry.inclusive += duration;
      seen.add(key);
      totals.set(key, entry);
    }
  });
  const rows = (order) =>
    [...totals.values()]
      .sort((left, right) => right[order] - left[order])
      .slice(0, 20)
      .map((entry) => ({
        function: entry.function,
        'self %': ((100 * entry.self) / total).toFixed(1),
        'inclusive %': ((100 * entry.inclusive) / total).toFixed(1)
      }));
  console.log('Largest call paths (inclusive percentages overlap):');
  console.table(rows('inclusive'));
  console.log('Largest self costs:');
  console.table(rows('self'));
} finally {
  session.disconnect();
}

// Instrument a separate run: callback counts describe work, while its distorted timing is deliberately discarded.
if (options.workload) {
  const registry = createRegistry(encounter, createRandomSource(1), false, stepMs);
  setupEncounter(registry);
  const activity = new Set();
  const activityPools = new Set([
    'begunCastingSkills',
    'incomingStrikes',
    'incomingEffects',
    'incomingDamage',
    'animationExpired',
    'cooldownExpired',
    'durationExpired'
  ]);
  const counters = [];
  for (const [name, pool] of Object.entries(registry)) {
    if (!(pool instanceof Pool)) continue;
    const counter = { pool: name, scans: 0, emptyScans: 0, visits: 0, maxSize: pool.size };
    counters.push(counter);
    const original = pool.forEach;
    pool.forEach = function (visit) {
      counter.scans += 1;
      if (this.size === 0) counter.emptyScans += 1;
      counter.maxSize = Math.max(counter.maxSize, this.size);
      return original.call(this, (entity, value) => {
        counter.visits += 1;
        if (activityPools.has(name) && (!Array.isArray(value) || value.length > 0)) activity.add(registry.tick);
        visit(entity, value);
      });
    };
  }

  let attributeRebuilds = 0;
  const metadata = [
    { name: 'dependencies', inputs: ['isAttributeModifier', 'isAttributeConversion', 'isConditionalSkillGroup'] },
    { name: 'modifier holders', inputs: ['isAttributeModifier', 'owner', 'isEffect', 'isUniqueEffect'] },
    { name: 'conversion holders', inputs: ['isAttributeConversion', 'owner', 'isEffect', 'isUniqueEffect'] }
  ].map((entry) => ({ ...entry, previous: [], rebuilds: 0, holderUnchanged: 0 }));
  const clearAttributes = registry.relativeAttributes.clear;
  registry.relativeAttributes.clear = function () {
    attributeRebuilds += 1;
    for (const entry of metadata) {
      const revisions = entry.inputs.map((name) => registry[name].revision);
      if (revisions.some((revision, index) => revision !== entry.previous[index])) {
        entry.rebuilds += 1;
        if (entry.name !== 'dependencies' && revisions[0] === entry.previous[0]) entry.holderUnchanged += 1;
      }

      entry.previous = revisions;
    }

    return clearAttributes.call(this);
  };

  const damage = { total: 0, bySourceActor: new Map() };
  runCombatLoop(registry, damage);
  assert.equal(damage.total, reference.totalDamage, 'instrumentation must preserve damage');
  assert.equal(registry.tick, reference.endTick, 'instrumentation must preserve termination');
  console.log('Workload counts (forEach only; activity excludes predicate-only/counter-only changes):');
  console.log({
    simulatedTimeMs: registry.tick,
    loopSteps: registry.tick / stepMs,
    ticksWithObservedActivity: activity.size,
    attributeRebuilds,
    poolScans: counters.reduce((sum, row) => sum + row.scans, 0),
    emptyPoolScans: counters.reduce((sum, row) => sum + row.emptyScans, 0),
    poolEntryVisits: counters.reduce((sum, row) => sum + row.visits, 0),
    dps: (damage.total * 1000) / registry.tick
  });
  console.table(counters.sort((left, right) => right.visits - left.visits).slice(0, 20));
  console.table(
    metadata.map(({ name, rebuilds, holderUnchanged }) => ({
      metadata: name,
      rebuilds,
      cacheHits: attributeRebuilds - rebuilds,
      rebuildsWithHolderPoolUnchanged: holderUnchanged
    }))
  );
}
