import assert from 'node:assert/strict';
import test from 'node:test';

import { mountSimulationView } from '../../js/ui/simulation-view.js';

test('a fake game renders neutral summary and timeline models', () => {
  const container = { innerHTML: '' };
  mountSimulationView(container, {
    metrics: [{ label: 'Output', value: '42' }],
    panels: [
      {
        kind: 'timeline',
        title: 'Actions',
        durationMs: 1000,
        points: [{ atMs: 250, label: 'Pulse' }]
      }
    ]
  });

  assert.match(container.innerHTML, /Output/);
  assert.match(container.innerHTML, /Actions/);
  assert.match(container.innerHTML, /left:25%/);
  assert.doesNotMatch(container.innerHTML, /boon|condition|relic|profession/i);
});
