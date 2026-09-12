import assert from 'node:assert/strict';
import test from 'node:test';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(thiefProfession, {
  primaryWeapon: 'Staff',
  selectedSkills: ['Caltrops', 'Fist Flurry'],
  target: { armor: 2597, conditions: {} }
});

test('Weakening Whirl schedules weakness with each retained strike', () => {
  // Interrupting the attack must retain only the weakness belonging to emitted hits.
  for (const quickness of [false, true]) {
    for (const entry of ['Weakening Whirl', { name: 'Weakening Whirl', interruptMs: 250 }]) {
      const result = simulate('Daredevil', [entry], { boons: { quickness } });
      assert.deepEqual(result.warnings, []);
      const hits = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.WEAKENING_WHIRL);
      const weakness = result.events.filter((event) => event.type === 'condition' && event.condition === 'Weakness');
      assert.ok(hits.length > 0);
      assert.deepEqual(
        weakness.map((event) => event.at),
        hits.map((event) => event.at)
      );
      assert.ok(weakness.every((event) => event.stacks === 1 && event.duration === 2));
      if (typeof entry === 'string')
        assert.equal(
          weakness.reduce((sum, event) => sum + event.duration, 0),
          6
        );
    }
  }
});

test('Caltrops schedules an impact bleed followed by ten one-second pulses', () => {
  const result = simulate('Core', ['Caltrops', { name: '__wait', waitMs: 11000 }]);
  assert.deepEqual(result.warnings, []);
  const bleeds = result.events.filter((event) => event.type === 'condition' && event.condition === 'Bleeding');
  // Offsets are relative to placement so cast duration does not change the field cadence.
  assert.deepEqual(
    bleeds.map((event) => Math.round((event.at - bleeds[0].at) * 1000)),
    Array.from({ length: 11 }, (_, index) => index * 1000)
  );
  assert.ok(Math.abs(bleeds[0].at - result.steps[0].end / 1000) < 0.001);
  assert.ok(bleeds.every((event) => event.stacks === 1));
});

test('Fist Flurry flips its equipped tile only after connecting and restores it after use or expiry', () => {
  const parent = thiefCatalog.skillsById.get(ID.FIST_FLURRY);
  assert.equal(parent.flipSkillId, ID.PALM_STRIKE);
  assert.equal(thiefCatalog.skillsById.get(ID.PALM_STRIKE).flipParentId, parent.id);
  for (const [rotation, expected] of [
    [[], ID.FIST_FLURRY],
    [['Fist Flurry'], ID.PALM_STRIKE],
    [['Fist Flurry', 'Palm Strike'], ID.FIST_FLURRY],
    [['Fist Flurry', { name: '__wait', waitMs: 6000 }], ID.FIST_FLURRY],
    [[{ name: 'Fist Flurry', interruptMs: 250 }], ID.FIST_FLURRY],
    [[{ name: 'Fist Flurry', offTarget: true }], ID.FIST_FLURRY]
  ]) {
    const result = simulate('Daredevil', rotation);
    assert.deepEqual(result.warnings, []);
    const context = { specialization: 'Daredevil', professionState: result.endState.profession, time: result.duration };
    const app = { profession: thiefProfession, skills: thiefCatalog.skills, build: { rotation: [] }, results: result };
    assert.equal(displayedSkillTiles(app, [parent], context)[0].id, expected);
    assert.equal(
      Number(result.endState.profession.palmStrikeUntil || 0) > result.duration,
      expected === ID.PALM_STRIKE
    );
  }

  // Consuming the window must reject a second follow-up through the scheduler.
  assert.match(
    simulate('Daredevil', ['Fist Flurry', 'Palm Strike', 'Palm Strike']).warnings.join('\n'),
    /Fist Flurry must connect/
  );
});
