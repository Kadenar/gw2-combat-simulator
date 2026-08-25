import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeRotationDeadTimeVisibility,
  normalizeRotationTimelineSize,
  ROTATION_DEAD_TIME_STORAGE_KEY,
  rotationDeadTimeVisibility,
  setRotationDeadTimeVisibility,
  ROTATION_TIMELINE_SIZE_OPTIONS
} from '../../js/app/rotation/timeline/size.js';
import {
  normalizeRotationProcOverlayVisibility,
  readStoredRotationProcOverlayVisibility,
  ROTATION_PROC_OVERLAY_STORAGE_KEYS,
  storeRotationProcOverlayVisibility
} from '../../js/app/rotation/timeline/proc-overlays.js';
import {
  DEFAULT_ROTATION_WORKSPACE_STATE,
  isSimulationConfigVisible,
  mountFloatingDps,
  mountRotationDpsSummary,
  reduceRotationWorkspaceState,
  syncRotationFocusResults,
  updateFloatingDps
} from '../../js/app/rotation/workspace.js';
import { currentTimelineResults, reconcileTimelineRows } from '../../js/app/rotation/timeline/view.js';

function storageRoot(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    defaultView: {
      localStorage: {
        getItem(key) {
          return values.get(key) ?? null;
        },
        setItem(key, value) {
          values.set(key, value);
        }
      }
    }
  };
}

test('keyed timeline reconciliation retains unchanged rows and replaces changed rows', () => {
  const root = {
    children: [],
    get lastElementChild() {
      return this.children.at(-1) || null;
    },
    insertBefore(node, before) {
      const existingIndex = this.children.indexOf(node);

      if (existingIndex >= 0) this.children.splice(existingIndex, 1);
      const index = before == null ? this.children.length : this.children.indexOf(before);
      this.children.splice(index, 0, node);
    },
    removeChild(node) {
      this.children.splice(this.children.indexOf(node), 1);
    }
  };
  let created = 0;
  const createRow = (html) => ({ html, instance: ++created });

  reconcileTimelineRows(
    root,
    [
      { key: 'a', html: 'A' },
      { key: 'b', html: 'B' }
    ],
    createRow
  );
  const originalA = root.children[0];
  const originalB = root.children[1];

  reconcileTimelineRows(
    root,
    [
      { key: 'a', html: 'A' },
      { key: 'b', html: 'B changed' },
      { key: 'c', html: 'C' }
    ],
    createRow
  );
  assert.equal(root.children[0], originalA);
  assert.notEqual(root.children[1], originalB);
  assert.equal(created, 4);

  const retainedC = root.children[2];
  reconcileTimelineRows(
    root,
    [
      { key: 'c', html: 'C' },
      { key: 'a', html: 'A' }
    ],
    createRow
  );
  assert.deepEqual(root.children, [retainedC, originalA]);
  assert.equal(created, 4, 'reordering retained keys creates no DOM rows');
});

test('timeline reconciliation preserves its scroll position while replacing rows', () => {
  const root = {
    children: [],
    scrollTop: 120,
    get lastElementChild() {
      return this.children.at(-1) || null;
    },
    insertBefore(node, before) {
      const existingIndex = this.children.indexOf(node);

      if (existingIndex >= 0) this.children.splice(existingIndex, 1);
      const index = before == null ? this.children.length : this.children.indexOf(before);
      this.children.splice(index, 0, node);
      this.scrollTop = 999;
    },
    removeChild(node) {
      this.children.splice(this.children.indexOf(node), 1);
      this.scrollTop = 999;
    }
  };
  const createRow = (html) => ({ html });

  reconcileTimelineRows(root, [{ key: 'row', html: 'before' }], createRow);
  assert.equal(root.scrollTop, 120);

  root.scrollTop = 48;
  reconcileTimelineRows(root, [{ key: 'row', html: 'after' }], createRow);
  assert.equal(root.scrollTop, 48);
});

test('timeline timings use only results produced for the current build revision', () => {
  const staleResults = { steps: [{ ri: 0, skill: 'Negative Bash', start: 0, end: 0, fullCastMs: 0 }] };
  const currentResults = { steps: [{ ri: 0, skill: 'Negative Bash', start: 0, end: 640, fullCastMs: 640 }] };

  assert.equal(
    currentTimelineResults({ buildRevision: 2, resultRevision: 1, results: staleResults }),
    null,
    'a first-load build change must not reuse the previous simulation timing'
  );
  assert.equal(
    currentTimelineResults({ buildRevision: 2, resultRevision: 2, results: currentResults }),
    currentResults
  );
});

