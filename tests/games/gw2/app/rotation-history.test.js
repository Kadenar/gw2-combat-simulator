/** Application commits publish once and keep command history independent of build configuration. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { commitBuildReplacement, commitRotationEdit } from '#gw2/app/rotation/editing/commit.js';

test('edits, replacements, and undo publish once while selection and rejected edits do not', () => {
  const changes = [];
  const app = {
    build: { rotation: [{ type: 'wait', durationMs: 100 }], gear: 'old' },
    changed(...args) {
      changes.push(args);
    }
  };
  commitRotationEdit(app, { type: 'select', index: 1 });
  commitRotationEdit(app, { type: 'move', from: 0, to: 1 });
  assert.equal(changes.length, 0);
  commitRotationEdit(app, { type: 'insert', entries: [{ type: 'wait', durationMs: 200 }] });
  assert.equal(changes.length, 1);
  commitBuildReplacement(app, { rotation: [{ type: 'wait', durationMs: 300 }], gear: 'new' });
  assert.equal(changes.length, 2);
  assert.equal(changes[1][0], true);
  commitRotationEdit(app, { type: 'undo' });
  assert.deepEqual(app.build.rotation, [
    { type: 'wait', durationMs: 100 },
    { type: 'wait', durationMs: 200 }
  ]);
  assert.equal(app.build.gear, 'new');
  commitRotationEdit(app, { type: 'redo' });
  assert.deepEqual(app.build.rotation, [{ type: 'wait', durationMs: 300 }]);
  assert.equal(changes.length, 4);
  const history = app._rotationHistory;
  commitBuildReplacement(app, { ...app.build, gear: 'other' });
  assert.equal(changes.length, 5);
  assert.equal(app._rotationHistory, history);
  commitRotationEdit(app, { type: 'replace', rotation: app.build.rotation }, { rebuildStatic: true });
  assert.equal(changes.length, 6);
  assert.equal(app._rotationHistory, history);
});

// Supplying repaint options must not accidentally turn a build replacement into a rotation-only refresh.
test('replacement notifications default build refresh independently of other options', () => {
  const calls = [];
  const app = {
    build: { rotation: [] },
    changed(...args) {
      calls.push(args);
    }
  };
  const options = { deferRotationRender: true };
  commitBuildReplacement(app, { rotation: [] }, { options });
  commitBuildReplacement(app, { rotation: [] }, { options, rebuildStatic: false });
  assert.deepEqual(calls, [
    [true, true, options],
    [false, false, options]
  ]);
});

test('moving identical commands clears the cursor without adding history or recalculating', () => {
  let changes = 0;
  const selections = [];
  const app = {
    build: {
      rotation: [
        { type: 'wait', durationMs: 100 },
        { type: 'wait', durationMs: 100 }
      ]
    },
    rotationInsertionIndex: 1,
    changed() {
      changes++;
    },
    selectRotationInsertion(index) {
      selections.push(index);
    }
  };
  assert.equal(commitRotationEdit(app, { type: 'move', from: 0, to: 2 }), true);
  assert.equal(app.rotationInsertionIndex, null);
  assert.deepEqual(selections, [null]);
  assert.equal(changes, 0);
  assert.equal(app._rotationHistory.undo.length, 0);
});
