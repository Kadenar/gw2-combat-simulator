import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeRotation } from '#gw2/platform/builds/rotation.js';
import { testProfession } from '#tests/fixtures/profession.js';

// Names are input convenience only: ambiguous labels cannot silently choose a different canonical skill.
test('rotation decoding resolves unique names and requires IDs for duplicate labels', () => {
  const catalog = {
    skillsById: new Map([
      [1, { id: 1, name: 'Unique' }],
      [2, { id: 2, name: 'Variant' }],
      ['variant.other', { id: 'variant.other', name: 'Variant' }]
    ])
  };
  assert.deepEqual(normalizeRotation(['Unique'], catalog, { strict: true }), [{ type: 'cast', skillId: 1 }]);
  assert.throws(
    () => normalizeRotation(['Variant'], catalog, { strict: true }),
    /Ambiguous skill name.*supply skillId/
  );
  assert.deepEqual(
    normalizeRotation([{ type: 'cast', skillId: 'variant.other', name: 'Variant' }], catalog, { strict: true }),
    [{ type: 'cast', skillId: 'variant.other' }]
  );
  assert.deepEqual(normalizeRotation(['Unique', 'Variant', 'Unknown', 'Unique'], catalog), [
    { type: 'cast', skillId: 1 },
    { type: 'cast', skillId: 'Unknown' },
    { type: 'cast', skillId: 1 }
  ]);
  // Each import resolves against its supplied catalog, even after the same label was previously indexed.
  const otherCatalog = { skillsById: new Map([[3, { id: 3, name: 'Unique' }]]) };
  assert.deepEqual(normalizeRotation(['Unique'], otherCatalog, { strict: true }), [{ type: 'cast', skillId: 3 }]);
});

// Rotation normalization preserves command intent while validating legacy cast options.
test('normalized commands migrate legacy cast options', () => {
  assert.deepEqual(
    normalizeRotation(
      [
        900001,
        { name: '__wait', waitMs: 250 },
        {
          skillId: 900002,
          offset: 100,
          interruptMs: 50,
          offTarget: true,
          releaseAtCharges: 3,
          doubleEdgeOutcome: 'backfire'
        },
        { type: 'cooldown-reset' },
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
    () => normalizeRotation([{ skillId: 900002, releaseAtCharges: 0 }], testProfession.catalog, { strict: true }),
    /positive whole number/
  );
  assert.throws(
    () =>
      normalizeRotation([{ skillId: 900002, doubleEdgeOutcome: 'random' }], testProfession.catalog, {
        strict: true
      }),
    /either success or backfire/
  );
  assert.throws(
    () => normalizeRotation([{ skillId: 900002, offTarget: 'yes' }], testProfession.catalog, { strict: true }),
    /Off-target cast must be a boolean/
  );
});

// A delayed impact is kept only when it moves packets; it cannot combine with a cast that never lands.
test('normalized casts keep positive impact delays and reject contradictory targeting', () => {
  assert.deepEqual(
    normalizeRotation(
      [
        { skillId: 900001, impactDelayMs: 1500 },
        { skillId: 900001, impactDelayMs: 0 }
      ],
      testProfession.catalog
    ),
    [
      { type: 'cast', skillId: 900001, impactDelayMs: 1500 },
      { type: 'cast', skillId: 900001 }
    ]
  );
  assert.throws(
    () => normalizeRotation([{ skillId: 900001, impactDelayMs: -1 }], testProfession.catalog, { strict: true }),
    /Impact delay must be a non-negative number/
  );
  assert.throws(
    () =>
      normalizeRotation([{ skillId: 900001, offTarget: true, impactDelayMs: 500 }], testProfession.catalog, {
        strict: true
      }),
    /off-target casts cannot contain impactDelayMs/
  );
});

test('normalized commands preserve signed combat-start offsets', () => {
  assert.deepEqual(
    normalizeRotation([900001, { type: 'combat-start', concurrentOffsetMs: 100 }], testProfession.catalog),
    [
      { type: 'cast', skillId: 900001 },
      { type: 'combat-start', concurrentOffsetMs: 100 }
    ]
  );
  assert.deepEqual(normalizeRotation([900001, { name: '__combat_start', offset: -440 }], testProfession.catalog), [
    { type: 'cast', skillId: 900001 },
    { type: 'combat-start', concurrentOffsetMs: -440 }
  ]);
});
