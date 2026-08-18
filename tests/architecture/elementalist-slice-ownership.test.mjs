import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const CORE_ROOT = path.resolve(import.meta.dirname, '../../js/professions/elementalist/core');
const ELITE_NAMES = ['Tempest', 'Weaver', 'Catalyst', 'Evoker'];

test('Elementalist Core does not own elite-specialization policy', async () => {
  const files = (await readdir(CORE_ROOT)).filter((name) => name.endsWith('.ts')).sort();
  const violations = [];

  for (const file of files) {
    const source = await readFile(path.join(CORE_ROOT, file), 'utf8');
    if (/from\s+["'][^"']*specializations\//.test(source)) {
      violations.push(`${file} imports a specialization slice`);
    }
    for (const name of ELITE_NAMES) {
      if (new RegExp(`\\b${name}\\b`).test(source)) {
        violations.push(`${file} names ${name}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
