import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesSearchWords } from '#ui/shared/dropdown-search.js';

// Search accepts contiguous fragments in any order, without inventing matches across skipped letters.
test('dropdown word matching handles fragments, punctuation, case, and empty queries', () => {
  const label = 'Bowl of Curry Butternut Squash Soup / Precision';
  for (const query of ['SOUP curry', 'squash butter', 'precision curry', '  curry, SOUP!  ', '', '  '])
    assert.equal(matchesSearchWords(label, query), true, query);
  for (const query of ['zzzz', 'soup missing', 'buttersoup'])
    assert.equal(matchesSearchWords(label, query), false, query);
  assert.equal(matchesSearchWords('Bleeding', 'bli'), false);
  assert.equal(matchesSearchWords('Blight', 'bli'), true);
  assert.equal(matchesSearchWords('\u00c9lite 25', '\u00e9lite 25'), true);
});
