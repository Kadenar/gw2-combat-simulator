import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Follow value imports and reexports so indirect dependencies cannot reconnect an owner to module assembly. */
export function professionSourceGraph(profession) {
  const root = path.resolve(import.meta.dirname, '../../js/games/gw2/professions', profession);
  const alias = `#gw2/professions/${profession}/`;
  function visit(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return visit(file);
      if (!file.endsWith('.ts')) return [];
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const dependencies = [];
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        if (statement.isTypeOnly || statement.importClause?.isTypeOnly) continue;
        const bindings = statement.importClause?.namedBindings ?? statement.exportClause;
        if (bindings?.elements?.length && bindings.elements.every((binding) => binding.isTypeOnly)) continue;
        const specifier = statement.moduleSpecifier?.text;
        if (specifier?.startsWith(alias))
          dependencies.push(path.join(root, specifier.slice(alias.length).replace(/\.js$/, '.ts')));
        else if (specifier?.startsWith('.'))
          dependencies.push(path.resolve(path.dirname(file), specifier.replace(/\.js$/, '.ts')));
      }

      return [[file, dependencies]];
    });
  }

  return { root, graph: new Map(visit(root)) };
}

/** Owners must load independently: reject cycles, missing targets, and upward imports into assembly. */
export function assertIndependentProfessionOwners(
  { root, graph },
  entries,
  forbidden = /(?:^|\/)(?:hooks|module|catalog|profession)\.ts$/
) {
  const complete = new Set();
  function visit(file, chain) {
    const relative = path.relative(root, file).replaceAll(path.sep, '/');
    const trace = [...chain, file].map((item) => path.relative(root, item)).join(' -> ');
    assert.ok(graph.has(file), `Missing source: ${trace}`);
    assert.doesNotMatch(relative, forbidden, trace);
    assert.ok(!chain.includes(file), `Value-import cycle: ${trace}`);
    if (complete.has(file)) return;
    for (const dependency of graph.get(file)) visit(dependency, [...chain, file]);
    complete.add(file);
  }

  for (const entry of entries) visit(path.join(root, entry), []);
}
