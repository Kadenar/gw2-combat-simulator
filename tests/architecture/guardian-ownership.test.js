import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Mechanic extraction must preserve independent initialization across the entire Guardian family.
test('all Guardian modules have acyclic value dependencies', () => {
  const source = professionSourceGraph('guardian');
  const entries = [...source.graph.keys()].map((file) => path.relative(source.root, file));
  assertIndependentProfessionOwners(source, entries, null);
});

// Preserve Guardian's state and Core boundaries while sharing missing-target and cycle validation.
test('Firebrand initialization and page tuning cannot reach active behavior or form a value-import cycle', () => {
  assertIndependentProfessionOwners(
    professionSourceGraph('guardian'),
    ['specializations/firebrand/state.ts', 'specializations/firebrand/traits/page-tuning.ts'],
    /(?:^|\/)(?:hooks|behavior)\.ts$|^specializations\/firebrand\/mechanics\//
  );
});

test('Guardian Core cannot import elite behavior or introduce value-import cycles', () => {
  const source = professionSourceGraph('guardian');
  const entries = [...source.graph.keys()].map((file) => path.relative(source.root, file));
  assertIndependentProfessionOwners(
    source,
    entries.filter((entry) => entry.startsWith(`core${path.sep}`)),
    /^specializations\//
  );
});
