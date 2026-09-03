import assert from 'node:assert/strict';
import test from 'node:test';

import { constantName, mapConcurrent } from '../../scripts/data/lib/generator-utils.mjs';

test('generator helpers normalize names and preserve order across concurrent work', async () => {
  assert.equal(constantName('Dragon Slash\u2014Force\u2019s 2'), 'DRAGON_SLASH_FORCES_2');

  let active = 0;
  let peak = 0;
  const result = await mapConcurrent([30, 5, 15], 2, async (delay) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, delay));
    active -= 1;
    return delay;
  });

  assert.deepEqual(result, [30, 5, 15]);
  assert.equal(peak, 2);
});
