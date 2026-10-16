import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Mechanic consolidation must preserve independent initialization throughout the Ranger family.
test('Ranger value dependencies remain acyclic', () => {
  const source = professionSourceGraph('ranger');
  assertIndependentProfessionOwners(
    source,
    [...source.graph.keys()].map((file) => path.relative(source.root, file)),
    null
  );
});

// Creating resource clocks must not load the behavior that later advances them.
test('Ranger elite state initializes without importing active mechanics or trait definitions', () => {
  assertIndependentProfessionOwners(
    professionSourceGraph('ranger'),
    ['specializations/druid/state.ts', 'specializations/untamed/state.ts', 'specializations/galeshot/state.ts'],
    /(?:^|\/)(?:hooks|module|catalog|profession)\.ts$|^specializations\/[^/]+\/(?:mechanics|skills|traits)\//
  );
});
