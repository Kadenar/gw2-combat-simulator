import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../../js/games/gw2/professions/revenant');

/** Parse value imports and reexports so a family intermediary cannot hide a dependency on active behavior. */
function dependencies(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return dependencies(file);
    if (!file.endsWith('.ts')) return [];
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const edges = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (statement.isTypeOnly || statement.importClause?.isTypeOnly) continue;
      const bindings = statement.importClause?.namedBindings ?? statement.exportClause;
      if (
        !statement.importClause?.name &&
        bindings?.elements?.length &&
        bindings.elements.every((binding) => binding.isTypeOnly)
      )
        continue;
      const specifier = statement.moduleSpecifier?.text;
      const alias = '#gw2/professions/revenant/';
      if (specifier?.startsWith(alias))
        edges.push(path.join(root, specifier.slice(alias.length).replace(/\.js$/, '.ts')));
      else if (specifier?.startsWith('.'))
        edges.push(path.resolve(path.dirname(file), specifier.replace(/\.js$/, '.ts')));
    }

    return [[file, edges]];
  });
}

test('Revenant cost and state queries never reach active behavior through value dependencies', () => {
  const graph = new Map(dependencies());
  for (const start of ['family-state.ts', 'core/state-queries.ts', 'data/upkeep-skills.ts']) {
    const visited = new Set();
    const visit = (file, chain) => {
      assert.doesNotMatch(file, /[/\\](?:hooks|modifiers|behavior)\.ts$/, chain.join(' -> '));
      if (visited.has(file)) return;
      visited.add(file);
      for (const next of graph.get(file) ?? []) visit(next, [...chain, path.relative(root, next)]);
    };

    visit(path.join(root, start), [start]);
  }
});

test('Revenant cost, upkeep, Core modifiers, and skill lifecycle dependencies are acyclic', () => {
  const graph = new Map(dependencies());
  const complete = new Set();
  const visit = (file, chain) => {
    assert.ok(!chain.includes(file), [...chain, file].map((item) => path.relative(root, item)).join(' -> '));
    if (complete.has(file)) return;
    for (const next of graph.get(file) ?? []) visit(next, [...chain, file]);
    complete.add(file);
  };

  // Separate Herald passive and Conduit affinity cycles are outside this migrated boundary.
  for (const start of [
    'family-state.ts',
    'core/modifiers.ts',
    'core/mechanics/upkeep.ts',
    'core/hooks.ts',
    'core/skills/weapons/scepter.ts',
    'core/skills/weapons/spear.ts',
    'core/skills/weapons/greatsword.ts',
    'core/skills/legends/assassin.ts',
    'specializations/vindicator/traits/behavior.ts'
  ])
    visit(path.join(root, start), []);
});

test('Revenant cost queries and profession composition load independently in fresh processes', () => {
  for (const entry of ['family-state', 'profession']) {
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `await import('#gw2/professions/revenant/${entry}.js');`],
      {
        cwd: path.resolve(import.meta.dirname, '../..'),
        stdio: 'pipe'
      }
    );
  }
});
