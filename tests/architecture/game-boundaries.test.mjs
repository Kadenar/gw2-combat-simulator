import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const APP_ROOT = path.resolve(import.meta.dirname, '../../js/app');
const GAMES_ROOT = path.resolve(import.meta.dirname, '../../js/games');

// Scans source imports so game packages cannot silently acquire cross-game dependencies.
async function sourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(root, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return /\.(?:[cm]?js|tsx?)$/.test(entry.name) ? [target] : [];
    })
  );
  return files.flat().sort();
}

function moduleSpecifiers(file, source) {
  const specifiers = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

test('game packages do not import another game package', async () => {
  const gameDirectories = (await readdir(GAMES_ROOT, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const violations = [];

  for (const game of gameDirectories) {
    const gameRoot = path.join(GAMES_ROOT, game.name);
    for (const file of await sourceFiles(gameRoot)) {
      const source = await readFile(file, 'utf8');
      for (const specifier of moduleSpecifiers(file, source)) {
        if (!specifier.startsWith('.')) continue;
        const target = path.resolve(path.dirname(file), specifier);
        const relative = path.relative(GAMES_ROOT, target);
        const targetGame = relative.split(path.sep)[0];
        if (targetGame && targetGame !== game.name && !relative.startsWith('..')) {
          violations.push(`${path.relative(GAMES_ROOT, file)} imports ${specifier}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('shared bootstrap depends on the game registry, not GW2 domain modules', async () => {
  const file = path.join(APP_ROOT, 'bootstrap.ts');
  const source = await readFile(file, 'utf8');
  const specifiers = moduleSpecifiers(file, source);

  assert.deepEqual(specifiers.sort(), ['./game/contracts.js', './game/registry.js']);
  assert.doesNotMatch(source, /platform\/gw2|games\/gw2/i);
});

test('the fake game fixture has no GW2 dependency', async () => {
  const file = path.resolve(import.meta.dirname, '../fixtures/fake-game-plugin.js');
  const source = await readFile(file, 'utf8');

  assert.deepEqual(moduleSpecifiers(file, source), []);
});
