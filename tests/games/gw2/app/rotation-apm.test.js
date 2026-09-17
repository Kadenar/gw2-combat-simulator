import assert from 'node:assert/strict';
import test from 'node:test';
import { resultSummaryMetrics } from '#gw2/app/results/model.js';
import { mountRotationResults } from '#gw2/app/results/analysis-panel.js';
import { createGw2SimulationViewModel } from '#gw2/app/results/view.js';
import { simulateDeclarativeGw2 } from '#gw2/platform/simulation/pipeline.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { inertContainer } from '#tests/helpers/dom.js';

// Presentation rounds only the displayed rate and exposes the same accounting on hover and keyboard disclosure.
test('APM renders next to duration with a tooltip and sustained peak details', () => {
  const result = simulateDeclarativeGw2({
    profession: testProfession,
    rotation: ['Fixture Charge', { type: 'wait', durationMs: 10100 }]
  });
  const metrics = resultSummaryMetrics(result);
  assert.equal(metrics[1].value, '6 APM');
  assert.match(metrics[1].title, /^1 non-autoattack actions over 10.1 seconds\./);
  assert.ok(result.rotationApm.apm > 5.9 && result.rotationApm.apm < 6);
  assert.deepEqual(
    metrics[1].details.filter((entry) => entry.label.startsWith('Peak APM')),
    [
      { label: 'Peak APM over 5s', value: '12 APM (0.0 to 5.0s)' },
      { label: 'Peak APM over 10s', value: '6 APM (0.0 to 10.0s)' }
    ]
  );
  const container = inertContainer();
  mountRotationResults(container, { metrics });
  assert.match(container.innerHTML, /title="1 non-autoattack actions/);
  assert.match(container.innerHTML, /aria-label="6 APM:/);
  assert.match(container.innerHTML, /Show Actions \/ min breakdown/);
  assert.doesNotMatch(container.innerHTML, /standard deviation|bucket|Spike threshold/);
});

test('zero-duration and empty views show an em dash while positive-duration zero-action views show 0 APM', () => {
  for (const [rotation, expected] of [
    [[], '—'],
    [['Fixture Charge'], '—'],
    [[{ type: 'wait', durationMs: 1000 }], '0 APM']
  ]) {
    const result = simulateDeclarativeGw2({ profession: testProfession, rotation });
    assert.equal(resultSummaryMetrics(result)[1].value, expected);
  }

  const container = inertContainer();
  const view = createGw2SimulationViewModel({ build: { rotation: [] } });
  view.summary.panels[0].mount(container);
  assert.match(container.innerHTML, /Actions \/ min/);
  assert.doesNotMatch(container.innerHTML, /NaN|Infinity/);
});
