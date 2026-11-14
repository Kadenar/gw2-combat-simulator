import assert from 'node:assert/strict';
import test from 'node:test';

import { optimizerDpsSnapshots } from '#gw2/app/optimizer/gear/checkpoints.js';
import { createHealthCheckpointRecorder } from '#gw2/platform/results/health-checkpoints.js';

import { targetHealthBandDps } from '../../scripts/analysis/health-band-dps.mjs';

const phases = (values) => Object.fromEntries(Object.entries(values).map(([band, metrics]) => [band, metrics.phase]));
const cumulative = (values) =>
  Object.fromEntries(Object.entries(values).map(([band, metrics]) => [band, metrics.cumulative]));

const empty = { '100-80': null, '80-60': null, '60-40': null, '40-20': null, '20-0': null };

// Whole crossing hits, simultaneous payouts, and environment damage must produce the same cumulative DPS in every view.
test('optimizer snapshots match Analysis benchmark cumulative DPS without changing effective final damage', () => {
  const recorder = createHealthCheckpointRecorder({ target: { health: 1000 } });
  const payouts = [
    [1, 100, 0],
    [2, 150, 0],
    [2, 25, 0],
    [3, 0, 100],
    [4, 250, 0],
    [5, 200, 0],
    [6, 300, 0]
  ];
  let player = 0;
  let environment = 0;
  for (const [at, playerDamage, environmentDamage] of payouts) {
    player += playerDamage;
    environment += environmentDamage;
    recorder.observe(at, player, environment);
  }

  const progress = recorder.finish();
  const result = {
    dpsStartTime: 1,
    dpsWindow: 5,
    deathTime: 6,
    totalDamage: player,
    effectiveDamage: progress.effectiveDamage,
    healthCheckpoints: progress.checkpoints,
    resolvedEvents: payouts.filter(([, damage]) => damage > 0).map(([at, damage]) => ({ type: 'damage', at, damage })),
    environmentConditionBreakdown: [{ damageTicks: [{ at: 3, damage: 100 }] }]
  };
  assert.equal(result.effectiveDamage, 900);
  assert.equal(result.healthCheckpoints[0].playerDamage, 275);
  const optimizer = optimizerDpsSnapshots(result).map((row) => row.cumulativeDps);
  assert.deepEqual(optimizer, Object.values(cumulative(targetHealthBandDps(result, 1000))).slice(0, 4));
});

// Minimal damage histories verify phase-local damage and elapsed time, independently of skill packet schedules.
test('health-band DPS reports both cumulative and phase-local averages', () => {
  const result = {
    dpsStartTime: 10,
    deathTime: 24,
    totalDamage: 1000,
    resolvedEvents: [12, 16, 18, 22, 24].map((at) => ({ type: 'damage', at, damage: 200 }))
  };
  assert.deepEqual(phases(targetHealthBandDps(result, 1000)), {
    '100-80': 100,
    '80-60': 50,
    '60-40': 100,
    '40-20': 50,
    '20-0': 100
  });
  assert.deepEqual(cumulative(targetHealthBandDps(result, 1000)), {
    '100-80': 100,
    '80-60': 400 / 6,
    '60-40': 75,
    '40-20': 800 / 12,
    '20-0': 1000 / 14
  });
  assert.deepEqual(targetHealthBandDps({ ...result, deathTime: null, dps: 72 }, 1000)['20-0'], {
    cumulative: 72,
    phase: 72
  });
  assert.deepEqual(phases(targetHealthBandDps(result, 0)), empty);
});

test('environment damage advances health while only player strikes and condition ticks contribute to band DPS', () => {
  const result = {
    dpsStartTime: 0,
    deathTime: null,
    totalDamage: 300,
    resolvedEvents: [
      { type: 'condition', damage: 100, damageTicks: [{ at: 2, damage: 100 }] },
      { type: 'damage', at: 4, damage: 200 }
    ],
    environmentConditionBreakdown: [{ damageTicks: [{ at: 2, damage: 100 }] }]
  };
  assert.deepEqual(phases(targetHealthBandDps(result, 1000)), { ...empty, '100-80': 50, '80-60': 100 });
  assert.deepEqual(cumulative(targetHealthBandDps(result, 1000)), { ...empty, '100-80': 50, '80-60': 75 });
});

test('unreached, skipped-start, and zero-duration bands remain unavailable', () => {
  const result = {
    dpsStartTime: 0,
    deathTime: 6,
    totalDamage: 600,
    resolvedEvents: [2, 4, 6].map((at) => ({ type: 'damage', at, damage: 200 }))
  };
  assert.deepEqual(phases(targetHealthBandDps(result, 1000, 60)), {
    ...empty,
    '60-40': 100,
    '40-20': 100,
    '20-0': 100
  });
  const burst = {
    dpsStartTime: 0,
    deathTime: null,
    totalDamage: 800,
    resolvedEvents: [
      { type: 'damage', at: 1, damage: 600 },
      { type: 'damage', at: 2, damage: 200 }
    ]
  };
  assert.deepEqual(phases(targetHealthBandDps(burst, 1000)), { ...empty, '100-80': 600, '40-20': 200 });
  assert.deepEqual(targetHealthBandDps(burst, 1000)['80-60'], { cumulative: 600, phase: null });
});

// A simulation end is a useful final comparison even when the target survived above its last health band.
test('non-killing runs use final overall DPS for both final-band measurements', () => {
  const result = {
    dpsStartTime: 0,
    deathTime: null,
    totalDamage: 200,
    dps: 25,
    resolvedEvents: [{ type: 'damage', at: 2, damage: 200 }]
  };
  const metrics = targetHealthBandDps(result, 1000);
  assert.deepEqual(metrics['20-0'], { cumulative: 25, phase: 25 });
  assert.deepEqual(metrics['80-60'], { cumulative: null, phase: null });
  assert.deepEqual(targetHealthBandDps({ ...result, dps: 0 }, 1000)['20-0'], { cumulative: 0, phase: 0 });
});
