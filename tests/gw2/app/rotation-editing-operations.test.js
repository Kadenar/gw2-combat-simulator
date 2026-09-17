import assert from 'node:assert/strict';
import test from 'node:test';
import { insertRotationEntries, moveRotationEntry, updateRotationEntry } from '#gw2/app/rotation/editing/operations.js';

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

test('rotation drag reordering respects before and after insertion positions', () => {
  const command = (skillId) => ({ type: 'cast', skillId });
  const rotation = [command('Bladecall'), command('Mirror Blade'), command('Mind Spike')];

  assert.equal(moveRotationEntry(rotation, 0, 2), true);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);

  assert.equal(moveRotationEntry(rotation, 2, 0), true);
  assert.deepEqual(rotation, [command('Mind Spike'), command('Mirror Blade'), command('Bladecall')]);

  assert.equal(moveRotationEntry(rotation, 0, rotation.length), true);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);

  assert.equal(moveRotationEntry(rotation, 1, 2), false);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);
});
