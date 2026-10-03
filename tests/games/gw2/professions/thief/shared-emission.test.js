import assert from 'node:assert/strict';
import test from 'node:test';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

// Immediate poison participates in the enclosing hit, while queued Lotus Poison Weakness waits for that hit to finish.
test('shared emission preserves Thief nested condition visibility before Panic Strike', () => {
  for (const [threshold, offTarget, expectedPanic] of [
    [2, false, true],
    [3, false, false],
    [2, true, false]
  ]) {
    const result = runThief(
      [{ type: 'wait', durationMs: 1100 }],
      {
        selectedTraitIds: [TRAIT.DEADLY_AMBITION, TRAIT.LOTUS_POISON, TRAIT.PANIC_STRIKE],
        target: { armor: 2597, conditions: { Bleeding: 1 } }
      },
      {
        extend: (native) => ({ catalog: withProfile(native.catalog, TRAIT.PANIC_STRIKE, { threshold }) }),
        initialize(runtime) {
          runtime.effects.emit({
            kind: 'packet',
            event: thiefHit(1, {
              skillId: ID.DEATH_BLOSSOM,
              sourceId: ID.DEATH_BLOSSOM,
              skillName: 'Death Blossom',
              activationId: 'dual',
              offTarget
            })
          });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const conditions = result.resolvedEvents.filter((event) => event.type === 'condition');
    assert.equal(
      conditions.some((event) => event.sourceId === TRAIT.PANIC_STRIKE && event.condition === 'Immobilized'),
      expectedPanic
    );
    assert.equal(
      conditions.some((event) => event.sourceId === TRAIT.LOTUS_POISON && event.condition === 'Weakness'),
      !offTarget
    );
  }
});
