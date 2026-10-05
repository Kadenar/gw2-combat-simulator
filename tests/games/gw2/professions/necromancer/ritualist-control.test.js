import assert from 'node:assert/strict';
import test from 'node:test';

import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

const simulateProfession = createObservedProfessionSimulator(necromancerProfession, {
  initialResource: 100,
  target: {}
});
// Control and duration checks observe the same executed packets as live combat.
const simulate = (rotation, config = {}) => simulateProfession('Ritualist', rotation, config);

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
      spiritAttackType: event.metadata?.spiritAttackType
    })),
    [
      {
        skillId: ID.SUMMON_SPIRITS,
        controlKind: 'daze',
        spiritAttackType: 'summon-spirits'
      }
    ]
  );
  assert.deepEqual(
    innervated.events
      .filter((event) => event.type === 'condition' && event.condition === 'Fear')
      .map((event) => ({
        skillId: event.skillId,
        condition: event.condition,
        actorType: event.actorType,
        spiritAttackType: event.metadata?.spiritAttackType
      })),
    [
      {
        skillId: ID.INNERVATE_WANDERLUST,
        condition: 'Fear',
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
