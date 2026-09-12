import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const redirectScript = readFileSync(new URL('../../js/app/github-pages-redirect.js', import.meta.url), 'utf8');

// Execute the deployed inline script with browser state to check opt-in, navigation, and ordinary redirects.
test('GitHub Pages standalone opt-in depends only on the current URL', () => {
  const run = ({ search = '', hostname = 'kadenar.github.io', framed = false } = {}) => {
    const redirects = [];
    let storageReads = 0;
    const window = {
      location: { hostname, search, replace: (url) => redirects.push(url) },
      get sessionStorage() {
        storageReads++;
        return undefined;
      }
    };
    window.self = window;
    window.top = framed ? {} : window;
    runInNewContext(redirectScript, { window, URLSearchParams });
    assert.equal(storageReads, 0, 'The redirect must not access session storage');
    return redirects;
  };

  const destination = ['https://snowcrows.com/combat-simulator'];

  assert.deepEqual(run(), destination);
  assert.deepEqual(run({ search: '?embed=1' }), destination);
  assert.deepEqual(run({ search: '?standalone=0' }), destination);
  assert.deepEqual(run({ search: '?standalone' }), destination);
  assert.deepEqual(run({ framed: true }), []);
  assert.deepEqual(run({ hostname: 'localhost' }), []);
  assert.deepEqual(run({ search: '?standalone=1&embed=1' }), []);
  assert.deepEqual(run({ search: '?standalone=1' }), []);
  assert.deepEqual(run(), destination);
});
