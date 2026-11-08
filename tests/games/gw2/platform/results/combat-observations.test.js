/** Shared projections keep combat cutoffs and detached lifetimes consistent across result modes. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { projectCombatObservations } from '#gw2/platform/results/combat-observations.js';

test('combat observations clip and order both timelines without mutating their source records', () => {
  const condition = { type: 'condition', at: 0.2, naturalExpiresAt: 5, damageTicks: [{ at: 0.5, damage: 10 }] };
  const ctx = {
    resolved: [{ type: 'damage', at: 0.751 }, { type: 'damage', at: 0.75 }, condition],
    procRecorder: {
      steps: [
        { start: 751, skill: 'Outside' },
        { start: 750, skill: 'Boundary' },
        { start: 200, skill: 'Inside' }
      ]
    }
  };
  const result = projectCombatObservations(ctx, 0.75);
  assert.deepEqual(
    result.resolvedEvents.map((event) => event.at),
    [0.2, 0.75]
  );
  assert.deepEqual(
    result.procSteps.map((step) => step.skill),
    ['Inside', 'Boundary']
  );
  assert.equal(result.resolvedEvents[0].expiresAt, 0.75);
  assert.equal(condition.expiresAt, undefined);
  result.resolvedEvents[0].damageTicks[0].damage = 99;
  result.procSteps[0].skill = 'Edited';
  assert.equal(condition.damageTicks[0].damage, 10);
  assert.deepEqual(
    ctx.procRecorder.steps.map((step) => step.skill),
    ['Outside', 'Boundary', 'Inside']
  );
});
