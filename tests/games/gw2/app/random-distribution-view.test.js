import assert from 'node:assert/strict';
import test from 'node:test';
import { mountRandomDistribution } from '#gw2/app/results/random-distribution-view.js';
import { inertContainer } from '#tests/helpers/dom.js';

test('randomized DPS range waits for its calculate button', () => {
  const runButton = {};
  const container = {
    ...inertContainer(),
    querySelector: (selector) => (selector === '[data-role="rng-run"]' ? runButton : null)
  };
  let runCount = 0;

  mountRandomDistribution(
    container,
    { randomDistributionRequested: true, randomDistributionTrials: 500 },
    {
      onRunRandomDistribution() {
        runCount += 1;
      }
    }
  );

  assert.match(container.innerHTML, /weapon strength and supported random procs/);
  assert.match(container.innerHTML, /500 simulations/);
  assert.match(container.innerHTML, /Calculate range/);
  assert.equal(typeof runButton.onclick, 'function');
  runButton.onclick();
  assert.equal(runCount, 1);
});

test('randomized DPS range renders completed simulations and percentage progress', () => {
  const container = inertContainer();

  mountRandomDistribution(container, {
    randomDistributionRequested: true,
    randomDistributionStale: true,
    randomDistributionTrials: 500,
    randomDistributionProgress: {
      completed: 125,
      total: 500,
      percent: 25
    }
  });

  assert.match(container.innerHTML, /role="progressbar"/);
  assert.match(container.innerHTML, /aria-valuenow="25"/);
  assert.match(container.innerHTML, /style="width: 25%"/);
  assert.match(container.innerHTML, /125 \/ 500 simulations \(25%\)/);
});
