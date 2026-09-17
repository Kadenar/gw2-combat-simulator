import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '../..');

// skipLibCheck hides errors inside declaration files, so hand-written type modules must be ordinary .ts sources.
test('source packages contain no hand-written declaration files', () => {
  const declarations = readdirSync(path.join(ROOT, 'js'), { recursive: true })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => /\.d\.[cm]?ts$/.test(file))
    .sort();

  assert.deepEqual(declarations, []);
});