test('rotation timeline sizes expose two larger display options', () => {
  assert.deepEqual(
    ROTATION_TIMELINE_SIZE_OPTIONS.map((option) => [option.value, option.label]),
    [
      ['normal', '100%'],
      ['large', '125%'],
      ['extra-large', '150%']
    ]
  );
  assert.equal(normalizeRotationTimelineSize('large'), 'large');
  assert.equal(normalizeRotationTimelineSize('extra-large'), 'extra-large');
  assert.equal(normalizeRotationTimelineSize('unsupported'), 'normal');
  assert.equal(normalizeRotationTimelineSize(null), 'normal');
  assert.equal(normalizeRotationDeadTimeVisibility('true'), true);
  assert.equal(normalizeRotationDeadTimeVisibility(true), true);
  assert.equal(normalizeRotationDeadTimeVisibility('false'), false);
  assert.equal(normalizeRotationDeadTimeVisibility(null), false);
});

test('rotation dead-time visibility applies to the timeline and persists', () => {
  const stored = new Map();
  const panel = { dataset: {} };
  const root = {
    defaultView: {
      localStorage: {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => stored.set(key, value)
      }
    },
    getElementById: () => ({ closest: () => panel })
  };

  setRotationDeadTimeVisibility(root, true);

  assert.equal(panel.dataset.showDeadTime, 'true');
  assert.equal(stored.get(ROTATION_DEAD_TIME_STORAGE_KEY), 'true');
  assert.equal(rotationDeadTimeVisibility(root), true);
});

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

test('focus mode expands DPS snapshots only for the focused workspace', () => {
  let focused = true;
  const details = { dataset: {}, open: false };
  const root = {
    body: { hasAttribute: () => focused },
    querySelectorAll: () => [details]
  };

  syncRotationFocusResults(root);
  assert.equal(details.open, true);
  assert.equal(details.dataset.focusExpanded, 'true');

  focused = false;
  syncRotationFocusResults(root);
  assert.equal(details.open, false);
  assert.equal(details.dataset.focusExpanded, undefined);
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

test('floating DPS mounts once and tracks the latest result', () => {
  const elements = new Map();
  const footer = {
    append(node) {
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
    body: {
      dataset: { profession: 'mesmer' },
      append(node) {
        elements.set(node.id, node);
      }
    },
    createElement: () => element(),
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => (selector === '.landing-footer' ? footer : null)
  };

  const indicator = mountFloatingDps(root);
  mountFloatingDps(root);
  updateFloatingDps('12,345', root);

  assert.equal(elements.size, 1);
  assert.equal(indicator.querySelector('.floating-dps-label').textContent, 'DPS');
  assert.equal(indicator.querySelector('.floating-dps-value').textContent, '12,345');
  assert.equal(indicator.attributes.get('aria-label'), 'Current rotation DPS: 12,345');

  updateFloatingDps(null, root);
  assert.equal(indicator.querySelector('.floating-dps-value').textContent, '—');
  assert.equal(indicator.attributes.get('aria-label'), 'Current rotation DPS unavailable');
});

test('rotation proc overlay preferences normalize stored checkbox values', () => {
  assert.equal(normalizeRotationProcOverlayVisibility(true), true);
  assert.equal(normalizeRotationProcOverlayVisibility('true'), true);
  assert.equal(normalizeRotationProcOverlayVisibility(false), false);
  assert.equal(normalizeRotationProcOverlayVisibility('false'), false);
  assert.equal(normalizeRotationProcOverlayVisibility(null), false);
});

test('rotation sigil and relic overlay preferences persist independently', () => {
  const root = storageRoot({
    [ROTATION_PROC_OVERLAY_STORAGE_KEYS.sigil]: 'true'
  });

  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sigil'), true);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'relic'), false);

  storeRotationProcOverlayVisibility(root, 'relic', true);
  storeRotationProcOverlayVisibility(root, 'sigil', false);

  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sigil'), false);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'relic'), true);
});
