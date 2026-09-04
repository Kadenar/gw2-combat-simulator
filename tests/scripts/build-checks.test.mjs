import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

test('lint owns JavaScript syntax coverage outside generated and local-tool directories', async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL('../..', import.meta.url)) });

  // Invalid syntax must be rejected wherever maintained JavaScript can live, including hidden source files.
  for (const filePath of [
    'eslint.config.js',
    'js/app/github-pages-redirect.js',
    'scripts/data/syntax-probe.mjs',
    'scripts/build/syntax-probe.mjs',
    'tests/scripts/syntax-probe.cjs',
    'tests/ui/syntax-probe.jsx',
    'docs/example.js',
    '.syntax-probe.mjs'
  ]) {
    const [result] = await eslint.lintText('const = ;', { filePath });

    assert.equal(result.fatalErrorCount, 1, filePath);
  }

  for (const directory of [
    'node_modules',
    'dist',
    'coverage',
    'build',
    'reference-repos',
    '.analysis-inputs',
    '.claude',
    '.git',
    '.lavish'
  ]) {
    assert.equal(await eslint.isPathIgnored(`${directory}/syntax-probe.mjs`), true, directory);
  }
});

test('dist validation retains nested missing, duplicate, and stale-output checks', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gw2-build-check-'));
  const checker = fileURLToPath(new URL('../../scripts/build/check-dist.mjs', import.meta.url));

  try {
    await mkdir(path.join(directory, 'js/nested'), { recursive: true });
    await mkdir(path.join(directory, 'dist/js/nested'), { recursive: true });
    await writeFile(path.join(directory, 'js/nested/skill.ts'), 'export {};');
    await writeFile(path.join(directory, 'js/nested/types.d.ts'), 'export {};');
    await writeFile(path.join(directory, 'dist/js/nested/skill.js'), 'export {};');

    // Exercise the CLI against a tiny build so traversal changes cannot silently drop an artifact check.
    const run = () => spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8' });
    const valid = run();

    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /Verified 1 TypeScript outputs/);

    await rm(path.join(directory, 'dist/js/nested/skill.js'));
    await writeFile(path.join(directory, 'js/nested/skill.js'), 'export {};');
    await writeFile(path.join(directory, 'dist/js/nested/stale.js'), 'export {};');
    const invalid = run();

    assert.equal(invalid.status, 1, invalid.stderr);
    assert.match(invalid.stderr, /Missing compiled outputs:\s+dist[/\\]js[/\\]nested[/\\]skill\.js/);
    assert.match(invalid.stderr, /Generated JavaScript must not live beside TypeScript:\s+js[/\\]nested[/\\]skill\.js/);
    assert.match(invalid.stderr, /Stale compiled outputs:\s+dist[/\\]js[/\\]nested[/\\]stale\.js/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
