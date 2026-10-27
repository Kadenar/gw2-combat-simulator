import assert from 'node:assert/strict';
import test from 'node:test';

import { mountHeaderDps, updateHeaderDps } from '#browser/shell/header-dps.js';
import {
  DEFAULT_ROTATION_WORKSPACE_STATE,
  mountRotationDpsSummary,
  toggleRotationFocusState
} from '#browser/shell/rotation-workspace.js';

// Inline settings own their native disclosure state independently of full-screen focus.
test('rotation workspace toggles focus independently of simulation settings', () => {
  assert.deepEqual(DEFAULT_ROTATION_WORKSPACE_STATE, { focus: false });
  const focused = toggleRotationFocusState(DEFAULT_ROTATION_WORKSPACE_STATE);
  assert.deepEqual(focused, { focus: true });
  assert.deepEqual(toggleRotationFocusState(focused), { focus: false });
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

  mountHeaderDps(root);
  const indicator = root.getElementById('header-dps');
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
