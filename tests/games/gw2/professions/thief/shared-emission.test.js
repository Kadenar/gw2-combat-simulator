import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { stealAccepted, stealthAttackCompleted } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

// Both trait boundaries retain the triggering cast's identity and suppress explicitly removed conditions.
for (const [trait, point, skillId, name] of [
  [TRAIT.EVEN_THE_ODDS, stealAccepted, ID.STEAL, 'Even the Odds'],
  [TRAIT.SUNDERING_SHADE, stealthAttackCompleted, ID.BACKSTAB, 'Sundering Shade']
]) {
  test(`${name} preserves cast ownership and selected profile removal`, () => {
    for (const scenario of ['active', 'unselected', 'removed']) {
      const result = runThief(
        [{ type: 'wait', durationMs: 1100 }],
        {
          selectedTraitIds: scenario === 'unselected' ? [] : [trait]
        },
        {
          catalog: (catalog) =>
            scenario === 'removed'
              ? applyBalanceProfilePatch(catalog, {
                  balanceProfiles: { [trait]: { removeEffects: [{ type: 'condition', name: 'Vulnerability' }] } }
                })
              : catalog,
          timeline: [
            {
              at: 1,
              run(runtime) {
                runtime.fireTrigger(point, {
                  cast: { id: 'reward-cast', skill: runtime.helpers.skillsById.get(skillId) }
                });
              }
            }
          ]
        }
      );
      assert.deepEqual(result.warnings, []);
      const reward = result.resolvedEvents.find((event) => event.type === 'condition' && event.sourceId === trait);
      assert.equal(Boolean(reward), scenario === 'active');

      if (reward) {
        assert.equal(reward.activationId, 'reward-cast');
        assert.equal(reward.skillId, skillId);
        assert.equal(reward.actorType, 'player');
        assert.equal(reward.traitId, trait);
        assert.equal(reward.name, `${name} — Vulnerability`);
      }
    }
  });
}

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
