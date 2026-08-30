import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { embedRoute } from '#app/embed.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { escapeHtml } from '#ui/shared/html.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ALIASED_ROOTS = [
  ['#gw2/', [path.join(ROOT, 'js', 'games', 'gw2'), path.join(ROOT, 'dist', 'js', 'games', 'gw2')]],
  ['#kernel/', [path.join(ROOT, 'js', 'kernel'), path.join(ROOT, 'dist', 'js', 'kernel')]],
  ['#ui/', [path.join(ROOT, 'js', 'ui'), path.join(ROOT, 'dist', 'js', 'ui')]],
  ['#app/', [path.join(ROOT, 'js', 'app'), path.join(ROOT, 'dist', 'js', 'app')]]
];
const SOURCE_EXTENSION = /\.(?:[cm]?js|jsx|tsx?)$/;
const SKIPPED_DIRECTORIES = new Set(['.git', 'dist', 'node_modules']);
const IMPORT_PATTERN = /\b(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']*)["']/g;

async function sourceFiles(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const target = path.join(directory, entry.name);

    if (entry.isDirectory()) files.push(...(await sourceFiles(target)));
    else if (SOURCE_EXTENSION.test(entry.name)) files.push(target);
  }

  return files;
}

// Exercises the native package alias against compiled output so runtime resolution cannot silently regress.
test('the GW2 package import alias resolves compiled modules', () => {
  assert.equal(gw2BaseRecharge({ cooldown: 8 }), 8);
});

// Exercises the shared kernel alias through the same compiled-module path used by Node.
test('the kernel package import alias resolves compiled modules', () => {
  assert.equal(isInternalCooldownReady(1.001, 1), true);
});

// Exercises the browser-facing shared aliases without requiring a DOM.
test('the app and UI package import aliases resolve compiled modules', () => {
  assert.equal(embedRoute('index.html'), 'index.html?embed=1');
  assert.equal(escapeHtml('<'), '&lt;');
});

// Keep source-facing imports on the aliases that resolve consistently in TypeScript, Vite, and Node.
test('imports into aliased roots use package aliases', async () => {
  const violations = [];

  for (const file of await sourceFiles(ROOT)) {
    const source = await readFile(file, 'utf8');

    for (const [, specifier] of source.matchAll(IMPORT_PATTERN)) {
      const target = path.resolve(path.dirname(file), specifier);
      const alias = ALIASED_ROOTS.find(([, roots]) =>
        roots.some((root) => target.startsWith(`${root}${path.sep}`))
      )?.[0];

      if (alias) violations.push(`${path.relative(ROOT, file)} imports ${specifier}; use ${alias}`);
    }
  }

  assert.deepEqual(violations, []);
});
