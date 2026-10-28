import assert from 'node:assert/strict';
import test from 'node:test';

import { rotationWarningItems } from '#gw2/app/rotation/warnings.js';
import { locateDiagnostics } from '#gw2/platform/results/diagnostics.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Repeated rejected inputs retain separate times through worker-safe results and use the timeline's combat marker.
test('rejection diagnostics carry their time and authored input onto the combat-relative clock', () => {
  const rotation = [
    { type: 'wait', durationMs: 1000 },
    'Triple Bolt',
    { type: 'wait', durationMs: 1000 },
    { type: 'combat-start' },
    { type: 'wait', durationMs: 2000 },
    'Triple Bolt'
  ];
  const config = { primaryWeapon: 'Scepter', secondaryWeapon: 'Dagger' };
  const result = runThief(rotation, config);
  assert.deepEqual(
    result.warnings.map(({ at, rotationIndex }) => [at, rotationIndex]),
    [
      [1, 1],
      [4, 5]
    ]
  );
  const items = rotationWarningItems(structuredClone(result));
  assert.deepEqual(
    items.map((item) => item.time),
    ['-1.000s', '2.000s']
  );
  assert.deepEqual(
    items.map((item) => item.rotationIndex),
    [1, 5]
  );
  assert.ok(
    items.every((item) => item.message === 'Triple Bolt: Triple Bolt is unavailable — cast Shadow Bolt first.')
  );
  assert.deepEqual(runThief(rotation, config, { output: 'score' }).warnings, result.warnings);
});

// The result deduplicates identical equal-time diagnostics; their link should reveal the first affected input.
test('deduplicated simultaneous rejections navigate to the first affected step', () => {
  const result = runThief(['Triple Bolt', 'Triple Bolt'], {
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Dagger'
  });
  assert.deepEqual(
    rotationWarningItems(structuredClone(result)).map((item) => item.rotationIndex),
    [0]
  );
});

// A delayed diagnostic belongs to its originating activation, even after another cast has started, whatever its wording.
test('activation-owned diagnostics locate their authored step and leave unreported activations unlinked', () => {
  const steps = [
    { ri: 0, skill: 'Finisher', start: 0, end: 1000, activationId: 'first' },
    { ri: 1, skill: 'Finisher', start: 2000, end: 3000, activationId: 'second' },
    { ri: -1, skill: 'Companion', start: 0, end: 500, activationId: 'companion' }
  ];
  const located = locateDiagnostics(
    [
      { message: 'Fire combo field is not active for Finisher; no combo resolved.', at: 3, activationId: 'first' },
      { message: 'Reworded notice for the same activation.', at: 3, activationId: 'first' },
      { message: 'Companion notice.', at: 0.5, activationId: 'companion' },
      { message: 'Unreported activation.', at: 1, activationId: 'missing' }
    ],
    steps
  );
  assert.deepEqual(
    located.map((diagnostic) => diagnostic.rotationIndex),
    [0, 0, undefined, undefined]
  );
});

// Static diagnostics have no occurrence time; timed resolver diagnostics share the rotation clock.
test('untimed warnings remain readable and resolver diagnostics share the same clock', () => {
  assert.deepEqual(
    rotationWarningItems({
      events: [{ type: 'combat_start', at: 2 }],
      warnings: [
        { message: 'Configuration needs review.' },
        { message: 'No combo resolved; field is absent.', at: 3.25 }
      ]
    }),
    [
      { message: 'Configuration needs review.', time: '' },
      { message: 'No combo resolved; field is absent.', time: '1.250s' }
    ]
  );
});
