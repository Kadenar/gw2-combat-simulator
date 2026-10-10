import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const shadestepRewards = [
  [ID.GRASPING_SHADOWS, 'alacrity'],
  [ID.DAWNS_REPOSE, 'protection'],
  [ID.MIND_SHOCK, 'aegis']
];

// Each committed skill grants its own boon; Dawn's intrinsic barrier has no ordering dependency on protection.
test('Shade Step grants only the committed skill boon with the accepted action identity', () => {
  for (const [skillId, kind] of shadestepRewards) {
    const result = runThief([ID.ENTER_SHADOW_SHROUD, skillId, { type: 'wait', durationMs: 1000 }], {
      specialization: 'Specter',
      initialShadowForce: 100,
      selectedTraitIds: [TRAIT.SHADESTEP],
      allies: { count: 2, strikesPerSecond: 0 }
    });
    assert.deepEqual(result.warnings, []);
    const rewards = result.events.filter((event) => event.sourceId === TRAIT.SHADESTEP);
    assert.deepEqual(
      rewards.map((event) => event.kind),
      [kind]
    );
    const action = result.events.find((event) => event.type === 'action' && event.skillId === skillId);
    assert.equal(rewards[0].at, action.endsAt);
    assert.equal(rewards[0].activationId, action.activationId);
    assert.equal(rewards[0].source, 'Trait');
    assert.equal(rewards[0].actorType, 'player');
    assert.equal(rewards[0].skillId, skillId);
    assert.equal(rewards[0].skillName, action.skillName);
    assert.equal(rewards[0].name, `Shade Step - ${kind}`);
    assert.equal(rewards[0].audience.recipients, 'party');
    assert.equal(rewards[0].resolvedAudience.recipientCount, 3);
  }
});

// Selection, isolation, and patch removal gate each reward without suppressing intrinsic skill behavior.
for (const [skillId, kind] of shadestepRewards) {
  test(`Shade Step ${kind} respects selection, trigger isolation, and removed payloads`, () => {
    for (const selected of [false, true]) {
      for (const traitTriggers of [false, true]) {
        for (const removed of [false, true]) {
          const result = runThief(
            [ID.ENTER_SHADOW_SHROUD, skillId, { type: 'wait', durationMs: 1000 }],
            {
              specialization: 'Specter',
              initialShadowForce: 100,
              selectedTraitIds: selected ? [TRAIT.SHADESTEP] : [],
              allies: { count: 2, strikesPerSecond: 0 }
            },
            {
              profession: {
                ...thiefProfession,
                runtimeFor: (config) => thiefProfession.runtimeFor(config, { traitTriggers })
              },
              catalog: (catalog) =>
                removed
                  ? applyBalanceProfilePatch(catalog, {
                      balanceProfiles: { [TRAIT.SHADESTEP]: { removeEffects: [{ type: 'boon', name: kind }] } }
                    })
                  : catalog
            }
          );
          assert.deepEqual(result.warnings, []);
          const rewards = result.events.filter((event) => event.sourceId === TRAIT.SHADESTEP);
          assert.deepEqual(
            rewards.map((event) => event.kind),
            selected && traitTriggers && !removed ? [kind] : []
          );
          if (skillId === ID.DAWNS_REPOSE) {
            const barrier = result.events.find((event) => event.skillId === skillId && event.kind === 'barrier');
            assert.ok(barrier, 'Completion grants the intrinsic barrier independently of Shadestep');
            assert.equal(barrier.resolvedAudience.recipientCount, 3);
          }
        }
      }
    }
  });
}

// Trait activation is independent of barrier payload lookup, so removing the barrier cannot suppress protection.
test('Shade Step protection survives removal of the independent Dawn barrier', () => {
  const result = runThief(
    [ID.ENTER_SHADOW_SHROUD, ID.DAWNS_REPOSE, { type: 'wait', durationMs: 1000 }],
    { specialization: 'Specter', initialShadowForce: 100, selectedTraitIds: [TRAIT.SHADESTEP] },
    {
      catalog: (catalog) =>
        applyBalanceProfilePatch(catalog, {
          balanceProfiles: { [PROFILE.dawnsReposeBarrier]: { removeEffects: [{ type: 'buff', name: 'barrier' }] } }
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.skillId === ID.DAWNS_REPOSE && event.kind === 'barrier'),
    false
  );
  assert.deepEqual(
    result.events.filter((event) => event.sourceId === TRAIT.SHADESTEP).map((event) => event.kind),
    ['protection']
  );
});
