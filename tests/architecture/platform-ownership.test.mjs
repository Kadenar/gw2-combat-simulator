import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../../js/games/gw2/platform/', import.meta.url);

// Inspect type imports and dynamic imports as well as ordinary imports, so boundary checks cannot be bypassed by syntax.
async function platformGraph() {
  const files = (await readdir(root, { recursive: true }))
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.ts'));
  const edges = [];
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8');
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function record(specifier, typeOnly) {
      if (specifier.startsWith('#gw2/')) edges.push({ file, specifier, typeOnly });
    }

    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause;
        const elements =
          bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) ? bindings.elements : [];
        const typeOnly = Boolean(
          node.isTypeOnly ||
          node.importClause?.isTypeOnly ||
          (!node.importClause?.name && elements.length && elements.every((element) => element.isTypeOnly))
        );
        record(node.moduleSpecifier.text, typeOnly);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        record(node.argument.literal.text, true);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) record(argument.text, false);
      }

      ts.forEachChild(node, visit);
    }

    visit(syntax);
  }

  return { files, edges };
}

// Owners consume capabilities and schemas; the only callers of run construction are simulation and isolated measurement.
test('platform imports preserve declaration, composition, history, and presentation ownership', async () => {
  const { edges } = await platformGraph();
  for (const { file, specifier } of edges) {
    const label = `${file} -> ${specifier}`;
    assert.doesNotMatch(specifier, /^#gw2\/(professions|app|integrations)\//, label);
    if (!/^(simulation|skill-damage)\//.test(file)) {
      assert.doesNotMatch(
        specifier,
        /^#gw2\/platform\/simulation\/(runtime|coordinator|internal-work|combat-execution|simulate|bind-mechanic-context|runtime-resources)\.js$/,
        label
      );
    }

    if (/^(skills|effects|events|profession-definition)\//.test(file)) {
      assert.notEqual(specifier, '#gw2/platform/simulation/runtime-state.js', label);
    }

    if (file.startsWith('execution/')) assert.doesNotMatch(specifier, /^#gw2\/platform\/resolver\//, label);
    if (file.startsWith('resolver/')) assert.doesNotMatch(specifier, /^#gw2\/platform\/execution\//, label);
    if (file.startsWith('skill-damage/'))
      assert.doesNotMatch(specifier, /^#gw2\/platform\/profession-presentation\//, label);
    if (file.startsWith('combat/history/')) assert.doesNotMatch(specifier, /^#gw2\/platform\/results\//, label);
  }
});

// Runtime cycles can turn otherwise valid schemas into partially initialized modules; recursive type contracts are allowed.
test('platform value dependencies are acyclic and all platform imports resolve to an owner', async () => {
  const { files, edges } = await platformGraph();
  const graph = new Map(files.map((file) => [file, []]));
  for (const { file, specifier, typeOnly } of edges) {
    if (!specifier.startsWith('#gw2/platform/')) continue;
    const target = specifier.slice('#gw2/platform/'.length).replace(/\.js$/, '.ts');
    assert.ok(graph.has(target), `${file} imports missing owner ${target}`);
    if (!typeOnly) graph.get(file).push(target);
  }

  const complete = new Set();
  const active = new Set();
  function visit(file, chain = []) {
    assert.equal(active.has(file), false, `Runtime import cycle: ${[...chain, file].join(' -> ')}`);
    if (complete.has(file)) return;
    active.add(file);
    for (const target of graph.get(file)) visit(target, [...chain, file]);
    active.delete(file);
    complete.add(file);
  }

  for (const file of files) visit(file);
});
