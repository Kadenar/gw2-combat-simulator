import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '../../../js/platform/gw2/simulation/simulate.js';
import { necromancerProfession } from '../../../js/professions/necromancer/definition.js';
import { NECROMANCER_SKILL_IDS as ID } from '../../../js/professions/necromancer/data/ids.js';

function simulate(rotation, config = {}) {
  return simulateGw2({
    profession: necromancerProfession,
    rotation,
    config: {
      specialization: 'Ritualist',
      initialResource: 100,
      ...config
    },
    mode: 'sequence'
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
      spiritAttackType: event.spiritAttackType
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
      spiritAttackType: event.spiritAttackType
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
