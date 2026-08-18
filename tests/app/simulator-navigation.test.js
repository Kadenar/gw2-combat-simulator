import assert from 'node:assert/strict';
import test from 'node:test';
import { simulatorViewFromHash, simulatorViewHref } from '../../js/app/profession/navigation.js';

test('simulator navigation defaults to the workspace and recognizes analysis', () => {
  assert.equal(simulatorViewFromHash(''), 'workspace');
  assert.equal(simulatorViewFromHash('#professions'), 'professions');
  assert.equal(simulatorViewFromHash('#workspace'), 'workspace');
  assert.equal(simulatorViewFromHash('#analysis'), 'analysis');
  assert.equal(simulatorViewFromHash('#ANALYSIS'), 'analysis');
  assert.equal(simulatorViewFromHash('#unknown'), 'workspace');
});

test('simulator view links stay on the active profession page', () => {
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'professions'), 'elementalist.html#professions');
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'workspace'), 'elementalist.html#workspace');
  assert.equal(simulatorViewHref('/simulator/elementalist.html', 'analysis'), 'elementalist.html#analysis');
  assert.equal(simulatorViewHref('', 'workspace'), 'index.html#workspace');
});
