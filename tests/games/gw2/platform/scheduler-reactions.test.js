import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { emitElementalistDamage } from '#gw2/professions/elementalist/core/live-events.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { projectedFreshAirReadyAt } from '#gw2/professions/elementalist/core/traits/air.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { runtimeFor } from '#tests/helpers/live-runtime.js';

// Real profession selection and execution must preserve same-time ordering and replacement eligibility.
test('Ranger stealth follows its granting strike and ignores off-target impacts', () => {
  const result = runRanger(
    [{ type: 'wait', durationMs: 2500 }],
    {},
    {
      initialize(runtime) {
        runtime.emit({
          type: 'buff',
          source: 'probe',
          sourceId: 'stealth',
          actorType: 'player',
          at: 1,
          kind: 'stealth',
          duration: 5,
          stacks: 1
        });
        for (const [at, extra] of [
          [1, {}],
          [2, { offTarget: true }]
        ])
          runtime.emit({
            type: 'damage',
            source: 'probe',
            sourceId: 'hit',
            actorType: 'player',
            at,
            coefficient: 1,
            weaponStrength: 1000,
            ...extra
          });
      }
    }
  );
  assert.equal(runtimeFor(result).profession.core.stealthUntil, 6);
  assert.equal(runtimeFor(result).profession.core.revealedUntil, 0);
});

// Pending hits wake availability without predicting a reset; only the accepted critical clears recharge.
test('Fresh Air candidates wait for the actual critical fact', () => {
  const air = ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air;
  const result = runElementalist({
    config: {
      specialization: 'Core',
      startAttunement: 'Water',
      selectedTraitIds: ['Fresh Air'],
      autoSummonElemental: false
    },
    rotation: ['__combat_start', { type: 'wait', durationMs: 4000 }],
    initialize: (r) => {
      r.cooldownController.setReadyAt(air, 10);
      for (const [at, fields] of [
        [3, { noCrit: true }],
        [2, { noCrit: true }],
        [2, { forceCrit: true }]
      ])
        emitElementalistDamage(r, {
          at,
          skillId: 42,
          skillName: 'Fixture',
          actorType: 'player',
          coefficient: 1,
          skillWeapon: 'Unequipped',
          ...fields
        });
    },
    timeline: [
      {
        at: 1,
        run: (r) => {
          assert.equal(projectedFreshAirReadyAt(r, 2), 2);
          assert.equal(r.cooldowns.get(air), 10);
        }
      }
    ]
  });
  assert.equal(runtimeFor(result).cooldowns.has(air), false);
  const resets = result.events.filter((e) => e.type === 'elementalist.fresh-air');
  assert.equal(resets.length, 1);
  assert.equal(resets[0].at, 2);
});
