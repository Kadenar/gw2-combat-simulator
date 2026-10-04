import assert from 'node:assert/strict';
import test from 'node:test';
import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';

// Pending intent follows command progression without reserving a lane, changing readiness, or exposing command controls.
test('charge release intent describes only the current delayed cast and is detached', () => {
  const commands = [
    { type: 'wait', durationMs: 50 },
    { type: 'combat-start' },
    { type: 'cooldown-reset' },
    { type: 'cast', skillId: 1 },
    { type: 'cast', skillId: 1, releaseDelayMs: 0 },
    { type: 'cast', skillId: 2, releaseAtCharges: 3, releaseDelayMs: 500, offTarget: true },
    { type: 'cast', skillId: 3, releaseDelayMs: 100 }
  ];
  const cursor = new RotationCursor(commands);
  for (let index = 0; index < 5; index++) {
    assert.equal(cursor.pendingChargeRelease(), undefined);
    cursor.consume();
  }

  const intent = cursor.pendingChargeRelease();
  assert.deepEqual(intent, { skillId: 2, charges: 3 });
  assert.equal(Object.isFrozen(intent), true);
  assert.equal(cursor.command, commands[5]);
  assert.equal(cursor.index, 5);
  assert.equal(cursor.endTime(), 0);
  cursor.consume();
  assert.deepEqual(cursor.pendingChargeRelease(), { skillId: 3, charges: undefined });
  assert.deepEqual(intent, { skillId: 2, charges: 3 });
  cursor.consume();
  assert.equal(cursor.pendingChargeRelease(), undefined);
});
