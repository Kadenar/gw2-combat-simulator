import assert from 'node:assert/strict';
import test from 'node:test';

import { weaponSetActiveSegments, weaponSetDurationTotals } from '#gw2/app/rotation/timeline/weapon-set-duration.js';

const SWAP_WEAPONS_ID = -1;

function step(ri, skillId, start, end = start, skill = String(skillId)) {
  return { ri, skillId, skill, start, end };
}

test('one usable weapon set owns the full timeline', () => {
  // No-swap professions retain the selected starting set even when a swap action is present.
  for (const startingWeaponSet of [1, 2]) {
    const steps = [step(0, SWAP_WEAPONS_ID, 2000, 2000)];
    const options = {
      startingWeaponSet,
      timelineEndMs: 10000,
      hasSecondWeaponSet: false,
      weaponSwapSkillIds: new Set([SWAP_WEAPONS_ID])
    };
    assert.deepEqual([...weaponSetDurationTotals(steps, options)], [[startingWeaponSet, 10000]]);
    assert.deepEqual(weaponSetActiveSegments(steps, options), [
      { weaponSet: startingWeaponSet, startMs: 0, endMs: 10000, durationMs: 10000 }
    ]);
  }
});

test('weapon duration closes W1 to W2 at swap completion and closes W2 at timeline end', () => {
  const totals = weaponSetDurationTotals([step(0, SWAP_WEAPONS_ID, 3500, 4000)], {
    startingWeaponSet: 1,
    timelineEndMs: 10000,
    hasSecondWeaponSet: true,
    weaponSwapSkillIds: new Set([SWAP_WEAPONS_ID])
  });

  assert.deepEqual(
    [...totals],
    [
      [1, 4000],
      [2, 6000]
    ]
  );
});

test('weapon duration sums W1 segments across W1 to W2 to W1', () => {
  const steps = [step(0, SWAP_WEAPONS_ID, 3000, 3000), step(1, SWAP_WEAPONS_ID, 7000, 7000)];
  const options = {
    startingWeaponSet: 1,
    timelineEndMs: 10000,
    hasSecondWeaponSet: true,
    weaponSwapSkillIds: new Set([SWAP_WEAPONS_ID])
  };
  const segments = weaponSetActiveSegments(steps, options);
  const totals = weaponSetDurationTotals(steps, options);

  // Repeated manifest rows show their own stay instead of repeating the per-set aggregate.
  assert.deepEqual(
    segments.map(({ weaponSet, durationMs }) => [weaponSet, durationMs]),
    [
      [1, 3000],
      [2, 4000],
      [1, 3000]
    ]
  );
  assert.deepEqual(
    [...totals],
    [
      [1, 6000],
      [2, 4000]
    ]
  );
});

test('weapon duration honors a manifest starting on W2', () => {
  const segments = weaponSetActiveSegments([step(0, SWAP_WEAPONS_ID, 2000, 2500)], {
    startingWeaponSet: 2,
    timelineEndMs: 8000,
    hasSecondWeaponSet: true,
    weaponSwapSkillIds: new Set([SWAP_WEAPONS_ID])
  });

  assert.deepEqual(
    segments.map(({ weaponSet, durationMs }) => [weaponSet, durationMs]),
    [
      [2, 2500],
      [1, 5500]
    ]
  );
});

test('kit and bundle bar changes do not split weapon-set duration', () => {
  const totals = weaponSetDurationTotals(
    [
      step(0, 111, 1000, 2000, 'Bomb Kit'),
      step(1, SWAP_WEAPONS_ID, 4500, 5000, 'Swap Weapons'),
      step(2, 222, 6000, 7000, 'Bundle')
    ],
    {
      startingWeaponSet: 1,
      timelineEndMs: 12000,
      hasSecondWeaponSet: true,
      weaponSwapSkillIds: new Set([SWAP_WEAPONS_ID])
    }
  );

  assert.deepEqual(
    [...totals],
    [
      [1, 5000],
      [2, 7000]
    ]
  );
});
