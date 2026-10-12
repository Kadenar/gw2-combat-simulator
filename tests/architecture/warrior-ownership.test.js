import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Trait line roots additionally forbid their dispatcher; all Core roots forbid elite dependencies.
test('Warrior Core value dependencies never reach an elite and trait lines never depend on their dispatcher', () => {
  const source = professionSourceGraph('warrior');
  for (const file of source.graph.keys()) {
    const entry = path.relative(source.root, file).replaceAll(path.sep, '/');
    if (!entry.startsWith('core/')) continue;
    const isTraitLine = /traits\/(arms|strength|defense|discipline|tactics)\/index\.ts$/.test(entry);
    assertIndependentProfessionOwners(
      source,
      [entry],
      isTraitLine ? /^specializations\/|^core\/traits\/behavior\.ts$/ : /^specializations\//
    );
  }
});

test('Warrior value dependencies remain acyclic after selecting resource and trait owners', () => {
  const source = professionSourceGraph('warrior');
  assertIndependentProfessionOwners(
    source,
    [...source.graph.keys()].map((file) => path.relative(source.root, file)),
    null
  );
});
