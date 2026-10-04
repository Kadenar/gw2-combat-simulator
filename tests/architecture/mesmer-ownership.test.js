import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../../js/games/gw2/professions/mesmer');

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
  assertIndependentLoading('specializations/mirage/traits/behavior.ts');
});

test('consolidated Core trait owners load independently of family construction and cross-line dispatch', () => {
  for (const line of ['chaos', 'domination', 'dueling', 'illusions'])
    assertIndependentLoading(`core/traits/${line}.ts`);
});
