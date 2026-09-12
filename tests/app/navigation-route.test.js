import assert from 'node:assert/strict';
import test from 'node:test';
import { navigationRoute } from '#app/embed.js';

// Internal links retain only the active modes, including when bookmarked or opened in another tab.
test('navigation routes preserve standalone and embed flags without losing destination queries or hashes', () => {
  const route = 'mesmer.html?build=example#workspace';
  assert.equal(navigationRoute(route, ''), route);
  assert.equal(navigationRoute(route, '?standalone=0'), route);
  assert.equal(navigationRoute(route, '?standalone'), route);
  assert.equal(
    navigationRoute(route, '?standalone=1&source=private'),
    'mesmer.html?build=example&standalone=1#workspace'
  );
  assert.equal(navigationRoute('index.html', '?embed'), 'index.html?embed=1');
  const decorated = navigationRoute(route, '?standalone=1&embed=1');
  assert.equal(decorated, 'mesmer.html?build=example&embed=1&standalone=1#workspace');
  assert.equal(navigationRoute(decorated, '?standalone=1&embed=1'), decorated);
  assert.equal(navigationRoute('mesmer.html#notes?embed=1', '?embed'), 'mesmer.html?embed=1#notes?embed=1');
  assert.equal(navigationRoute('index.html?embed#workspace', '?embed'), 'index.html?embed=#workspace');
});
