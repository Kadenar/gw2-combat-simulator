import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

function simulate(rotation, config = {}) {
  return simulateGw2({
    profession: necromancerProfession,
    rotation,
    config: {
      specialization: 'Ritualist',
      initialResource: 100,
      ...config
    }
  });
}

test('Wanderlust omits minion knockdown while its player controls still apply', () => {
  const summoned = simulate(["Ritualist's Shroud", 'Wanderlust', { type: 'wait', durationMs: 6000 }], {
    relic: 'Claw'
  });
  const commanded = simulate([
    "Ritualist's Shroud",
    'Wanderlust',
    'Summon Spirits',
    { type: 'wait', durationMs: 1000 }
  ]);
  const innervated = simulate(["Ritualist's Shroud", 'Wanderlust', 'Innervate Wanderlust'], { relic: 'Claw' });
  const controls = (result) => result.events.filter((event) => event.type === 'control');

  assert.deepEqual(controls(summoned), []);
  assert.equal(
    summoned.procSteps.some((step) => step.skill === 'Relic of the Claw'),
    false
  );
  assert.deepEqual(
    controls(commanded).map((event) => ({
      skillId: event.skillId,
      controlKind: event.controlKind,
      duration: event.duration,
      spiritAttackType: event.metadata?.spiritAttackType
    })),
    [
      {
        skillId: ID.SUMMON_SPIRITS,
        controlKind: 'daze',
        duration: 2,
        spiritAttackType: 'summon-spirits'
      }
    ]
  );
  assert.deepEqual(
    controls(innervated).map((event) => ({
      skillId: event.skillId,
      controlKind: event.controlKind,
      duration: event.duration,
      actorType: event.actorType,
      spiritAttackType: event.metadata?.spiritAttackType
    })),
    [
      {
        skillId: ID.INNERVATE_WANDERLUST,
        controlKind: 'fear',
        duration: 1.5,
        actorType: 'player',
        spiritAttackType: 'innervate'
      }
    ]
  );
  assert.equal(
    innervated.procSteps.some((step) => step.skill === 'Relic of the Claw'),
    true
  );
});

test('Painful Bond adds overlapping applications to its remaining duration', () => {
  const result = simulate(["Ritualist's Shroud", 'Anguish', 'Anguish', { type: 'wait', durationMs: 22_000 }], {
    selectedTraitIds: [TRAIT.SOUL_TWISTING]
  });
  const applications = result.events.filter(
    (event) => event.type === 'necromancer.painful-bond' && event.mode === 'apply'
  );
  const pulses = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Painful Bond');

  assert.equal(applications.length, 2);
  assert.ok(applications[1].at < applications[0].at + applications[0].duration);
  assert.equal(pulses.length, 20);
  assert.equal(Number((pulses.at(-1).at - pulses[0].at).toFixed(3)), 19);
});
