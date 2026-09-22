import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeRotationDeadTimeVisibility,
  normalizeRotationTimelineSize,
  ROTATION_DEAD_TIME_STORAGE_KEY,
  rotationDeadTimeVisibility,
  setRotationDeadTimeVisibility,
  ROTATION_TIMELINE_SIZE_OPTIONS
} from '#gw2/app/rotation/timeline/display-preferences.js';
import {
  normalizeRotationProcOverlayVisibility,
  readStoredRotationProcOverlayVisibility,
  ROTATION_PROC_OVERLAY_STORAGE_KEYS,
  storeRotationProcOverlayVisibility
} from '#gw2/app/rotation/timeline/proc-overlay-preferences.js';
import { currentTimelineResults } from '#gw2/app/rotation/timeline/model.js';
import { reconcileTimelineRows, renderTimeline } from '#gw2/app/rotation/timeline/view.js';
import { timelineRowsView } from '#gw2/app/rotation/timeline/rows.js';

// Interrupted packet casts turn red only without damage; committed non-damaging effects keep normal styling.
test('timeline marks failed zero-damage casts without marking committed buffs as cancelled', () => {
  const skill = { id: 1, name: 'Example Skill' };
  const packetSkill = { id: 2, name: 'Packet Skill', interruptMode: 'per-packet' };
  const buffSkill = { id: 3, name: 'Committed Buff', interruptCommitMs: 1 };
  const app = {
    skills: [skill, packetSkill, buffSkill],
    skillById: new Map([
      [1, skill],
      [2, packetSkill],
      [3, buffSkill]
    ]),
    adapter: { skillTooltip: () => ({ description: '', facts: [] }), eliteSpecialization: () => '' },
    profession: { ui: { timelineWeaponLineTransition: () => null } }
  };
  const steps = [
    { interrupted: true },
    { interrupted: true },
    { interrupted: false },
    { interrupted: true, invalid: true },
    { interrupted: true, skillId: packetSkill.id },
    { interrupted: true, skillId: buffSkill.id },
    { interrupted: true, skillId: buffSkill.id, cancelledBeforeCommit: true },
    { interrupted: true, skillId: packetSkill.id },
    { interrupted: false, skillId: packetSkill.id }
  ].map((state, ri) => ({
    ...state,
    ri,
    skill: skill.name,
    activationId: `cast:${ri}`,
    start: ri * 100,
    end: ri * 100 + 100
  }));
  const build = {
    rotation: steps.map((step) => ({ type: 'cast', skillId: step.skillId ?? skill.id })),
    startingWeaponSet: 1,
    weapons: [],
    alternateWeapons: []
  };
  const results = {
    steps,
    rotationEndTime: 1,
    observationEndTime: 1,
    combatEndTime: 1,
    resolvedEvents: [
      { activationId: 'cast:0', damage: 0 },
      { activationId: 'cast:1', damage: 10, at: 0.8 },
      { activationId: 'cast:4', damage: 0 },
      { activationId: 'cast:7', damage: 10, at: 0.8 }
    ]
  };
  for (const readOnly of [false, true]) {
    const html = timelineRowsView(app, build, results, readOnly, new Set(), false)
      .rows.map((row) => row.html)
      .join('');
    assert.match(
      html,
      /class="rot-skill rot-cancelled"[^>]*data-idx="0"[^>]*Cancelled without dealing damage[^>]*--att-border:#ff3b45/
    );
    for (const index of [1, 2, 3, 5, 7, 8]) {
      assert.match(html, new RegExp(`data-idx="${index}"[^>]*--att-border:#9d7bd0`));
    }

    assert.match(html, /class="rot-skill rot-cancelled"[^>]*data-idx="6"/);

    assert.match(html, /class="rot-skill rot-cancelled"[^>]*data-idx="4"[^>]*--att-border:#ff3b45/);

    const pending = timelineRowsView(app, build, null, readOnly, new Set(), false)
      .rows.map((row) => row.html)
      .join('');
    assert.doesNotMatch(pending, /rot-cancelled|--att-border:#ff3b45/);
  }
});

test('timeline labels the executed skill variant while preserving the saved command', () => {
  // A build trait may replace an imported action without rewriting the user's rotation.
  const base = { id: 76642, name: 'Evolve (Base)' };
  const traited = { id: 76651, name: 'Evolve (Double Helix)' };
  const app = {
    skills: [base, traited],
    skillById: new Map([
      [base.id, base],
      [traited.id, traited]
    ]),
    adapter: { skillTooltip: () => ({ description: '', facts: [] }), eliteSpecialization: () => 'Amalgam' },
    profession: { ui: { timelineWeaponLineTransition: () => null } }
  };
  const build = {
    rotation: [{ type: 'cast', skillId: base.id }],
    startingWeaponSet: 1,
    weapons: [],
    alternateWeapons: []
  };
  for (const skill of [traited, base]) {
    const results = { duration: 1, steps: [{ ri: 0, skillId: skill.id, skill: skill.name, start: 0, end: 1000 }] };
    const html = timelineRowsView(app, build, results, false, new Set(), false)
      .rows.map((row) => row.html)
      .join('');
    assert.ok(html.includes(skill.name));
    assert.ok(!html.includes(skill === base ? traited.name : base.name));
    assert.equal(build.rotation[0].skillId, base.id);
  }
});

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

test('default empty timelines stay interactive while read-only timelines omit authoring behavior', (t) => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else delete globalThis.document;
  });
  const attributes = new Map();
  const root = {
    dataset: {},
    classList: { add() {}, remove() {} },
    innerHTML: '',
    ownerDocument: null,
    previousElementSibling: null,
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    toggleAttribute(name, value) {
      if (value) attributes.set(name, '');
      else attributes.delete(name);
    }
  };
  const fakeDocument = {
    activeElement: null,
    body: {},
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    getElementById: (id) => (id === 'rotation-timeline' ? root : null)
  };
  root.ownerDocument = fakeDocument;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
  const app = {
    build: { rotation: [] },
    buildRevision: 1,
    resultRevision: 1,
    results: null,
    rotationInsertionIndex: null
  };

  renderTimeline(app);
  assert.equal(attributes.get('aria-busy'), 'false');
  assert.equal(typeof root.ondrop, 'function');
  assert.equal(attributes.has('aria-readonly'), false);

  // Live results become busy on edits and clear when the matching simulation arrives.
  app.buildRevision = 2;
  renderTimeline(app);
  assert.equal(attributes.get('aria-busy'), 'true');
  app.resultRevision = 2;
  renderTimeline(app);
  assert.equal(attributes.get('aria-busy'), 'false');
  app.buildRevision = 3;
  root.ondrop = null;
  renderTimeline(app, { root, procRoot: null, build: { rotation: [] }, result: null, readOnly: true });
  assert.equal(attributes.get('aria-busy'), 'false');
  assert.equal(root.ondrop, null);
  assert.equal(attributes.has('aria-readonly'), true);
  assert.doesNotMatch(root.innerHTML, /rot-(?:insertion-gap|edit|x)/);
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

test('rotation proc overlay preferences normalize stored checkbox values', () => {
  assert.equal(normalizeRotationProcOverlayVisibility(true), true);
  assert.equal(normalizeRotationProcOverlayVisibility('true'), true);
  assert.equal(normalizeRotationProcOverlayVisibility(false), false);
  assert.equal(normalizeRotationProcOverlayVisibility('false'), false);
  assert.equal(normalizeRotationProcOverlayVisibility(null), false);
});

test('rotation proc overlay preferences persist independently', () => {
  const root = storageRoot({
    [ROTATION_PROC_OVERLAY_STORAGE_KEYS.sigil]: 'true'
  });

  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sigil'), true);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'relic'), false);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sovereignOfLight'), false);

  storeRotationProcOverlayVisibility(root, 'relic', true);
  storeRotationProcOverlayVisibility(root, 'sovereignOfLight', true);
  storeRotationProcOverlayVisibility(root, 'sigil', false);

  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sigil'), false);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'relic'), true);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sovereignOfLight'), true);
});
