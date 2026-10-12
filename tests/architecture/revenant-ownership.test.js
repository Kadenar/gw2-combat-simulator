import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Keep behavior exclusions and the migrated acyclic roots local to Revenant.
test('Revenant cost and state queries never reach active behavior through value dependencies', () => {
  assertIndependentProfessionOwners(
    professionSourceGraph('revenant'),
    ['family-state.ts', 'core/state-queries.ts', 'data/upkeep-skills.ts'],
    /(?:^|\/)(?:hooks|modifiers|behavior)\.ts$/
  );
});

test('Revenant cost, upkeep, Core modifiers, and skill lifecycle dependencies are acyclic', () => {
  // Separate Herald passive and Conduit affinity cycles are outside this migrated boundary.
  assertIndependentProfessionOwners(
    professionSourceGraph('revenant'),
    [
      'family-state.ts',
      // Core trait declarations now own the modifier formulas previously checked through core/modifiers.ts.
      'core/traits/index.ts',
      'core/mechanics/upkeep.ts',
      'core/hooks.ts',
      'core/skills/weapons/scepter.ts',
      'core/skills/weapons/spear.ts',
      'core/skills/weapons/greatsword.ts',
      'core/skills/legends/assassin.ts',
      'specializations/vindicator/traits/behavior.ts'
    ],
    null
  );
});

test('Revenant cost queries and profession composition load independently in fresh processes', () => {
  for (const entry of ['family-state', 'profession']) {
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
