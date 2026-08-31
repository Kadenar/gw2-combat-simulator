import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const PLATFORM_ROOT = path.resolve(import.meta.dirname, '../../js/games/gw2/platform');
const APP_ROOT = path.resolve(import.meta.dirname, '../../js/games/gw2/app');
const GW2_ROOT = path.resolve(import.meta.dirname, '../../js/games/gw2');

// Scan every platform source module so app-specific composition cannot leak
// back into the reusable engine, GW2 data, persistence, or UI layers.
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

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function moduleSpecifiers(sourceFile) {
  const specifiers = [];

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
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

test('platform modules do not depend on app modules', async () => {
  const violations = [];

  for (const file of await sourceFiles(PLATFORM_ROOT)) {
    const source = await readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

    for (const specifier of moduleSpecifiers(sourceFile)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('#gw2/')) continue;
      const resolved = specifier.startsWith('#gw2/')
        ? path.resolve(GW2_ROOT, specifier.slice('#gw2/'.length))
        : path.resolve(path.dirname(file), specifier);

      if (isInside(APP_ROOT, resolved)) {
        violations.push(`${path.relative(PLATFORM_ROOT, file)} imports ${specifier}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
