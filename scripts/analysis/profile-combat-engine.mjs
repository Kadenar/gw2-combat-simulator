/** Profiles a warmed, deterministic reference run without changing simulation timing or writing profiler artifacts. */
import { Session } from 'node:inspector/promises';
import { performance } from 'node:perf_hooks';

import { prepareEncounter, runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { loadReferenceEncounter } from '../../tests/fixtures/gw2combat-reference/reference-encounter.js';

const encounter = prepareEncounter(loadReferenceEncounter({ deterministic: true }));
const run = () => {
  const result = runCombatEngine({ encounter, output: 'score', seed: 1 });
  if (!result.ok) throw new Error(result.message);
  return result;
};

run();
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
