import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS, ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { projectedFreshAirReadyAt } from '#gw2/professions/elementalist/core/traits/critical-procs.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

// Real profession selection and execution must preserve same-time ordering and replacement eligibility.
test('Ranger stealth follows its granting strike and ignores off-target impacts', () => {
  const result = runRanger(
    [{ type: 'wait', durationMs: 2500 }],
    {},
    {
      initialize(runtime) {
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'buff',
            source: 'probe',
            sourceId: 'stealth',
            actorType: 'player',
            at: 1,
            kind: 'stealth',
            duration: 5,
            stacks: 1
          }
        });
        for (const [at, extra] of [
          [1, {}],
          [2, { offTarget: true }]
        ])
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              source: 'probe',
              sourceId: 'hit',
              actorType: 'player',
              at,
              coefficient: 1,
              weaponStrength: 1000,
              ...extra
            }
          });
      }
    }
  );
  assert.equal(observedRuntime(result).profession.core.stealthUntil, 6);
  assert.equal(observedRuntime(result).profession.core.revealedUntil, 0);
});

// Pending hits wake availability without predicting a reset; only the accepted critical clears recharge.
test('Fresh Air candidates wait for the actual critical fact', () => {
  const air = ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air;
  const result = runElementalist(
    ['__combat_start', { type: 'wait', durationMs: 4000 }],
    {
      specialization: 'Core',
      startAttunement: 'Water',
      selectedTraitIds: [ELEMENTALIST_TRAIT_IDS.FRESH_AIR]
    },
    {
      initialize: (r) => {
        r.cooldownController.setReadyAt(air, 10);
        for (const [at, fields] of [
          [3, { canCrit: false }],
          [2, { canCrit: false }],
          [2, { forceCrit: true }]
        ])
          r.effects.emit(
            elementalistStrikeRequest(r, {
              at,
              skillId: 42,
              skillName: 'Fixture',
              actorType: 'player',
              coefficient: 1,
              skillWeapon: 'Unequipped',
              ...fields
            })
          );
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
    }
  );
  assert.equal(observedRuntime(result).cooldowns.has(air), false);
  const resets = result.events.filter((e) => e.type === 'elementalist.fresh-air');
  assert.equal(resets.length, 1);
  assert.equal(resets[0].at, 2);
});
