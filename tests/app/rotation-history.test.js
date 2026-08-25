import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canRedoRotation,
  canUndoRotation,
  recordRotationHistory,
  redoRotation,
  undoRotation
} from '../../js/app/rotation/editing/history.js';

test('undo and redo defer repainting until their matching simulation result', () => {
  const initial = [{ type: 'cast', skillId: 1 }];
  const changed = [{ type: 'cast', skillId: 2 }];
  const changeCalls = [];
  const app = {
    build: { rotation: initial },
    changed(...args) {
      changeCalls.push(args);
    }
  };

  recordRotationHistory(app);
  app.build.rotation = changed;
  recordRotationHistory(app);

  assert.equal(canUndoRotation(app), true);
  undoRotation(app);
  assert.deepEqual(app.build.rotation, initial);
  assert.notEqual(app.build.rotation, initial);
  assert.equal(canRedoRotation(app), true);

  redoRotation(app);
  assert.deepEqual(app.build.rotation, changed);
  assert.notEqual(app.build.rotation, changed);
  assert.deepEqual(changeCalls, [
    [false, false, { deferRotationRender: true }],
    [false, false, { deferRotationRender: true }]
  ]);
});
