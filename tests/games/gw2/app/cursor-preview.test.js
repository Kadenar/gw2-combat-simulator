/** Preview contracts keep accepted inputs, candidate work, and pending interaction state separate. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { ProfessionApp } from '#gw2/app/profession-app.js';
import { palettePlanningResult } from '#gw2/app/rotation/context.js';
import { CursorPreview, cursorPreviewReady } from '#gw2/app/rotation/cursor-preview.js';
import { commitRotationEdit } from '#gw2/app/rotation/editing/commit.js';
import { timelineInteractionOptions } from '#gw2/app/rotation/editing/timeline-options.js';
import { renderRotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/view.js';

function fixture() {
  const rotation = [{ type: 'wait', durationMs: 1000 }, { type: 'combat-start' }, { type: 'wait', durationMs: 2000 }];
  const baseline = { combatStartTime: 1, rotationEndTime: 3, planningState: { atSeconds: 3 } };
  const source = { results: baseline, buildRevision: 1, resultRevision: 1, rotationLength: rotation.length };
  let captures = 0;
  let request = { rotation, baseConfig: { patchId: 'current' } };
  const runs = [];
  const preview = new CursorPreview({
    source: () => source,
    capture: () => {
      captures++;
      return structuredClone(request);
    },
    simulate: (input) => {
      runs.push(input);
      return { planningState: { atSeconds: input.rotation.length } };
    }
  });
  return {
    source,
    baseline,
    preview,
    runs,
    captures: () => captures,
    replace: (value) => {
      request = value;
    }
  };
}

test('cursor movement shares captured inputs and prefix work while candidate work stays separate', () => {
  const f = fixture();
  assert.equal(f.preview.at(null), f.baseline);
  assert.equal(f.captures(), 0);
  const prefix = f.preview.at(1);
  assert.equal(f.preview.at(1), prefix);
  f.replace({ rotation: [], baseConfig: { patchId: 'unaccepted' } });
  const candidate = f.preview.at(1, [{ type: 'wait', durationMs: 50 }]);
  assert.notEqual(candidate, prefix);
  assert.equal(f.preview.at(1), prefix);
  f.preview.at(0);
  assert.equal(f.captures(), 1);
  assert.equal(f.runs.length, 3);
  assert.ok(f.runs.every((run) => run.config.patchId === 'current'));
});

test('pending and failed revisions cannot reuse previews or capture edited inputs; publication resumes them', () => {
  const f = fixture();
  const first = f.preview.at(1);
  f.source.buildRevision++;
  for (const simulationStatus of ['queued', 'running', 'error']) {
    f.source.simulationStatus = simulationStatus;
    assert.equal(cursorPreviewReady(f.source), false);
    assert.equal(f.preview.at(1), null);
    assert.equal(f.preview.at(null), null);
    assert.equal(f.preview.at(0, [{ type: 'wait', durationMs: 1 }]), null);
  }

  assert.equal(f.runs.length, 1);
  assert.equal(f.captures(), 1);
  f.source.resultRevision = f.source.buildRevision;
  f.source.results = { ...f.baseline, combatStartTime: 4 };
  f.replace({
    rotation: [{ type: 'wait', durationMs: 4000 }, { type: 'combat-start' }],
    baseConfig: { patchId: 'next' }
  });
  assert.notEqual(f.preview.at(1), first);
  assert.equal(f.captures(), 2);
  assert.equal(f.runs.at(-1).combatStartTime, 4);
  assert.equal(f.runs.at(-1).config.patchId, 'next');
});

test('a new revision invalidates prefixes even when it adopts the same result object', () => {
  const f = fixture();
  const first = f.preview.at(1);
  f.source.buildRevision++;
  f.source.resultRevision++;
  assert.notEqual(f.preview.at(1), first);
  assert.equal(f.captures(), 2);
});

test('prefixes inherit Combat Start but candidates containing the marker resolve their own combat entry', () => {
  const f = fixture();
  f.preview.at(1);
  assert.equal(f.runs.at(-1).combatStartTime, 1);
  f.preview.at(0, [{ type: 'wait', durationMs: 5000 }, { type: 'combat-start' }]);
  assert.equal(Object.hasOwn(f.runs.at(-1), 'combatStartTime'), false);
  f.preview.at(2);
  assert.equal(Object.hasOwn(f.runs.at(-1), 'combatStartTime'), false);
});

test('a reporting tail cannot supply rotation-end availability, and missing baselines cannot start previews', () => {
  const f = fixture();
  f.source.results = { ...f.baseline, planningState: { atSeconds: 20 } };
  assert.notEqual(f.preview.at(null), f.source.results);
  assert.equal(f.runs.length, 1);
  f.source.results = null;
  assert.equal(f.preview.at(0), null);
  assert.equal(f.runs.length, 1);
});

// Rendered commands remain editable after errors; retained rows from an older revision stay guarded.
test('current-revision timeline edits and cursor-only commits work after simulation failure', (t) => {
  const f = fixture();
  const app = {
    analysis: { state: f.source },
    build: {
      rotation: [
        { type: 'wait', durationMs: 1000 },
        { type: 'wait', durationMs: 1000 }
      ]
    },
    rotationInsertionIndex: 1
  };
  const retained = timelineInteractionOptions(app);
  f.source.buildRevision++;
  f.source.simulationStatus = 'error';
  const rerendered = timelineInteractionOptions(app);
  assert.equal(retained.canInteract(), false);
  assert.equal(rerendered.canInteract(), true);
  const gaps = [0, 1, 2].map((index) => ({
    dataset: { insertionIndex: String(index) },
    active: index === 1,
    setAttribute() {},
    classList: {
      contains: () => gaps[index].active,
      toggle: (_name, active) => {
        gaps[index].active = active;
      }
    }
  }));
  const timeline = { querySelectorAll: () => gaps };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      getElementById: (id) => (id === 'rotation-timeline' ? timeline : null),
      querySelector: () => null,
      querySelectorAll: () => []
    }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  app.selectRotationInsertion = (index) => ProfessionApp.prototype.selectRotationInsertion.call(app, index);
  app.selectRotationInsertion(0);
  assert.equal(app.rotationInsertionIndex, 0);
  assert.deepEqual(
    gaps.map((gap) => gap.active),
    [true, false, false]
  );
  // Moving identical waits changes only the cursor, so commit must still run the repaint path.
  commitRotationEdit(app, { type: 'move', from: 0, to: 2 });
  assert.equal(app.rotationInsertionIndex, null);
  assert.deepEqual(
    gaps.map((gap) => gap.active),
    [false, false, true]
  );
  app.changed = () => {};

  rerendered.onRemove(0);
  assert.equal(app.build.rotation.length, 1);
});

// Even an empty or hidden host must not derive a fabricated zero-second snapshot from stale results.
test('explicit pending and failed snapshot renders clear unavailable state', (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let snapshot;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: () => snapshot } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  for (const innerHTML of ['', '<span>Existing state</span>']) {
    for (const simulationStatus of ['queued', 'running', 'error']) {
      snapshot = { innerHTML, hidden: !innerHTML };
      const app = {
        build: { rotation: [{}] },
        analysis: { state: { results: {}, buildRevision: 2, resultRevision: 1, simulationStatus } }
      };
      renderRotationStateSnapshot(app);
      assert.equal(snapshot.innerHTML, '');
      assert.equal(snapshot.hidden, true);
    }
  }
});

test('optional analysis work does not block cursor navigation on a matching baseline', () => {
  const f = fixture();
  for (const simulationStatus of ['queued', 'running', 'idle', 'error']) {
    f.source.simulationStatus = simulationStatus;
    assert.equal(cursorPreviewReady(f.source), true);
    assert.equal(f.preview.at(null), f.baseline);
  }
});

// Editor exploration cannot evict the cursor's prefix or combine accepted and edited command slices.
test('editor probes preserve the palette cache and use the captured suffix', () => {
  const f = fixture();
  const palette = f.preview.at(1);
  f.preview.candidate(0);
  f.preview.candidate(2);
  assert.equal(f.preview.at(1), palette);
  assert.equal(f.runs.length, 3);
  f.replace({ rotation: [], baseConfig: { patchId: 'edited' } });
  f.preview.editThrough(0, 1, (entry) => ({ ...entry, durationMs: 3000 }));
  assert.deepEqual(f.runs.at(-1).rotation, [{ type: 'wait', durationMs: 3000 }, { type: 'combat-start' }]);
  assert.equal(f.runs.at(-1).config.patchId, 'current');
  assert.equal(f.preview.at(1), palette);
});

test('missing results, planning fields, or accepted inputs do not throw during rendering', () => {
  const f = fixture();
  for (const results of [null, undefined]) {
    f.source.results = results;
    assert.equal(cursorPreviewReady(f.source), false);
    assert.equal(f.preview.at(0), null);
  }

  f.source.results = {};
  assert.equal(f.preview.at(null), f.source.results);
  const app = {
    analysis: { state: f.source, capture: () => ({ inputs: null }) },
    build: { rotation: [{}] },
    rotationInsertionIndex: 0
  };
  assert.equal(palettePlanningResult(app), null);
});
