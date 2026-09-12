import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';

const simulate = createProfessionSimulator(thiefProfession, {
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  selectedSkills: ['Caltrops', 'Prepare Thousand Needles'],
  selectedDodge: 'Lotus Training',
  target: { armor: 2597, conditions: {} },
  boons: { quickness: true }
});

// Check each commit boundary through the scheduler, including persistent fields and retained dodge occupancy.
test('Channeled Vigor grants endurance only after its 440 ms interrupt commit', () => {
  for (const interruptMs of [439, 440]) {
    const result = simulate('Daredevil', ['Dodge', { name: 'Channeled Vigor', interruptMs }, 'Double Strike'], {
      selectedSkills: ['Channeled Vigor']
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[1].cancelledBeforeCommit === true, interruptMs < 440);
    assert.equal(result.steps[2].start, 800 + interruptMs);
    assert.equal(
      result.events.some((event) => event.type === 'thief.state' && event.reason === 'Channeled Vigor'),
      interruptMs >= 440
    );
  }
});

test('Thief dodge retains its 800 ms lockout only after the 760 ms commit', () => {
  for (const interruptMs of [759, 760]) {
    const result = simulate('Daredevil', [{ name: 'Dodge', interruptMs }, 'Double Strike']);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[0].cancelledBeforeCommit === true, interruptMs < 760);
    assert.equal(result.steps[0].castLockoutEnd, interruptMs < 760 ? undefined : 800);
    assert.equal(result.steps[1].start, interruptMs < 760 ? interruptMs : 800);
    assert.equal(
      result.events.some((event) => event.type === 'damage' && event.skillName === 'Impaling Lotus'),
      interruptMs >= 760
    );
  }
});

test('Thousand Needles placement commits at 400 ms and arms from the interrupted end', () => {
  for (const interruptMs of [399, 400]) {
    const result = simulate('Core', [
      { name: 'Prepare Thousand Needles', interruptMs },
      'Thousand Needles',
      { name: '__wait', waitMs: 500 }
    ]);
    assert.equal(result.steps[0].cancelledBeforeCommit === true, interruptMs < 400);
    if (interruptMs < 400) {
      assert.match(result.warnings.join('\n'), /prepare Thousand Needles first/);
    } else {
      assert.deepEqual(result.warnings, []);
      assert.equal(result.steps[1].start, 3400);
      assert.ok(result.events.some((event) => event.type === 'damage' && event.skillName === 'Thousand Needles'));
    }
  }
});

test('preparations flip while arming, use Alacrity, and restore placement after activation', () => {
  for (const name of ['Thousand Needles', 'Pitfall']) {
    for (const alacrity of [false, true]) {
      const prepare = thiefCatalog.skillsByName.get(`Prepare ${name}`);
      const trigger = thiefCatalog.skillsByName.get(name);
      const config = { selectedSkills: [prepare.name], boons: { alacrity } };
      const before = simulate('Core', [], config);
      const placed = simulate('Core', [prepare.name], config);
      const triggered = simulate('Core', [prepare.name, name], config);
      const context = (result) => ({
        specialization: 'Core',
        professionState: result.endState.profession,
        time: result.duration
      });
      const tile = (result) =>
        displayedSkillTiles(
          {
            profession: thiefProfession,
            skills: thiefCatalog.skills,
            build: { rotation: [] },
            results: result
          },
          [prepare],
          context(result)
        )[0];

      // The child stays visible but unavailable during arming, then returns to its parent after use.
      for (const result of [before, placed, triggered]) assert.deepEqual(result.warnings, []);
      assert.equal(tile(before).id, prepare.id);
      assert.equal(tile(placed).id, trigger.id);
      assert.equal(tile(triggered).id, prepare.id);
      const availability = thiefProfession.ui.paletteSkillAvailability(context(placed), trigger);
      assert.equal(availability.available, false);
      assert.match(availability.message, /arming/);
      assert.ok(Math.abs(availability.retryAt - placed.duration - (alacrity ? 2.4 : 3)) < 1e-9);
      assert.equal(
        thiefProfession.ui.paletteSkillAvailability({ ...context(placed), time: availability.retryAt }, trigger)
          .available,
        true
      );
      assert.equal(thiefProfession.ui.paletteSkillAvailability(context(triggered), trigger).available, false);
      assert.equal(triggered.steps[1].start, Math.round(availability.retryAt * 1000));
    }
  }
});

test('Caltrops commits at 800 ms and its field survives the interrupted cast', () => {
  for (const interruptMs of [799, 800]) {
    const result = simulate('Core', [
      { name: 'Caltrops', interruptMs },
      // Observe through the last field pulse even when the cast ends before placement.
      { name: '__wait', waitMs: 11000 }
    ]);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[0].cancelledBeforeCommit === true, interruptMs < 800);
    const pulses = result.events.filter((event) => event.type === 'condition' && event.skillName === 'Caltrops');
    if (interruptMs < 800) {
      assert.equal(pulses.length, 0);
    } else {
      assert.equal(pulses.filter((event) => event.condition === 'Bleeding').length, 11);
      assert.equal(pulses.filter((event) => event.condition === 'Crippled').length, 5);
      assert.ok(pulses.every((event) => event.at > interruptMs / 1000));
    }
  }
});
