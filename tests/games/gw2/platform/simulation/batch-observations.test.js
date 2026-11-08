/** Batch output preserves combat facts and diagnostics while omitting optional editor collectors. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { comparisonResult } from '#gw2/app/page/benchmarks/comparison/model.js';
import { randomDistributionMetrics } from '#gw2/app/simulation/random-distribution/random-distribution.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

function run(output, endTimeMs = 2500) {
  const profession = defineTestProfession({ id: 'batch-observations', name: 'Batch observations' });
  return observeGw2Runtime({
    profession: profession.runtimeFor({}),
    output,
    config: { randomness: { mode: 'stochastic', seed: 7 } },
    observation: { kind: 'absolute', endTimeMs },
    rotation: [{ type: 'wait', durationMs: 500 }],
    engineInitialize(runtime) {
      const origin = { source: 'Fixture', sourceId: 'fixture', actorType: 'player' };
      for (const payload of [
        { type: 'buff', at: 0, kind: 'might', stacks: 5, duration: 4 },
        { type: 'damage', at: 0.1, coefficient: 1, weaponStrengthProfileId: 'weapon.axe' },
        { type: 'condition', at: 0.1, condition: 'Burning', stacks: 1, duration: 5 }
      ])
        runtime.effects.emit({ kind: 'packet', event: { ...origin, ...payload } });
      runtime.effects.emit({ kind: 'announcement', announcement: { type: 'trait', name: 'Fixture proc', at: 0.2 } });
      // Exercise both logged announcements and delivered proc packets while gameplay buffs remain available.
      runtime.effects.emit({
        kind: 'announcement',
        log: true,
        announcement: { type: 'trait', name: 'Logged proc', at: 0.3 }
      });
      runtime.effects.emit({ kind: 'packet', event: { ...origin, type: 'proc', name: 'Packet proc', at: 0.4 } });
      runtime.steps.push({
        skillName: 'Fixture',
        rotationCommandIndex: 0,
        activationId: 'fixture-warning',
        start: 0,
        end: 1000
      });
      runtime.warnings.push({ message: 'Fixture diagnostic', at: 0.2, activationId: 'fixture-warning' });
    }
  });
}

test('batch output retains consumer observations and diagnostic locations without editor collectors', () => {
  const detailed = run('detailed');
  const batch = run('observations');
  const runtime = observedRuntime(batch);
  assert.deepEqual(comparisonResult(batch), comparisonResult(detailed));
  assert.deepEqual(randomDistributionMetrics(batch), randomDistributionMetrics(detailed));
  assert.deepEqual(batch.warnings, detailed.warnings);
  assert.deepEqual(
    batch.events,
    detailed.events.filter((event) => event.type === 'proc')
  );
  assert.ok(batch.events.length > 0);
  assert.deepEqual(batch.procSteps, detailed.procSteps);
  assert.equal(batch.warnings[0].rotationIndex, 0);
  assert.equal(runtime.damageRecorder, null);
  assert.equal(runtime.effectRecorder, null);
  assert.ok(runtime.procRecorder);
  assert.ok(runtime.resolved.every((event) => ['damage', 'condition'].includes(event.type)));
  assert.ok(runtime.facts.ofType('buff').length > 0, 'Accepted buffs remain available to combat queries');
  assert.equal('planningState' in batch, false);
  assert.equal('breakdown' in batch, false);
  const strike = batch.resolvedEvents.find((event) => event.type === 'damage');
  const detailedStrike = detailed.resolvedEvents.find((event) => event.type === 'damage');
  assert.ok(detailedStrike.criticalChanceContributors.length > 0);
  assert.equal(strike.criticalChanceContributors, undefined);
  assert.equal(strike.criticalChance, detailedStrike.criticalChance);
  assert.equal(strike.didCrit, detailedStrike.didCrit);
});

test('batch output clips condition observations and detaches them from live settlement state', () => {
  const batch = run('observations', 750);
  const detailed = run('detailed', 750);
  assert.deepEqual(comparisonResult(batch), comparisonResult(detailed));
  const condition = batch.resolvedEvents.find((event) => event.type === 'condition');
  const live = observedRuntime(batch).resolved.find((event) => event.type === 'condition');
  assert.equal(condition.expiresAt, 0.75);
  assert.ok(live.naturalExpiresAt > condition.expiresAt);
  condition.damageTicks.push({ at: 99, damage: 999, fraction: 1 });
  assert.ok(live.damageTicks.every((tick) => tick.at !== 99));
  batch.procSteps[0].skill = 'Edited';
  assert.notEqual(observedRuntime(batch).procRecorder.steps[0].skill, 'Edited');
});
