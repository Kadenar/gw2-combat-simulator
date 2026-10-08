import assert from 'node:assert/strict';
import test from 'node:test';
import { rotationWarningItems } from '#gw2/app/rotation/warnings.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Repeated rejected inputs retain separate times through worker-safe results and use the timeline's combat marker.
test('rejection warnings carry timestamps and display on the combat-relative clock', () => {
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
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /Triple Bolt at 1\.000s:/);
  assert.match(result.warnings[1], /Triple Bolt at 4\.000s:/);
  const items = rotationWarningItems(structuredClone(result));
  assert.deepEqual(
    items.map((item) => item.time),
    ['-1.000s', '2.000s']
  );
  assert.ok(
    items.every((item) => item.message === 'Triple Bolt: Triple Bolt is unavailable — cast Shadow Bolt first.')
  );
  assert.deepEqual(runThief(rotation, config, { output: 'score' }).warnings, result.warnings);
});

// Static diagnostics have no occurrence time; timestamp extraction must leave their text intact.
test('untimed warnings remain readable and resolver diagnostics share the same clock', () => {
  assert.deepEqual(
    rotationWarningItems({
      events: [{ type: 'combat_start', at: 2 }],
      warnings: ['Configuration needs review.', 'No combo resolved at 3.250s; field is absent.']
    }),
    [
      { message: 'Configuration needs review.', time: '' },
      { message: 'No combo resolved; field is absent.', time: '1.250s' }
    ]
  );
});
