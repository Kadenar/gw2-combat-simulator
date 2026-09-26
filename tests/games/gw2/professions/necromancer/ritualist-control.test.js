import assert from 'node:assert/strict';
import test from 'node:test';

import { createLiveProfessionSimulator } from '#tests/helpers/live-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

const simulateProfession = createLiveProfessionSimulator(necromancerProfession, { initialResource: 100, target: {} });
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
    controls(innervated).map((event) => ({
      skillId: event.skillId,
      controlKind: event.controlKind,
      actorType: event.actorType,
      spiritAttackType: event.metadata?.spiritAttackType
    })),
    [
      {
        skillId: ID.INNERVATE_WANDERLUST,
        controlKind: 'fear',
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
  const pulses = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Painful Bond');

  assert.deepEqual(result.warnings, []);
  assert.equal(pulses.length, 20);
  assert.equal(Number((pulses.at(-1).at - pulses[0].at).toFixed(3)), 19);
});
