import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonExportFilename } from '#gw2/app/io/files.js';

// Every export shares fallback, whitespace, and extension handling without requiring a browser download matrix.
test('JSON export names preserve defaults and existing extensions', () => {
  for (const [input, expected] of [
    ['', 'build.json'],
    ['   ', 'build.json'],
    ['  My build  ', 'My build.json'],
    ['My build.JSON', 'My build.JSON'],
    ['build.json', 'build.json'],
    ['build.txt', 'build.txt.json']
  ])
    assert.equal(jsonExportFilename(input, 'build.json'), expected);
});
