import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../../js/games/gw2/professions/guardian');

/** Traverse value imports and reexports so an indirect dependency cannot reconnect initialization to reactions. */
function guardianDependencies(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return guardianDependencies(file);
    if (!file.endsWith('.ts')) return [];
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const dependencies = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (statement.isTypeOnly || statement.importClause?.isTypeOnly) continue;
      const bindings = statement.importClause?.namedBindings ?? statement.exportClause;
      if (bindings?.elements?.length && bindings.elements.every((binding) => binding.isTypeOnly)) continue;
      const specifier = statement.moduleSpecifier?.text;
      const alias = '#gw2/professions/guardian/';
      if (specifier?.startsWith(alias))
        dependencies.push(path.join(root, specifier.slice(alias.length).replace(/\.js$/, '.ts')));
      else if (specifier?.startsWith('.'))
        dependencies.push(path.resolve(path.dirname(file), specifier.replace(/\.js$/, '.ts')));
    }

    return [[file, dependencies]];
  });
}

test('Firebrand initialization and page tuning cannot reach active behavior or form a value-import cycle', () => {
  const graph = new Map(guardianDependencies());
  const complete = new Set();
  const visit = (file, chain) => {
    const relative = path.relative(root, file).replaceAll(path.sep, '/');
    assert.ok(!chain.includes(file), [...chain, file].map((item) => path.relative(root, item)).join(' -> '));
    assert.ok(!/(?:^|\/)(?:hooks|behavior)\.ts$/.test(relative), relative);
    assert.ok(!relative.startsWith('specializations/firebrand/mechanics/'), relative);
    if (complete.has(file)) return;
    for (const next of graph.get(file) ?? []) visit(next, [...chain, file]);
    complete.add(file);
  };

  for (const entry of ['state.ts', 'traits/page-tuning.ts'])
    visit(path.join(root, 'specializations/firebrand', entry), []);
});

test('Guardian Core cannot import elite behavior or introduce value-import cycles', () => {
  const graph = new Map(guardianDependencies());
  const eliteRoot = path.join(root, 'specializations') + path.sep;
  for (const start of graph.keys()) {
    if (!start.startsWith(path.join(root, 'core') + path.sep)) continue;
    const visited = new Set();
    const visit = (file, chain) => {
      assert.ok(!file.startsWith(eliteRoot), chain.join(' -> '));
      assert.ok(!chain.includes(path.relative(root, file)), [...chain, path.relative(root, file)].join(' -> '));
      if (visited.has(file)) return;
      visited.add(file);
      for (const next of graph.get(file) ?? []) visit(next, [...chain, path.relative(root, file)]);
    };

    visit(start, []);
  }
});
