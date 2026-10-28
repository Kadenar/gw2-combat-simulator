import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

// Publication groups must cover every Node suite once, including suites added outside existing owner directories.
test('publication CI assigns every Node test file to exactly one group', () => {
  const action = readFileSync(path.join(root, '.github/actions/validate/action.yml'), 'utf8');
  const patterns = [...action.matchAll(/tests\/[\w/.*-]+\.test\.[\w*]+/g)].map(([pattern]) => pattern);
  assert.ok(patterns.length > 0, 'No Node test patterns found in publication CI');
  const files = readdirSync(path.join(root, 'tests'), { recursive: true })
    .map((file) => `tests/${file.replaceAll('\\', '/')}`)
    .filter((file) => /\.test\.[cm]?js$/.test(file));
  const invalid = files
    .map((file) => ({ file, groups: patterns.filter((pattern) => path.matchesGlob(file, pattern)) }))
    .filter(({ groups }) => groups.length !== 1);
  assert.deepEqual(invalid, [], 'Node suites must not be omitted or run in multiple publication groups');
});
