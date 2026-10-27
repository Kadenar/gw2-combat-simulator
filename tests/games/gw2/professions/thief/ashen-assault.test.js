import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Synthetic packets isolate cancellation, hit ownership, and the all-strikes refund without calibrating native timing.
for (const [skillId, specialization] of [
  [ID.ASHEN_ASSAULT, 'Core'],
  [ID.MALICIOUS_ASHEN_ASSAULT, 'Deadeye']
]) {
  test(`${specialization} Ashen channel keeps landed damage and refunds only an entirely landed activation`, () => {
    const run = ({ interruptAfterMs, missed = false } = {}) =>
      runThief(
        [{ type: 'cast', skillId, ...(interruptAfterMs == null ? {} : { interruptAfterMs }) }],
        { specialization, primaryWeapon: 'Spear', secondaryWeapon: '', initialInitiative: 0 },
        {
          initialize(runtime) {
            runtime.profession.core.stealthUntil = 10;
          },
          catalog: (catalog) =>
            withSkill(catalog, skillId, {
              initiativeRefund: 7,
              castTimeMs: 1000,
              effects: [
                { type: 'strike', name: 'First', coefficient: 1, atMs: 200, timingAnchor: 'castStart' },
                { type: 'strike', name: 'Middle', coefficient: 1, atMs: 400, timingAnchor: 'castStart' },
                { type: 'strike', name: 'Final', coefficient: 1, atMs: 600, timingAnchor: 'castStart' }
              ]
            }),
          extend: (native) => ({
            prepareEvent(runtime, event) {
              const prepared = native.prepareEvent?.(runtime, event) ?? event;
              return missed && prepared.name === 'Middle' ? { ...prepared, offTarget: true } : prepared;
            }
          })
        }
      );
    const full = run();
    const partial = run({ interruptAfterMs: 300 });
    const missed = run({ missed: true });
    for (const result of [full, partial, missed]) assert.deepEqual(result.warnings, []);
    assert.ok(partial.strikeDamage > 0 && partial.strikeDamage < full.strikeDamage);
    // Subtract ordinary recovery to isolate the all-strikes refund without changing the resource rules.
    for (const [result, refund] of [
      [partial, 0],
      [missed, 0],
      [full, 7]
    ]) {
      const runtime = observedRuntime(result);
      assert.ok(Math.abs(runtime.resourceController.value('initiative') - runtime.time - refund) < 1e-9);
    }
  });
}
