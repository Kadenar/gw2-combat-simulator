import assert from 'node:assert/strict';
import test from 'node:test';
import {
  insertRotationEntries,
  moveRotationEntry,
  updateRotationEntry
} from '../../js/app/rotation/editing/operations.js';

test('rotation editing operations update, insert, and reject invalid moves', () => {
  assert.deepEqual(updateRotationEntry({ type: 'cast', skillId: 'One' }, { concurrentOffsetMs: 100 }), {
    type: 'cast',
    skillId: 'One',
    concurrentOffsetMs: 100
  });
  assert.deepEqual(
    updateRotationEntry(
      { type: 'cast', skillId: 'One', interruptAfterMs: 250 },
      {
        interruptAfterMs: undefined
      }
    ),
    { type: 'cast', skillId: 'One' }
  );

  const command = (skillId) => ({ type: 'cast', skillId });
  const rotation = [command('A'), command('B'), command('C')];

  assert.equal(moveRotationEntry(rotation, 0, 3), true);
  assert.deepEqual(rotation, [command('B'), command('C'), command('A')]);
  assert.equal(moveRotationEntry(rotation, 1, 2), false);
  assert.equal(moveRotationEntry(rotation, -1, 1), false);
  assert.equal(moveRotationEntry(rotation, 0, 1.5), false);
  assert.equal(insertRotationEntries(rotation, [command('D')], 1), true);
  assert.deepEqual(rotation, [command('B'), command('D'), command('C'), command('A')]);
  assert.equal(insertRotationEntries(rotation, [command('Macro A'), command('Macro B')], 2), true);
  assert.deepEqual(rotation, [
    command('B'),
    command('D'),
    command('Macro A'),
    command('Macro B'),
    command('C'),
    command('A')
  ]);
  assert.equal(insertRotationEntries(rotation, [], 0), false);
});
