import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const APP_ROOT = path.resolve(import.meta.dirname, '../../js/app');
const GAMES_ROOT = path.resolve(import.meta.dirname, '../../js/games');
const JS_ROOT = path.resolve(import.meta.dirname, '../../js');
const KERNEL_ROOT = path.resolve(import.meta.dirname, '../../js/kernel');
const SHELL_ROOT = path.join(APP_ROOT, 'shell');
const UI_ROOT = path.resolve(import.meta.dirname, '../../js/ui');

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

test('kernel and neutral UI do not import app or game modules', async () => {
  const violations = [];
  const gameVocabulary = /guild wars|\bgw2\b|boon|trait|profession|specialization|relic|sigil|quickness|armor weight/i;
  for (const [label, root, forbidden] of [
    ['kernel', KERNEL_ROOT, /(?:^|\/)app\/|(?:^|\/)games\/|(?:^|\/)ui\//],
    ['ui', UI_ROOT, /(?:^|\/)games\/|platform\/gw2/]
  ]) {
    for (const file of await sourceFiles(root)) {
      const source = await readFile(file, 'utf8');

      if (label === 'kernel' && gameVocabulary.test(source)) {
        violations.push(`${label}/${path.relative(root, file)} contains game vocabulary`);
      }

      for (const specifier of moduleSpecifiers(file, source)) {
        if (forbidden.test(specifier)) violations.push(`${label}/${path.relative(root, file)} imports ${specifier}`);
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

test('shared shell contracts and rendering contain no game vocabulary or imports', async () => {
  const forbidden =
    /boon|trait|relic|sigil|armorWeight|elementalist|mesmer|necromancer|ranger|thief|engineer|guardian|warrior|revenant/i;
  const violations = [];

  for (const file of await sourceFiles(SHELL_ROOT)) {
    const source = await readFile(file, 'utf8');
    if (forbidden.test(source)) violations.push(path.relative(APP_ROOT, file));
    for (const specifier of moduleSpecifiers(file, source)) {
      if (/games\/|platform\/gw2/.test(specifier)) {
        violations.push(`${path.relative(APP_ROOT, file)} imports ${specifier}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('shared app declarations do not import the GW2 platform', async () => {
  const violations = [];

  for (const file of (await sourceFiles(APP_ROOT)).filter((file) => file.endsWith('.d.ts'))) {
    const source = await readFile(file, 'utf8');
    for (const specifier of moduleSpecifiers(file, source)) {
      if (specifier.includes('platform/gw2')) {
        violations.push(`${path.relative(APP_ROOT, file)} imports ${specifier}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('GW2 workers use game-content addresses', async () => {
  for (const file of [
    path.join(APP_ROOT, 'simulation/game-worker-harness.ts'),
    path.join(GAMES_ROOT, 'gw2/app/simulation/baseline-simulation-worker.ts'),
    path.join(GAMES_ROOT, 'gw2/app/simulation/modifier-contribution-worker.ts'),
    path.join(GAMES_ROOT, 'gw2/app/simulation/random-distribution-worker.ts')
  ]) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /professionId/);
  }
});

test('source modules do not retain compatibility export barrels', async () => {
  const violations = [];

  for (const file of await sourceFiles(JS_ROOT)) {
    const source = await readFile(file, 'utf8');
    if (source.startsWith('// Compatibility export') || source.startsWith('// Compatibility barrel')) {
      violations.push(path.relative(JS_ROOT, file));
    }
  }

  assert.deepEqual(violations, []);
});

test('runtime data is game namespaced and declares legacy public aliases', async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const manifest = JSON.parse(await readFile(path.join(root, 'data/games.json'), 'utf8'));
  const gw2 = manifest.games.find(({ id }) => id === 'gw2');

  assert.deepEqual(
    gw2.runtimeData.map(({ source, publicPath, legacyPublicPaths }) => ({ source, publicPath, legacyPublicPaths })),
    [
      {
        source: 'data/gw2/builds',
        publicPath: 'data/gw2/builds',
        legacyPublicPaths: ['Builds']
      },
      {
        source: 'data/gw2/rotations',
        publicPath: 'data/gw2/rotations',
        legacyPublicPaths: ['Rotations']
      }
    ]
  );
});
