import assert from 'node:assert/strict';
import test from 'node:test';

import { mountSimulationView } from '#ui/results/simulation-view.js';

// Extensions share the cleared host so games retain ownership of their rendered content.
test('simulation sections clear stale content and mount extensions in order', () => {
  const container = { innerHTML: 'stale content' };
  const view = {
    panels: [
      {
        kind: 'extension',
        mount(host) {
          assert.equal(host, container);
          assert.equal(host.innerHTML, '');
          host.innerHTML = '<p>Summary</p>';
        }
      },
      {
        kind: 'extension',
        mount(host) {
          assert.equal(host, container);
          assert.equal(host.innerHTML, '<p>Summary</p>');
          host.innerHTML += '<p>Details</p>';
        }
      }
    ]
  };

  mountSimulationView(null, view);
  mountSimulationView(undefined, view);
  mountSimulationView(container, view);
  assert.equal(container.innerHTML, '<p>Summary</p><p>Details</p>');

  for (const emptyView of [{}, { panels: [] }]) {
    container.innerHTML = 'stale content';
    mountSimulationView(container, emptyView);
    assert.equal(container.innerHTML, '');
  }
});
