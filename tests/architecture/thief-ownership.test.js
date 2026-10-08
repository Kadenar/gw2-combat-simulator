import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../../js/games/gw2/professions/thief');

/** Include value reexports and indirect imports so a family bridge cannot hide an ownership violation. */
function dependencies(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return dependencies(file);
    if (!file.endsWith('.ts')) return [];
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const imports = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (statement.isTypeOnly || statement.importClause?.isTypeOnly) continue;
      const bindings = statement.importClause?.namedBindings ?? statement.exportClause;
      if (bindings?.elements?.length && bindings.elements.every((binding) => binding.isTypeOnly)) continue;
      const specifier = statement.moduleSpecifier?.text;
      const alias = '#gw2/professions/thief/';
      if (specifier?.startsWith(alias))
        imports.push(path.join(root, specifier.slice(alias.length).replace(/\.js$/, '.ts')));
      else if (specifier?.startsWith('.'))
        imports.push(path.resolve(path.dirname(file), specifier.replace(/\.js$/, '.ts')));
    }

    return [[file, imports]];
  });
}

/** Walk each entry independently to report the actual dependency chain when a cycle returns. */
function inspect(graph, entry, check, chain = [], done = new Set()) {
  const relative = path.relative(root, entry).replaceAll(path.sep, '/');
  const trace = [...chain, relative];
  assert.ok(!chain.includes(relative), trace.join(' -> '));
  check(relative, trace);
  if (done.has(entry)) return;
  for (const next of graph.get(entry) ?? []) inspect(graph, next, check, trace, done);
  done.add(entry);
}

test('Thief Core has no transitive elite dependency or value-import cycle', () => {
  const graph = new Map(dependencies());
  for (const entry of graph.keys()) {
    if (!entry.startsWith(path.join(root, 'core') + path.sep)) continue;
    inspect(graph, entry, (relative, trace) => {
      assert.ok(!relative.startsWith('specializations/'), trace.join(' -> '));
    });
  }
});

test('Thief capacity and state queries cannot reach reactions, modifiers, or resource mutation', () => {
  const graph = new Map(dependencies());
  for (const entry of ['core/state.ts', 'core/state-queries.ts', 'core/traits/trickery/resource-queries.ts'])
    inspect(graph, path.join(root, entry), (relative, trace) => {
      assert.ok(!/(?:hooks|modifiers|behavior|dispatch)\.ts$/.test(relative), trace.join(' -> '));
      assert.ok(!relative.startsWith('core/mechanics/'), trace.join(' -> '));
    });
});
