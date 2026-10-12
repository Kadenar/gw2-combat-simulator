import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertIndependentProfessionOwners, professionSourceGraph } from '../helpers/profession-source-graph.js';

// Small source fixtures protect runtime ownership edges without freezing any profession's source layout.
test('profession graph includes value imports and reexports but excludes type-only and dynamic imports', (context) => {
  const root = mkdtempSync(path.join(tmpdir(), 'profession-graph-'));
  context.after(() => rmSync(root, { recursive: true }));
  writeFileSync(
    path.join(root, 'entry.ts'),
    `
    import './side-effect.js';
    import { value, type Shape } from '#gw2/professions/fixture/value.js';
    import DefaultValue, { type OtherShape } from './default.js';
    export { value } from './reexport.js';
    export * from './star.js';
    import type { Missing } from './type-only.js';
    import { type Missing } from './named-type-only.js';
    export type { Missing } from './export-type-only.js';
    export { type Missing } from './named-export-type-only.js';
    const lazy = import('./dynamic.js');
    type Lazy = import('./type-query.js').Missing;
  `
  );
  const targets = ['side-effect.ts', 'value.ts', 'default.ts', 'reexport.ts', 'star.ts'];
  for (const target of targets) writeFileSync(path.join(root, target), 'export const value = 1;');
  const source = professionSourceGraph('fixture', root);
  assert.deepEqual(
    source.graph.get(path.join(root, 'entry.ts')),
    targets.map((target) => path.join(root, target))
  );
  assertIndependentProfessionOwners(source, ['entry.ts']);
});

test('owner traversal rejects missing targets, indirect forbidden imports, and cycles', () => {
  const root = path.resolve('fixture');
  const file = (name) => path.join(root, name);
  const graph = new Map([[file('entry.ts'), [file('bridge.ts')]]]);
  const source = { root, graph };
  assert.throws(
    () => assertIndependentProfessionOwners(source, ['entry.ts']),
    /Missing source:.*entry\.ts.*bridge\.ts/
  );
  graph.set(file('bridge.ts'), [file('hooks.ts')]);
  graph.set(file('hooks.ts'), []);
  assert.throws(() => assertIndependentProfessionOwners(source, ['entry.ts']), /entry\.ts.*bridge\.ts.*hooks\.ts/);
  graph.set(file('bridge.ts'), [file('entry.ts')]);
  assert.throws(() => assertIndependentProfessionOwners(source, ['entry.ts'], null), /Value-import cycle:/);
});
