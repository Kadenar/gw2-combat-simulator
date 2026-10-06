import assert from 'node:assert/strict';
import test from 'node:test';
import { simulatorViewFromHash, simulatorViewHref } from '#gw2/app/page/navigation.js';

test('simulator navigation defaults to the workspace and recognizes each tool', () => {
  assert.equal(simulatorViewFromHash(''), 'workspace');
  assert.equal(simulatorViewFromHash('#professions'), 'workspace');
  assert.equal(simulatorViewFromHash('#workspace'), 'workspace');
  assert.equal(simulatorViewFromHash('#analysis'), 'analysis');
  assert.equal(simulatorViewFromHash('#ANALYSIS'), 'analysis');
  assert.equal(simulatorViewFromHash('#gear-optimizer'), 'gear-optimizer');
  assert.equal(simulatorViewFromHash('#GEAR-OPTIMIZER'), 'gear-optimizer');
  assert.equal(simulatorViewFromHash('#benchmarks'), 'benchmarks');
  assert.equal(simulatorViewFromHash('#BENCHMARKS'), 'benchmarks');
  assert.equal(simulatorViewFromHash('#unknown'), 'workspace');
});

test('simulator views stay on the selected profession page', () => {
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'workspace'), 'elementalist.html#workspace');
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'analysis'), 'elementalist.html#analysis');
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'gear-optimizer'), 'elementalist.html#gear-optimizer');
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'benchmarks'), 'elementalist.html#benchmarks');
  assert.equal(simulatorViewHref('', 'workspace'), 'index.html#workspace');
});
