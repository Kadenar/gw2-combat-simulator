import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceRoot = path.join(root, 'js');
const buildRoot = path.join(root, 'dist', 'js');

async function files(directory, extension) {
  // Include nested artifacts in the missing, duplicate, and stale-output checks without a custom directory walker.
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => !entry.isDirectory() && entry.name.endsWith(extension))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

async function exists(file) {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
}

const sources = (await files(sourceRoot, '.ts')).filter((file) => !file.endsWith('.d.ts'));
const missing = [];
const duplicates = [];

for (const source of sources) {
  const relative = path.relative(sourceRoot, source);
  const output = path.join(buildRoot, relative.replace(/\.ts$/, '.js'));
  const sibling = source.replace(/\.ts$/, '.js');

  if (!(await exists(output))) missing.push(path.relative(root, output));

  if (await exists(sibling)) duplicates.push(path.relative(root, sibling));
}

const outputs = await files(buildRoot, '.js');
const stale = [];

for (const output of outputs) {
  const relative = path.relative(buildRoot, output);
  const source = path.join(sourceRoot, relative.replace(/\.js$/, '.ts'));

  if (!(await exists(source))) stale.push(path.relative(root, output));
}

if (missing.length || duplicates.length || stale.length) {
  if (missing.length) {
    console.error(`Missing compiled outputs:\n${missing.join('\n')}`);
  }

  if (duplicates.length) {
    console.error(`Generated JavaScript must not live beside TypeScript:\n` + duplicates.join('\n'));
  }

  if (stale.length) {
    console.error(`Stale compiled outputs:\n${stale.join('\n')}`);
  }

  process.exit(1);
}

console.log(`Verified ${sources.length} TypeScript outputs in dist with no source duplicates.`);
