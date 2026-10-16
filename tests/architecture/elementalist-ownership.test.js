import { assertIndependentProfessionOwners, professionSourceGraph } from '#tests/helpers/profession-source-graph.js';
import path from 'node:path';
import test from 'node:test';

/** Check every owner so moving a helper cannot hide a cycle outside a hand-maintained entry list. */
test('all Elementalist modules have acyclic value dependencies', () => {
  const source = professionSourceGraph('elementalist');
  const entries = [...source.graph.keys()].map((file) => path.relative(source.root, file));
  assertIndependentProfessionOwners(source, entries, null);
});

/** Core mechanics publish boundaries to elites; they must never import the elite implementations. */
test('Elementalist Core mechanics remain independent of elite implementations', () => {
  const source = professionSourceGraph('elementalist');
  const entries = [...source.graph.keys()]
    .map((file) => path.relative(source.root, file).replaceAll(path.sep, '/'))
    .filter((file) => file.startsWith('core/mechanics/'));
  assertIndependentProfessionOwners(source, entries, /^specializations\//);
});

/** Readiness and companion identity queries must not initialize the actor scheduler or its attack handlers. */
test('elemental queries do not import execution or lifecycle owners', () => {
  assertIndependentProfessionOwners(
    professionSourceGraph('elementalist'),
    ['core/mechanics/elementals/queries.ts'],
    /(?:^|\/)(?:hooks|module|catalog|profession)\.ts$|^core\/mechanics\/elementals\/(?:attacks|runtime|lifecycle)\.ts$/
  );
});
