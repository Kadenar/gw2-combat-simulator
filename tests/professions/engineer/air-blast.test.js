import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(engineerProfession, {
  selectedSkills: ['Healing Turret', 'Flamethrower'],
  selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
  target: { armor: 2597, conditions: {} }
});
const airBurns = (result) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.AIR_BLAST && event.condition === 'Burning'
  );
const rockets = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Aim-Assisted Rocket');

// Clean targets retain knockback but must not acquire Burning or create a missile proc.
test('Air Blast burns and triggers Aim-Assisted Rocket only against burning targets', () => {
  for (const burning of [false, true]) {
    const result = simulate('Core', ['Flamethrower', 'Air Blast', { type: 'wait', durationMs: 1000 }], {
      target: { conditions: { Burning: burning } }
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(airBurns(result).length, Number(burning));
    assert.equal(rockets(result).length, Number(burning));
    assert.ok(result.events.some((event) => event.type === 'control' && event.skillId === ID.AIR_BLAST));
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.AIR_BLAST),
      false
    );
    if (burning) {
      assert.equal(airBurns(result)[0].stacks, 1);
      assert.equal(airBurns(result)[0].duration, 5);
      assert.equal(rockets(result)[0].triggeredBy, 'Air Blast');
    }
  }

  const withoutTrait = simulate('Core', ['Flamethrower', 'Air Blast', { type: 'wait', durationMs: 1000 }], {
    selectedTraitIds: [],
    target: { conditions: { Burning: true } }
  });
  assert.deepEqual(withoutTrait.warnings, []);
  assert.equal(airBurns(withoutTrait).length, 1);
  assert.equal(rockets(withoutTrait).length, 0);
});

// Burning must survive until impact, rather than merely being present when Air Blast starts casting.
test('Air Blast checks live Burning expiry at impact', () => {
  const setup = ['Flamethrower', 'Flame Blast'];
  const initial = simulate('Core', setup);
  const burning = initial.resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Burning');
  const air = simulate('Core', ['Flamethrower', 'Air Blast']).steps.find((step) => step.skillId === ID.AIR_BLAST);
  const castMs = air.end - air.start;
  for (const offsetMs of [-40, 0, 40]) {
    const waitMs = burning.naturalExpiresAt * 1000 - initial.steps.at(-1).end - castMs + offsetMs;
    const result = simulate('Core', [
      ...setup,
      { type: 'wait', durationMs: waitMs },
      'Air Blast',
      { type: 'wait', durationMs: 1000 }
    ]);
    assert.deepEqual(result.warnings, []);
    assert.equal(airBurns(result).length, Number(offsetMs < 0));
    assert.equal(rockets(result).length, Number(offsetMs < 0));
  }
});
