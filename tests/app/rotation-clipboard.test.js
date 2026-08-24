import assert from 'node:assert/strict';
import test from 'node:test';

import {
  copyRotationSelection,
  normalizeRotationSelection,
  pasteRotationClipboard,
  rotationSelectionForEntry,
  selectRotationClipboardEntry
} from '../../js/app/rotation/clipboard.js';

test('rotation range selection accepts its endpoints in either order', () => {
  const first = rotationSelectionForEntry(null, 4, 8);
  assert.deepEqual(first, {
    anchorIndex: 4,
    startIndex: 4,
    endIndex: 5,
    awaitingEnd: true
  });
  assert.deepEqual(rotationSelectionForEntry(first, 1, 8), {
    anchorIndex: 4,
    startIndex: 1,
    endIndex: 5,
    awaitingEnd: false
  });
});

test('rotation range selection is clamped or discarded when the rotation changes', () => {
  assert.deepEqual(normalizeRotationSelection({ anchorIndex: 1, startIndex: 1, endIndex: 5, awaitingEnd: false }, 3), {
    anchorIndex: 1,
    startIndex: 1,
    endIndex: 3,
    awaitingEnd: false
  });
  assert.equal(normalizeRotationSelection({ anchorIndex: 4, startIndex: 4, endIndex: 5, awaitingEnd: false }, 3), null);
});

test('copy preserves complete commands and moves insertion after the selected loop', () => {
  const selectedWait = { type: 'wait', durationMs: 750 };
  const selectedCast = { type: 'cast', skillId: 42, interruptAfterMs: 320 };
  const app = {
    build: { rotation: [{ type: 'combat-start' }, selectedWait, selectedCast, { type: 'cooldown-reset' }] },
    rotationSelection: { anchorIndex: 1, startIndex: 1, endIndex: 3, awaitingEnd: false },
    rotationSelectionMode: true,
    rotationClipboard: [],
    rotationInsertionIndex: 0
  };

  assert.equal(copyRotationSelection(app), true);
  assert.deepEqual(app.rotationClipboard, [selectedWait, selectedCast]);
  assert.notEqual(app.rotationClipboard[0], selectedWait);
  assert.notEqual(app.rotationClipboard[1], selectedCast);
  assert.equal(app.rotationSelectionMode, false);
  assert.equal(app.rotationInsertionIndex, 3);
});

test('choosing the second endpoint automatically copies the loop', () => {
  const app = {
    build: {
      rotation: [
        { type: 'cast', skillId: 1 },
        { type: 'cast', skillId: 2 },
        { type: 'wait', durationMs: 250 },
        { type: 'cast', skillId: 3 },
        { type: 'cast', skillId: 4 }
      ]
    },
    rotationSelection: null,
    rotationSelectionMode: true,
    rotationClipboard: [],
    rotationInsertionIndex: null
  };

  assert.equal(selectRotationClipboardEntry(app, 3), 'pending');
  assert.equal(selectRotationClipboardEntry(app, 1), 'copied');
  assert.deepEqual(app.rotationClipboard, [
    { type: 'cast', skillId: 2 },
    { type: 'wait', durationMs: 250 },
    { type: 'cast', skillId: 3 }
  ]);
  assert.equal(app.rotationInsertionIndex, 4);
  assert.equal(app.rotationSelectionMode, false);
});

test('paste inserts at the active cursor and advances it for repeated loops', () => {
  let changedCount = 0;
  const app = {
    build: {
      rotation: [
        { type: 'cast', skillId: 'Opening' },
        { type: 'cast', skillId: 'Closing' }
      ]
    },
    rotationInsertionIndex: 1,
    rotationSelection: null,
    rotationSelectionMode: false,
    rotationClipboard: [
      { type: 'cast', skillId: 'Loop skill' },
      { type: 'wait', durationMs: 250 }
    ],
    changed(rebuildStatic) {
      assert.equal(rebuildStatic, false);
      changedCount += 1;
    }
  };

  assert.equal(pasteRotationClipboard(app), true);
  assert.equal(pasteRotationClipboard(app), true);
  assert.deepEqual(app.build.rotation, [
    { type: 'cast', skillId: 'Opening' },
    { type: 'cast', skillId: 'Loop skill' },
    { type: 'wait', durationMs: 250 },
    { type: 'cast', skillId: 'Loop skill' },
    { type: 'wait', durationMs: 250 },
    { type: 'cast', skillId: 'Closing' }
  ]);
  assert.equal(app.rotationInsertionIndex, 5);
  assert.deepEqual(app.rotationSelection, {
    anchorIndex: 3,
    startIndex: 3,
    endIndex: 5,
    awaitingEnd: false
  });
  assert.equal(changedCount, 2);
  assert.notEqual(app.build.rotation[1], app.rotationClipboard[0]);
  assert.notEqual(app.build.rotation[3], app.rotationClipboard[0]);
});

test('paste appends one loop when no cursor is armed', () => {
  let changedCount = 0;
  const app = {
    build: { rotation: [{ type: 'cast', skillId: 1 }] },
    rotationInsertionIndex: null,
    rotationSelection: null,
    rotationSelectionMode: false,
    rotationClipboard: [{ type: 'cast', skillId: 2 }],
    changed() {
      changedCount += 1;
    }
  };

  assert.equal(pasteRotationClipboard(app), true);
  assert.deepEqual(app.build.rotation, [
    { type: 'cast', skillId: 1 },
    { type: 'cast', skillId: 2 }
  ]);
  assert.equal(app.rotationInsertionIndex, null);
  assert.equal(changedCount, 1);
});
