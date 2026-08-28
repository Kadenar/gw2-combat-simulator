import assert from 'node:assert/strict';
import test from 'node:test';
import { simulatorViewFromHash, simulatorViewHref } from '../../js/games/gw2/app/profession/navigation.js';

test('simulator navigation defaults to the workspace and recognizes analysis', () => {
  assert.equal(simulatorViewFromHash(''), 'workspace');
  assert.equal(simulatorViewFromHash('#professions'), 'workspace');
  assert.equal(simulatorViewFromHash('#workspace'), 'workspace');
  assert.equal(simulatorViewFromHash('#analysis'), 'analysis');
  assert.equal(simulatorViewFromHash('#ANALYSIS'), 'analysis');
  assert.equal(simulatorViewFromHash('#unknown'), 'workspace');
});

test('professions has its own page while simulator views stay on the active profession', () => {
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'professions'), 'index.html');
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'workspace'), 'elementalist.html#workspace');
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'analysis'), 'elementalist.html#analysis');
  assert.equal(simulatorViewHref('', 'workspace'), 'index.html#workspace');
});
