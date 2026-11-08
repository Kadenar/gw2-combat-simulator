import assert from 'node:assert/strict';
import test from 'node:test';

import { mountHeaderDps, updateDpsStatus } from '#browser/shell/dps-status.js';
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
  let inserted = [];
  const timeline = {
    after(...elements) {
      inserted = elements;
    }
  };
  const panel = {
    querySelector: (selector) => (selector === '#rotation-timeline' ? timeline : null)
  };
  const root = {
    getElementById: () => null,
    createElement: () => ({
      id: '',
      className: '',
      attributes: new Map(),
      setAttribute(name, value) {
        this.attributes.set(name, value);
      }
    })
  };

  mountRotationDpsSummary(root, panel);

  const [summary, status] = inserted;
  assert.equal(summary.id, 'rotation-dps-summary');
  assert.equal(summary.className, 'rotation-dps-summary');
  assert.equal(summary.attributes.has('aria-live'), false);
  assert.equal(status.id, 'rotation-dps-status');
  assert.equal(status.attributes.get('aria-atomic'), 'true');
  assert.equal(status.attributes.get('aria-live'), 'off');
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

  // The Focus status announces only DPS, and rerenders with an unchanged value do not repeat it.
  const announcements = [];
  const status = element();
  Object.defineProperty(status, 'textContent', {
    get: () => announcements.at(-1) || '',
    set: (text) => {
      announcements.push(text);
    }
  });
  elements.set('rotation-dps-status', status);

  mountHeaderDps(root);
  const indicator = root.getElementById('header-dps');
  mountHeaderDps(root);
  updateDpsStatus('12,345', root);

  assert.equal(elements.size, 2);
  assert.equal(indicator.querySelector('.header-dps-label').textContent, 'DPS');
  assert.equal(indicator.querySelector('.header-dps-value').textContent, '12,345');
  assert.equal(indicator.attributes.get('aria-label'), 'Current rotation DPS: 12,345');
  updateDpsStatus('12,345', root);
  assert.deepEqual(announcements, ['DPS: 12,345']);

  updateDpsStatus(null, root);
  assert.equal(indicator.querySelector('.header-dps-value').textContent, '-');
  assert.equal(indicator.attributes.get('aria-label'), 'Current rotation DPS unavailable');
  assert.deepEqual(announcements, ['DPS: 12,345', 'DPS unavailable']);
});
