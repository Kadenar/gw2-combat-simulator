import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Pure cost, query, and legend-data entry points must remain independent of active behavior.
test('Revenant cost and state queries never reach active behavior through value dependencies', () => {
  assertIndependentProfessionOwners(
    professionSourceGraph('revenant'),
    ['energy-cost.ts', 'core/state-queries.ts', 'data/legends.ts', 'data/upkeep-skills.ts'],
    /(?:^|\/)(?:hooks|modifiers|behavior)\.ts$/
  );
});

test('all Revenant modules have acyclic value dependencies', () => {
  // Discover every module so new Core and elite owners receive the same cycle and missing-target checks.
  const source = professionSourceGraph('revenant');
  const entries = [...source.graph.keys()].map((file) => path.relative(source.root, file));
  assertIndependentProfessionOwners(source, entries, null);
});

test('Revenant legend data, cost queries, and profession composition load independently in fresh processes', () => {
  for (const entry of ['data/legends', 'energy-cost', 'profession']) {
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `await import('#gw2/professions/revenant/${entry}.js');`],
      {
        cwd: path.resolve(import.meta.dirname, '../..'),
        stdio: 'pipe'
      }
    );
  }
});
