import assert from 'node:assert/strict';
import test from 'node:test';

import { reactThiefStealthBreakingStrike } from '#gw2/professions/thief/core/mechanics/stealth.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefFamilyRuntimeHooks } from '#gw2/professions/thief/family-state.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { emitStealth } from '#tests/helpers/stealth.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

test('stealth entry and exits honor selected linger and venom grants without repeating entry on extension', () => {
  for (const attack of [false, true]) {
    const grants = [];
    const result = runThief(
      [{ type: 'wait', durationMs: 2000 }],
      { selectedTraitIds: [TRAIT.HIDDEN_KILLER, TRAIT.LEECHING_VENOMS] },
      {
        catalog: (catalog) =>
          withProfile(withProfile(catalog, TRAIT.HIDDEN_KILLER, { duration: 6 }), TRAIT.LEECHING_VENOMS, {
            resourceGain: 2,
            duration: 7,
            maximumStacks: 3
          }),
        probes: [
          [
            1,
            (runtime) => {
              emitStealth(runtime, runtime.helpers.skillsById.get(ID.BACKSTAB), 3);
              grants.push(structuredClone(runtime.profession.core.venomChargeBatches[ID.SPIDER_VENOM]));
            }
          ],
          [
            1.5,
            (runtime) => {
              emitStealth(runtime, runtime.helpers.skillsById.get(ID.BACKSTAB), 1);
              grants.push(structuredClone(runtime.profession.core.venomChargeBatches[ID.SPIDER_VENOM]));
            }
          ],
          ...(attack
            ? [
                [
                  2,
                  (runtime) => {
                    thiefFamilyRuntimeHooks(runtime.profession.specialization.kind).onCastStart(runtime, {
                      skill: runtime.helpers.skillsById.get(ID.BACKSTAB),
                      id: 'test-attack'
                    });
                    // The landed hit, rather than admission, now owns the exit rewards.
                    reactThiefStealthBreakingStrike(
                      runtime,
                      thiefHit(runtime.time, {
                        skillId: ID.BACKSTAB,
                        activationId: 'test-attack'
                      })
                    );
                  }
                ]
              ]
            : [])
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      grants[0].map(({ count, expiresAt }) => [count, expiresAt]),
      [[2, 8]]
    );
    assert.deepEqual(grants[1], grants[0]);
    const core = observedRuntime(result).profession.core;
    assert.equal(core.hiddenKillerUntil, attack ? 8 : 11);
    assert.deepEqual(
      core.venomChargeBatches[ID.SPIDER_VENOM].map(({ count, expiresAt }) => [count, expiresAt]),
      attack
        ? [
            [2, 8],
            [1, 9]
          ]
        : [[2, 8]]
    );
  }
});
