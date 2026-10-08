import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../../js/games/gw2/professions/warrior');

/** Follow value imports and reexports so family indirection cannot hide a Core-to-elite dependency. */
function warriorDependencies(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return warriorDependencies(file);
    if (!file.endsWith('.ts')) return [];
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const dependencies = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (statement.isTypeOnly || statement.importClause?.isTypeOnly) continue;
      const bindings = statement.importClause?.namedBindings ?? statement.exportClause;
      if (bindings?.elements?.length && bindings.elements.every((binding) => binding.isTypeOnly)) continue;
      const specifier = statement.moduleSpecifier?.text;
      const alias = '#gw2/professions/warrior/';
      if (specifier?.startsWith(alias))
        dependencies.push(path.join(root, specifier.slice(alias.length).replace(/\.js$/, '.ts')));
      else if (specifier?.startsWith('.'))
        dependencies.push(path.resolve(path.dirname(file), specifier.replace(/\.js$/, '.ts')));
    }

    return [[file, dependencies]];
  });
}

test('Warrior Core value dependencies never reach an elite and trait lines never depend on their dispatcher', () => {
  const graph = new Map(warriorDependencies());
  const eliteRoot = path.join(root, 'specializations') + path.sep;
  const dispatcher = path.join(root, 'core/traits/behavior.ts');
  for (const start of graph.keys()) {
    if (!start.startsWith(path.join(root, 'core') + path.sep)) continue;
    const visited = new Set();
    const visit = (file, chain) => {
      assert.ok(!file.startsWith(eliteRoot), chain.join(' -> '));
      if (/[/\\]traits[/\\](arms|strength|defense|discipline|tactics)[/\\]index\.ts$/.test(start))
        assert.notEqual(file, dispatcher, chain.join(' -> '));
      if (visited.has(file)) return;
      visited.add(file);
      for (const next of graph.get(file) ?? []) visit(next, [...chain, path.relative(root, next)]);
    };

    visit(start, [path.relative(root, start)]);
  }
});

test('Warrior value dependencies remain acyclic after selecting resource and trait owners', () => {
  const graph = new Map(warriorDependencies());
  const complete = new Set();
  const visit = (file, chain) => {
    assert.ok(!chain.includes(file), [...chain, file].map((item) => path.relative(root, item)).join(' -> '));
    if (complete.has(file)) return;
    for (const next of graph.get(file) ?? []) visit(next, [...chain, file]);
    complete.add(file);
  };

  for (const file of graph.keys()) visit(file, []);
});
