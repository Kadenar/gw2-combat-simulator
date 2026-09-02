import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SimulationSection } from '#ui/simulation-view.js';

test('a fake game renders neutral summary and timeline models', () => {
  const html = renderToStaticMarkup(
    createElement(SimulationSection, {
      view: {
        metrics: [{ label: 'Output', value: '42' }],
        panels: [
          {
            kind: 'timeline',
            title: 'Actions',
            durationMs: 1000,
            points: [{ atMs: 250, label: 'Pulse' }]
          }
        ]
      }
    })
  );

  assert.match(html, /Output/);
  assert.match(html, /Actions/);
  assert.match(html, /left:25%/);
  assert.doesNotMatch(html, /boon|condition|relic|profession/i);
});
