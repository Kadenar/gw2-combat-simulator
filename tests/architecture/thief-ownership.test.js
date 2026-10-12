import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Retain Thief's query and resource ownership rules on the common value-import graph.
test('Thief Core has no transitive elite dependency or value-import cycle', () => {
  const source = professionSourceGraph('thief');
  const entries = [...source.graph.keys()].map((file) => path.relative(source.root, file));
  assertIndependentProfessionOwners(
    source,
    entries.filter((entry) => entry.startsWith(`core${path.sep}`)),
    /^specializations\//
  );
});

test('Thief capacity and state queries cannot reach reactions, modifiers, or resource mutation', () => {
  assertIndependentProfessionOwners(
    professionSourceGraph('thief'),
    ['core/state.ts', 'core/state-queries.ts', 'core/traits/trickery/resource-queries.ts'],
    /(?:hooks|modifiers|behavior|dispatch)\.ts$|^core\/mechanics\//
  );
});
