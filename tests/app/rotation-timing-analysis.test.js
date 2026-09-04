import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { formatTimelineTime } from '#gw2/app/rotation/result/model.js';
import {
  skillTimingAnalyses,
  stateTimingAnalysis,
  weaponSetActiveSegments,
  weaponSetDurationTotals
} from '#gw2/app/rotation/timeline/model.js';
import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';

const FIRE_BOMB_ID = 5823;
const SHRAPNEL_GRENADE_ID = 5807;
const SWAP_WEAPONS_ID = -1;

function step(ri, skillId, start, end = start, skill = String(skillId)) {
  return { ri, skillId, skill, start, end };
}

test('interleaved timing checks remain independent and preserve negative precast starts', () => {
  const analyses = skillTimingAnalyses(
    [FIRE_BOMB_ID, SHRAPNEL_GRENADE_ID],
    [
      step(0, FIRE_BOMB_ID, -1120, -1120, 'Fire Bomb'),
      step(1, SHRAPNEL_GRENADE_ID, 1040, 1040, 'Shrapnel Grenade'),
      step(2, SHRAPNEL_GRENADE_ID, 6280, 6280, 'Shrapnel Grenade'),
      step(3, FIRE_BOMB_ID, 6960, 6960, 'Fire Bomb'),
      step(4, SHRAPNEL_GRENADE_ID, 12800, 12800, 'Shrapnel Grenade'),
      step(5, FIRE_BOMB_ID, 14960, 14960, 'Fire Bomb')
    ]
  );
  const [fireBomb, shrapnelGrenade] = analyses;

  assert.deepEqual(
    fireBomb.occurrences.map(({ startMs, intervalMs }) => [startMs, intervalMs]),
    [
      [-1120, null],
      [6960, 8080],
      [14960, 8000]
    ]
  );
  assert.deepEqual(
    shrapnelGrenade.occurrences.map(({ startMs, intervalMs }) => [startMs, intervalMs]),
    [
      [1040, null],
      [6280, 5240],
      [12800, 6520]
    ]
  );
  assert.equal(fireBomb.averageIntervalMs, 8040);
  assert.equal(fireBomb.fastestIntervalMs, 8000);
  assert.equal(fireBomb.slowestIntervalMs, 8080);
  assert.equal(shrapnelGrenade.averageIntervalMs, 5880);
  assert.equal(shrapnelGrenade.fastestIntervalMs, 5240);
  assert.equal(shrapnelGrenade.slowestIntervalMs, 6520);
  assert.equal(formatTimelineTime(fireBomb.occurrences[0].startMs, 0, 3), '-1.120s');
  assert.deepEqual(
    fireBomb.occurrences.slice(1).map(({ intervalMs }) => formatTimelineTime(intervalMs, 0, 3)),
    ['8.080s', '8.000s']
  );
  assert.deepEqual(
    shrapnelGrenade.occurrences.slice(1).map(({ intervalMs }) => formatTimelineTime(intervalMs, 0, 3)),
    ['5.240s', '6.520s']
  );
});

test('timing summaries handle zero, one, and multiple stable-ID uses', () => {
  const [zero, one, multiple] = skillTimingAnalyses(
    [10, 20, 30],
    [
      step(0, 20, 250, 250, 'Same display name'),
      step(1, 30, 1000, 1000, 'Same display name'),
      step(2, 99, 2500, 2500, 'Same display name'),
      step(3, 30, 4000, 4000, 'Same display name'),
      { ...step(4, 30, 9000), invalid: true }
    ]
  );

  assert.deepEqual(
    [zero, one].map((analysis) => [
      analysis.useCount,
      analysis.averageIntervalMs,
      analysis.fastestIntervalMs,
      analysis.slowestIntervalMs
    ]),
    [
      [0, null, null, null],
      [1, null, null, null]
    ]
  );
  assert.equal(multiple.useCount, 2);
  assert.deepEqual(
    multiple.occurrences.map(({ intervalMs }) => intervalMs),
    [null, 3000]
  );
  assert.equal(multiple.averageIntervalMs, 3000);
  assert.equal(multiple.fastestIntervalMs, 3000);
  assert.equal(multiple.slowestIntervalMs, 3000);
});

