import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { assertIndependentProfessionOwners, professionSourceGraph } from '#tests/helpers/profession-source-graph.js';

const root = path.resolve(import.meta.dirname, '../../js/games/gw2/professions/mesmer');

// Attack delivery consumes prepared snapshots without constructing the lifecycle or choosing specialization policies.
test('phantasm attacks remain independent of lifecycle and family assembly', () => {
  assertIndependentProfessionOwners(
    professionSourceGraph('mesmer'),
    ['core/mechanics/illusions/phantasm-attacks.ts'],
    /(?:^|\/)(?:hooks|module|catalog|profession|family-mechanics)\.ts$|^core\/mechanics\/illusions\/(?:phantasms|lifecycle|resources)\.ts$|^specializations\//
  );
});

// Moving mechanic actions out of hooks must preserve acyclic loading across every specialization.
test('all Mesmer modules have acyclic value dependencies', () => {
  const source = professionSourceGraph('mesmer');
  const entries = [...source.graph.keys()].map((file) => path.relative(source.root, file));
  assertIndependentProfessionOwners(source, entries, null);
});

/** Follow value dependencies so moving a factory behind another import cannot restore a construction cycle. */
function assertIndependentLoading(entry) {
  const visited = new Set();
  const visit = (relative, chain) => {
    assert.ok(!chain.includes(relative), [...chain, relative].join(' -> '));
    assert.notEqual(relative, 'family-mechanics.ts', [...chain, relative].join(' -> '));
    assert.notEqual(relative, 'core/traits/dispatch.ts', [...chain, relative].join(' -> '));

    if (visited.has(relative)) return;

    const file = path.join(root, relative);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;

      if (statement.isTypeOnly || statement.importClause?.isTypeOnly) continue;

      const bindings = statement.importClause?.namedBindings ?? statement.exportClause;

      if (bindings?.elements?.length && bindings.elements.every((binding) => binding.isTypeOnly)) continue;

      const specifier = statement.moduleSpecifier?.text;
      const alias = '#gw2/professions/mesmer/';

      if (specifier?.startsWith(alias))
        visit(specifier.slice(alias.length).replace(/\.js$/, '.ts'), [...chain, relative]);
    }

    visited.add(relative);
  };

  visit(entry, []);
}

test('Mirage controller and trait execution load without family construction cycles', () => {
  assertIndependentLoading('specializations/mirage/mechanics/runtime.ts');
  assertIndependentLoading('specializations/mirage/traits/index.ts');
});

test('consolidated Core trait owners load independently of family construction and cross-line dispatch', () => {
  for (const line of ['chaos', 'domination', 'dueling', 'illusions', 'inspiration'])
    assertIndependentLoading(`core/traits/${line}/index.ts`);
});

// Tooltip projections must remain loadable without pulling runtime construction into presentation.
test('shatter projections load independently of family construction and trait dispatch', () => {
  assertIndependentLoading('core/mechanics/shatter-projection.ts');
  assertIndependentLoading('specializations/virtuoso/mechanics/bladesong-projection.ts');
});
