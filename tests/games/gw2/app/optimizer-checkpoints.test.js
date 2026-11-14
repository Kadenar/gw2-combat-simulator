/** Ranking uses capped final damage rather than the size of a killing packet. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { optimizerDpsSnapshots, optimizerEffectiveDps } from '#gw2/app/optimizer/gear/checkpoints.js';
import { compareOptimizerCandidates } from '#gw2/app/optimizer/gear/search.js';

const result = {
  effectiveDamage: 900,
  dpsStartTime: 2,
  dpsWindow: 10,
  healthCheckpoints: [
    { healthPercent: 80, at: 4, playerDamage: 180 },
    { healthPercent: 60, at: 7, playerDamage: 360 },
    { healthPercent: 40, at: 8, playerDamage: 540 },
    { healthPercent: 20, at: 10, playerDamage: 720 }
  ]
};

test('snapshots report cumulative DPS and actual elapsed time', () => {
  const rows = optimizerDpsSnapshots(result);
  assert.equal(optimizerEffectiveDps(result), 90);
  assert.equal(optimizerEffectiveDps({ ...result, dpsWindow: 0 }), 0);
  assert.deepEqual(rows[1], {
    label: '80-60%',
    reached: true,
    elapsed: 5,
    damage: 360,
    cumulativeDps: 72
  });
  assert.equal(rows.length, 4);
  assert.equal(rows[3].cumulativeDps, 90);
});

test('unreached, skipped, and simultaneous checkpoints never borrow final DPS or divide by zero', () => {
  const partial = {
    ...result,
    healthCheckpoints: [{ healthPercent: 60, at: 2, playerDamage: 100 }]
  };
  const rows = optimizerDpsSnapshots(partial);
  assert.equal(rows[0].reached, false);
  assert.equal(rows[1].reached, true);
  assert.equal(rows[1].cumulativeDps, null);
  assert.equal(rows[3].reached, false);
});

test('rankings reward final effective DPS rather than overkill', () => {
  const candidate = (key, dps, rankingDps) => ({ key, score: { dps, rankingDps } });
  const earlierKill = candidate('early', 100, 95);
  const largerOverkill = candidate('late', 150, 90);
  assert.deepEqual([largerOverkill, earlierKill].sort(compareOptimizerCandidates), [earlierKill, largerOverkill]);
});