test('one usable weapon set owns the full timeline', () => {
  const totals = weaponSetDurationTotals([step(0, SWAP_WEAPONS_ID, 2000, 2000)], {
    startingWeaponSet: 1,
    timelineEndMs: 10000,
    hasSecondWeaponSet: false,
    weaponSwapSkillIds: new Set([SWAP_WEAPONS_ID])
  });

  assert.deepEqual([...totals], [[1, 10000]]);
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

test('loaded manifest rotations keep repeated weapon stays independent', async () => {
  const repoUrl = (path) => new URL(`../../${path}`, import.meta.url);
  const manifest = JSON.parse(await readFile(repoUrl('data/gw2/builds/guardian/manifest.json'), 'utf8'));
  const preset = manifest
    .flatMap((section) => section.presets)
    .find((candidate) => candidate.build.endsWith('/b-power-willbender-spear-greatsword.json'));
  const [savedBuild, savedRotation, adapter] = await Promise.all([
    readFile(repoUrl(preset.build), 'utf8').then(JSON.parse),
    readFile(repoUrl(preset.rotation), 'utf8').then(JSON.parse),
    loadProfessionAppAdapter('guardian')
  ]);
  const build = adapter.toApplicationBuild({ ...savedBuild, rotation: savedRotation.rotation });
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1
  };
  adapter.recalculate(app);
  const result = adapter.simulateBuild(build.rotation, adapter.simulationConfig(app));
  const swapId = adapter.profession.catalog.skillsByName.get('Swap Weapons').id;
  const segments = weaponSetActiveSegments(result.steps, {
    startingWeaponSet: build.startingWeaponSet,
    timelineEndMs: result.duration * 1000,
    hasSecondWeaponSet: true,
    weaponSwapSkillIds: new Set([swapId])
  });

  assert.equal(build.startingWeaponSet, 2);
  assert.equal(segments[0].weaponSet, 2);
  assert.ok(segments.some((segment, index) => index > 0 && segment.weaponSet === segments[0].weaponSet));
  assert.equal(
    segments.reduce((total, segment) => total + segment.durationMs, 0),
    result.duration * 1000
  );
  assert.ok(
    result.steps
      .filter((candidate) => candidate.skill === 'Swap Weapons')
      .every((candidate) => candidate.skillId === swapId)
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

test('state timing pairs independent stays, ignores duplicate snapshots, and closes the final stay', () => {
  const analysis = stateTimingAnalysis(
    [
      { atMs: -1120, active: true },
      { atMs: 400, active: true },
      { atMs: 6960, active: false },
      { atMs: 14960, active: true }
    ],
    23000
  );

  assert.deepEqual(analysis.occurrences, [
    { startMs: -1120, endMs: 6960, durationMs: 8080, endedAtTimelineEnd: false },
    { startMs: 14960, endMs: 23000, durationMs: 8040, endedAtTimelineEnd: true }
  ]);
  assert.equal(analysis.useCount, 2);
  assert.equal(analysis.averageDurationMs, 8060);
  assert.equal(analysis.shortestDurationMs, 8040);
  assert.equal(analysis.longestDurationMs, 8080);
});

test('state timing handles no stays and a single completed stay cleanly', () => {
  const empty = stateTimingAnalysis([{ atMs: 1000, active: false }], 5000);
  const single = stateTimingAnalysis(
    [
      { atMs: 1000, active: true },
      { atMs: 3250, active: false }
    ],
    5000
  );

  assert.deepEqual(
    [empty.useCount, empty.averageDurationMs, empty.shortestDurationMs, empty.longestDurationMs],
    [0, null, null, null]
  );
  assert.deepEqual(single.occurrences, [{ startMs: 1000, endMs: 3250, durationMs: 2250, endedAtTimelineEnd: false }]);
});
