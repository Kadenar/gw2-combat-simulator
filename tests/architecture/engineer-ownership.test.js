import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Lifecycle consolidation must preserve independent initialization across the Engineer family.
test('Engineer value dependencies remain acyclic', () => {
  const source = professionSourceGraph('engineer');
  assertIndependentProfessionOwners(
    source,
    [...source.graph.keys()].map((file) => path.relative(source.root, file)),
    null
  );
});

// Core kit and Mine Field owners must not depend on an elite's lifecycle.
test('Engineer Core value dependencies cannot reach elite implementations', () => {
  const source = professionSourceGraph('engineer');
  const entries = [...source.graph.keys()]
    .map((file) => path.relative(source.root, file).replaceAll(path.sep, '/'))
    .filter((entry) => entry.startsWith('core/'));
  assertIndependentProfessionOwners(source, entries, /^specializations\//);
});
