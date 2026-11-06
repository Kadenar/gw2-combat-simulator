/** Exercises complete authoring transitions without application state or a browser. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { editRotation } from '#gw2/app/rotation/editing/session.js';
import { emptyRotationEditingSession } from '#gw2/app/rotation/editing/state.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
function editor(initial = []) {
  let rotation = initial;
  let session = emptyRotationEditingSession();
  return {
    get rotation() {
      return rotation;
    },
    get session() {
      return session;
    },
    apply(edit) {
      const result = editRotation(rotation, session, edit);

      if (result) ({ rotation, session } = result);

      return result;
    }
  };
}

test('palette batches advance the cursor and undo as one isolated edit', () => {
  const initial = [wait(100), wait(400)];
  const e = editor(initial);
  e.apply({ type: 'select', index: 1 });
  const batch = [wait(200), wait(300)];
  e.apply({ type: 'insert', entries: batch });
  batch[0].durationMs = 900;
  assert.deepEqual(e.rotation, [wait(100), wait(200), wait(300), wait(400)]);
  assert.deepEqual(initial, [wait(100), wait(400)]);
  assert.equal(e.session.rotationInsertionIndex, 3);
  assert.equal(e.session._rotationHistory.undo.length, 1);
  e.apply({ type: 'undo' });
  assert.deepEqual(e.rotation, initial);
  assert.equal(e.session.rotationInsertionIndex, null);
  e.apply({ type: 'redo' });
  assert.deepEqual(e.rotation, [wait(100), wait(200), wait(300), wait(400)]);
});

test('drop, move, remove, and truncate own cursor clearing and reject invalid edits atomically', () => {
  const e = editor([wait(100), wait(200), wait(300)]);
  e.apply({ type: 'select', index: 1 });
  for (const edit of [
    { type: 'move', from: 1, to: 2 },
    { type: 'move', from: -1, to: 2 },
    { type: 'move', from: 0, to: 1.5 },
    { type: 'drop', index: 1, entries: [] },
    { type: 'drop', index: 0.5, entries: [wait(1)] },
    { type: 'remove', index: 3 },
    { type: 'truncate', index: -1 },
    { type: 'update', index: 3, changes: { durationMs: 1 } }
  ]) {
    const before = { rotation: e.rotation, session: e.session };
    assert.equal(e.apply(edit), null);
    assert.equal(e.rotation, before.rotation);
    assert.equal(e.session, before.session);
  }

  e.apply({ type: 'drop', index: 1, entries: [wait(150)] });
  assert.deepEqual(e.rotation, [wait(100), wait(150), wait(200), wait(300)]);
  assert.equal(e.session.rotationInsertionIndex, null);
  for (const [edit, expected] of [
    [{ type: 'move', from: 0, to: 3 }, [wait(150), wait(200), wait(100), wait(300)]],
    [{ type: 'move', from: 3, to: 0 }, [wait(300), wait(150), wait(200), wait(100)]],
    [{ type: 'remove', index: 1 }, [wait(300), wait(200), wait(100)]],
    [{ type: 'truncate', index: 2 }, [wait(300), wait(200)]]
  ]) {
    e.apply({ type: 'select', index: 1 });
    e.apply(edit);
    assert.deepEqual(e.rotation, expected);
    assert.equal(e.session.rotationInsertionIndex, null);
  }
});

test('command patches clear optional settings without changing identity or history on equal updates', () => {
  const original = { type: 'cast', skillId: 7, offTarget: true, impactDelayMs: 200 };
  const e = editor([original]);
  e.apply({ type: 'select', index: 1 });
  assert.equal(e.apply({ type: 'update', index: 0, changes: { offTarget: true } }).commandsChanged, false);
  assert.equal(e.session._rotationHistory.undo.length, 0);
  e.apply({ type: 'update', index: 0, changes: { offTarget: undefined } });
  assert.deepEqual(e.rotation, [{ type: 'cast', skillId: 7, impactDelayMs: 200 }]);
  assert.equal(e.session.rotationInsertionIndex, 1);
  assert.equal(original.offTarget, true);
  e.apply({ type: 'undo' });
  assert.deepEqual(e.rotation, [original]);
  e.apply({ type: 'update', index: 0, changes: { impactDelayMs: undefined } });
  assert.equal(e.apply({ type: 'redo' }), null);
});

test('replacement is undoable, reset starts fresh, and history is bounded', () => {
  const e = editor([wait(100), wait(200)]);
  e.apply({ type: 'select', index: 1 });
  e.apply({ type: 'replace', rotation: [wait(300)] });
  assert.equal(e.session.rotationInsertionIndex, 1);
  e.apply({ type: 'undo' });
  assert.deepEqual(e.rotation, [wait(100), wait(200)]);
  e.apply({ type: 'reset', rotation: [wait(500)] });
  assert.equal(e.apply({ type: 'undo' }), null);
  assert.equal(e.apply({ type: 'redo' }), null);
  for (let value = 1; value <= 105; value++) e.apply({ type: 'replace', rotation: [wait(value)] });
  assert.equal(e.session._rotationHistory.undo.length, 100);
  for (let count = 0; count < 100; count++) assert.ok(e.apply({ type: 'undo' }));
  assert.deepEqual(e.rotation, [wait(5)]);
  assert.equal(e.apply({ type: 'undo' }), null);
  e.apply({ type: 'clear' });
  assert.equal(e.session.rotationInsertionIndex, null);
});
