import assert from 'node:assert/strict';
import test from 'node:test';

import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { THIEF_SKILL_IDS as THIEF } from '#gw2/professions/thief/data/ids.js';
import { createProfessionSimulator } from '../helpers/profession-simulation.js';

// Short synthetic rotations isolate trap timing and finite on-hit charges from benchmark totals.
const config = {
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  offHandWeapon: 'Torch',
  stats: { power: 2000, conditionDamage: 1000, precision: 1000, expertise: 0 },
  target: { armor: 2597, defiant: true, conditions: {} }
};
const ranger = createProfessionSimulator(rangerProfession, config);
const thief = createProfessionSimulator(thiefProfession, config);
const wait = (durationMs) => ({ type: 'wait', durationMs });
const conditions = (result, skillId) =>
  result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillId === skillId);

test("Viper's Nest triggers after placement and preserves the pending dagger chain", () => {
  for (const quickness of [false, true]) {
    const result = ranger('Druid', ['Groundwork Gouge', "Viper's Nest", 'Leading Swipe', wait(4000)], {
      boons: { quickness },
      selectedSkills: ["Viper's Nest"]
    });
    assert.deepEqual(result.warnings, []);
    const cast = result.steps.find((step) => step.skill === "Viper's Nest");
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === RANGER.VIPERS_NEST);
    assert.deepEqual(
      hits.map((event) => Math.round(event.at * 1000) - cast.start),
      [1400, 2400, 3400]
    );
    assert.ok(hits[0].at * 1000 > cast.end);
    const poison = result.events.filter((event) => event.type === 'condition' && event.skillId === RANGER.VIPERS_NEST);
    assert.deepEqual(
      poison.map((event) => event.at),
      hits.map((event) => event.at)
    );
  }
});

test("Viper's Nest cancels before placement but retains delayed pulses after committing", () => {
  for (const [interruptMs, expectedHits] of [
    [100, 0],
    [476, 3]
  ]) {
    const result = ranger('Druid', [{ name: "Viper's Nest", interruptMs }, wait(4000)], {
      selectedSkills: ["Viper's Nest"],
      boons: { quickness: true }
    });
    assert.equal(
      result.events.filter((event) => event.type === 'damage' && event.skillId === RANGER.VIPERS_NEST).length,
      expectedHits
    );
  }
});

test('Sharpening Stone adds ten to six remaining charges, with one eight-second bleed per hit', () => {
  const result = ranger(
    'Druid',
    [
      'Sharpening Stone',
      'Groundwork Gouge',
      'Leading Swipe',
      'Serpent Stab',
      'Deadly Delivery',
      '__cooldown_reset',
      'Sharpening Stone'
    ],
    { selectedSkills: ['Sharpening Stone'] }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.sharpeningStoneExpirations.length, 16);
  const bleeds = conditions(result, RANGER.SHARPENING_STONE);
  assert.equal(bleeds.length, 4);
  assert.ok(bleeds.every((event) => event.stacks === 1 && Math.abs(event.naturalExpiresAt - event.at - 8) < 1e-9));
});

test('Sharpening Stone applications expire independently at thirty seconds', () => {
  const result = ranger(
    'Druid',
    ['Sharpening Stone', wait(10000), '__cooldown_reset', 'Sharpening Stone', wait(20000), 'Groundwork Gouge'],
    { selectedSkills: ['Sharpening Stone'] }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.sharpeningStoneExpirations.length, 9);
  assert.equal(conditions(result, RANGER.SHARPENING_STONE).length, 1);
  const expired = ranger('Druid', ['Sharpening Stone', wait(30000), 'Groundwork Gouge'], {
    selectedSkills: ['Sharpening Stone']
  });
  assert.equal(conditions(expired, RANGER.SHARPENING_STONE).length, 0);
});

for (const [name, id, charges] of [
  ['Spider Venom', THIEF.SPIDER_VENOM, 6],
  ['Skale Venom', THIEF.SKALE_VENOM, 4],
  ['Devourer Venom', THIEF.DEVOURER_VENOM, 2]
]) {
  test(`${name} preserves spent charges across recasts and expires each grant separately`, () => {
    const result = thief('Core', [name, 'Heartseeker', '__cooldown_reset', name, 'Heartseeker'], {
      selectedSkills: [name]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.endState.profession.venomChargeBatches[id].reduce((sum, batch) => sum + batch.charges, 0),
      charges * 2 - 2
    );
    const expired = thief('Core', [name, wait(10000), '__cooldown_reset', name, wait(14000), 'Heartseeker'], {
      selectedSkills: [name]
    });
    assert.deepEqual(expired.warnings, []);
    assert.equal(
      expired.endState.profession.venomChargeBatches[id].reduce((sum, batch) => sum + batch.charges, 0),
      charges - 1
    );
    assert.ok(conditions(expired, id).length > 0);
  });
}

test('recast ally venoms spend one charge per strike instead of overlapping proc sequences', () => {
  const result = thief('Core', ['Spider Venom', '__cooldown_reset', 'Spider Venom', wait(13000)], {
    selectedSkills: ['Spider Venom'],
    allies: { count: 1, strikesPerSecond: 1 }
  });
  const procs = conditions(result, THIEF.SPIDER_VENOM).filter((event) => event.triggeredByAlly);
  assert.equal(procs.length, 12);
  assert.deepEqual(
    procs.map((event) => event.at),
    Array.from({ length: 12 }, (_, index) => index + 1)
  );
});
