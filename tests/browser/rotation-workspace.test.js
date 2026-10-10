import assert from 'node:assert/strict';
import test from 'node:test';

import { mountHeaderDps, updateHeaderDps } from '#browser/shell/header-dps.js';
import {
  DEFAULT_ROTATION_WORKSPACE_STATE,
  isSimulationConfigVisible,
  mountRotationDpsSummary,
  reduceRotationWorkspaceState
} from '#browser/shell/rotation-workspace.js';

test('rotation workspace keeps simulation config in a drawer in normal and focus modes', () => {
  assert.deepEqual(DEFAULT_ROTATION_WORKSPACE_STATE, {
    configOpen: false,
    focus: false
  });
  assert.equal(isSimulationConfigVisible(DEFAULT_ROTATION_WORKSPACE_STATE), false);

  const configOpen = reduceRotationWorkspaceState(DEFAULT_ROTATION_WORKSPACE_STATE, 'toggle-config');

  assert.deepEqual(configOpen, { configOpen: true, focus: false });
  assert.equal(isSimulationConfigVisible(configOpen), true);
  assert.deepEqual(reduceRotationWorkspaceState(configOpen, 'escape'), {
    configOpen: false,
    focus: false
  });

  const focused = reduceRotationWorkspaceState(DEFAULT_ROTATION_WORKSPACE_STATE, 'toggle-focus');

  assert.deepEqual(focused, { configOpen: false, focus: true });
  assert.equal(isSimulationConfigVisible(focused), false);
  assert.equal(isSimulationConfigVisible({ configOpen: true, focus: true }), true);
  assert.deepEqual(reduceRotationWorkspaceState({ configOpen: true, focus: true }, 'toggle-focus'), {
    configOpen: false,
    focus: false
  });
  assert.equal(reduceRotationWorkspaceState(focused, 'escape'), focused);
});

test('rotation DPS summary mounts directly after the timeline', () => {
  let inserted = null;
  const timeline = {
    after(element) {
      inserted = element;
    }
  };
  const panel = {
    querySelector: (selector) => (selector === '#rotation-timeline' ? timeline : null)
  };
  const root = {
    getElementById: () => null,
    createElement: () => ({ id: '', className: '' })
  };

  mountRotationDpsSummary(root, panel);

  assert.deepEqual(inserted, {
    id: 'rotation-dps-summary',
    className: 'rotation-dps-summary'
  });
});

test('header DPS mounts once and tracks the latest result', () => {
  const elements = new Map();
  const buildMenu = {
    after(node) {
      elements.set(node.id, node);
    }
  };
  const element = () => ({
    id: '',
    className: '',
    textContent: '',
    attributes: new Map(),
    children: [],
    append(...children) {
      this.children.push(...children);
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    querySelector(selector) {
      return this.children.find((child) => `.${child.className}` === selector) || null;
    }
  });
  const root = {
    createElement: () => element(),
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => {
      return selector === '#build-switcher-menu' ? buildMenu : null;
    }
  };

  const indicator = mountHeaderDps(root);
  mountHeaderDps(root);
  updateHeaderDps('12,345', root);

  assert.equal(elements.size, 1);
  assert.equal(indicator.querySelector('.header-dps-label').textContent, 'DPS');
  assert.equal(indicator.querySelector('.header-dps-value').textContent, '12,345');
  assert.equal(indicator.attributes.get('aria-label'), 'Current rotation DPS: 12,345');

  updateHeaderDps(null, root);
  assert.equal(indicator.querySelector('.header-dps-value').textContent, '—');
  assert.equal(indicator.attributes.get('aria-label'), 'Current rotation DPS unavailable');
});
