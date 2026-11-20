// Observe each skill's reward at the two shared trait triggers during a real cast.
import assert from 'node:assert/strict';
import test from 'node:test';

import { stealCommitted, stealCompleted } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

const hasStolenSkill = (runtime) => runtime.profession.core.storedStolenSkillCount > 0;
const hasArtifact = (runtime) => runtime.profession.specialization.state.artifactUsesRemaining > 0;

function observeStealPhases(hasReward) {
  const phases = [];
  return {
    phases,
    extend(native) {
      const triggerListeners = new Map(native.triggerListeners);
      for (const point of [stealCommitted, stealCompleted]) {
        triggerListeners.set(point.id, [
          ...triggerListeners.get(point.id),
          (runtime) => phases.push([point.id, hasReward(runtime)])
        ]);
      }

      return { triggerListeners };
    }
  };
}

for (const [specialization, skill, hasReward] of [
  ['Core', ID.STEAL, hasStolenSkill],
  ['Daredevil', ID.STEAL, hasStolenSkill],
  [
    'Deadeye',
    ID.DEADEYES_MARK,
    (runtime) => hasStolenSkill(runtime) && Boolean(runtime.profession.specialization.state.markedTargetId)
  ],
  ['Specter', ID.SIPHON, (runtime) => runtime.resourceController.value('shadowForce') > 0],
  ['Antiquary', ID.SKRITT_SWIPE, hasArtifact]
]) {
  test(`${specialization} grants its Steal reward between commitment and completion`, () => {
    const { phases, extend } = observeStealPhases(hasReward);
    const result = runThief([skill], { specialization }, { extend });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(phases, [
      [stealCommitted.id, false],
      [stealCompleted.id, true]
    ]);
  });
}

// Starting inventory, cantrips, and non-Swipe pilfers grant choices independently of Steal.
test('inventory-only grants bypass on-steal traits and completion rewards', () => {
  for (const [rotation, config, hasInventory] of [
    [[], { specialization: 'Core', initialPreSteal: 1 }, hasStolenSkill],
    [
      [ID.SHADOW_FLARE],
      { specialization: 'Deadeye', selectedSkillIds: [ID.SHADOW_FLARE], selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER] },
      hasStolenSkill
    ],
    [[ID.SKRITT_SCUFFLE], { specialization: 'Antiquary', selectedSkillIds: [ID.SKRITT_SCUFFLE] }, hasArtifact],
    [
      Array(4).fill(ID.DEATH_BLOSSOM),
      { specialization: 'Antiquary', selectedTraitIds: [TRAIT.PRODIGIOUS_PINCHER] },
      hasArtifact
    ]
  ]) {
    const { phases, extend } = observeStealPhases(hasInventory);
    const result = runThief(rotation, config, { extend });
    assert.deepEqual(result.warnings, []);
    assert.ok(hasInventory(observedRuntime(result)));
    assert.deepEqual(phases, []);
  }
});

test('cancelling Siphon before commitment skips both Steal triggers and its force grant', () => {
  const hasForce = (runtime) => runtime.resourceController.value('shadowForce') > 0;
  const { phases, extend } = observeStealPhases(hasForce);
  const result = runThief(
    [{ type: 'cast', skillId: ID.SIPHON, interruptAfterMs: 1 }],
    { specialization: 'Specter' },
    { extend }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(phases, []);
  assert.equal(hasForce(observedRuntime(result)), false);
});
