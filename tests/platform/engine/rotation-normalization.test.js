import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { testProfession } from '../../fixtures/test-profession.js';

// Rotation normalization preserves command intent while validating legacy cast options.
test('normalized commands migrate legacy cast options', () => {
  assert.deepEqual(
    normalizeRotation(
      [
        'Fixture Slash',
        { name: '__wait', waitMs: 250 },
        {
          name: 'Fixture Charge',
          offset: 100,
          interruptMs: 50,
          offTarget: true,
          releaseAtCharges: 3,
          doubleEdgeOutcome: 'backfire'
        },
        '__cooldown_reset',
        '__combat_start'
      ],
      testProfession.catalog
    ),
    [
      { type: 'cast', skillId: 900001 },
      { type: 'wait', durationMs: 250 },
      {
        type: 'cast',
        skillId: 900002,
        offTarget: true,
        concurrentOffsetMs: 100,
        interruptAfterMs: 50,
        releaseAtCharges: 3,
        doubleEdgeOutcome: 'backfire'
      },
      { type: 'cooldown-reset' },
      { type: 'combat-start' }
    ]
  );
  assert.throws(
    () =>
      normalizeRotation([{ name: 'Fixture Charge', releaseAtCharges: 0 }], testProfession.catalog, { strict: true }),
    /positive whole number/
  );
  assert.throws(
    () =>
      normalizeRotation([{ name: 'Fixture Charge', doubleEdgeOutcome: 'random' }], testProfession.catalog, {
        strict: true
      }),
    /either success or backfire/
  );
  assert.throws(
    () => normalizeRotation([{ name: 'Fixture Charge', offTarget: 'yes' }], testProfession.catalog, { strict: true }),
    /Off-target cast must be a boolean/
  );
});

test('normalized commands preserve signed combat-start offsets', () => {
  assert.deepEqual(
    normalizeRotation(['Fixture Slash', { name: '__combat_start', offset: 100 }], testProfession.catalog),
    [
      { type: 'cast', skillId: 900001 },
      { type: 'combat-start', concurrentOffsetMs: 100 }
    ]
  );
  assert.deepEqual(
    normalizeRotation(['Fixture Slash', { name: '__combat_start', offset: -440 }], testProfession.catalog),
    [
      { type: 'cast', skillId: 900001 },
      { type: 'combat-start', concurrentOffsetMs: -440 }
    ]
  );
});
