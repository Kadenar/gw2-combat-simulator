import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession, thiefCatalog } from '#gw2/professions/thief/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';

const simulate = createObservedProfessionSimulator(thiefProfession, {
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  selectedSkills: ['Caltrops', 'Prepare Thousand Needles'],
  selectedDodge: 'Lotus Training',
  target: { armor: 2597, conditions: {} },
  boons: { quickness: true }
});

// The accepted action records whether an interrupted cast stopped before its authored commit point.
const cancelled = (result, index) =>
  result.events.find((event) => event.type === 'action' && event.activationId === result.steps[index].activationId)
    .cancelled === true;

// Exercise cancellation on either side of the authored boundary without freezing the skill's current timing.
test('Channeled Vigor grants endurance only after commitment', () => {
  const skill = thiefCatalog.skillsByName.get('Channeled Vigor');
  const commitMs = skill.interruptCommitMs;
  const endurance = [];
  for (const interruptMs of [commitMs - 1, commitMs]) {
    // Starting empty keeps the restoration below capacity.
    const result = simulate('Daredevil', [{ name: 'Channeled Vigor', interruptMs }, 'Double Strike'], {
      selectedSkills: ['Channeled Vigor'],
      initialEndurance: 0
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(cancelled(result, 0), interruptMs < commitMs);
    assert.equal(result.steps[1].start, result.steps[0].start + interruptMs);
    endurance.push(result.planningState.profession.endurance);
  }

  // Regeneration differs by one millisecond; only the committed activation restores endurance.
  assert.ok(Math.abs(endurance[1] - endurance[0] - skill.resourceGain) < 0.01, String(endurance));
});

test('Thief dodge retains its full lockout only after commitment', () => {
  const commitMs = thiefCatalog.skillsByName.get('Dodge').interruptCommitMs;
  const fullDuration = simulate('Daredevil', ['Dodge']).steps[0].end;
  for (const interruptMs of [commitMs - 1, commitMs]) {
    const result = simulate('Daredevil', [{ name: 'Dodge', interruptMs }, 'Double Strike']);
    assert.deepEqual(result.warnings, []);
    assert.equal(cancelled(result, 0), interruptMs < commitMs);
    // A committed dodge keeps its full lockout; a cancelled one frees the lane at the interruption.
    assert.equal(result.steps[1].start, interruptMs < commitMs ? interruptMs : fullDuration);
    assert.equal(
      result.events.some((event) => event.type === 'damage' && event.skillName === 'Impaling Lotus'),
      interruptMs >= commitMs
    );
  }
});

test('Thousand Needles arms from the interrupted end only after placement commits', () => {
  const commitMs = thiefCatalog.skillsByName.get('Prepare Thousand Needles').interruptCommitMs;
  for (const interruptMs of [commitMs - 1, commitMs]) {
    const result = simulate('Core', [
      { name: 'Prepare Thousand Needles', interruptMs },
      'Thousand Needles',
      { name: '__wait', waitMs: 500 }
    ]);
    assert.equal(cancelled(result, 0), interruptMs < commitMs);
    if (interruptMs < commitMs) {
      assert.match(result.warnings.join('\n'), /prepare Thousand Needles first/);
    } else {
      assert.deepEqual(result.warnings, []);
      assert.equal(result.steps[1].start, result.steps[0].end + 3000);
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
        professionState: result.planningState.profession,
        time: result.rotationEndTime
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
      assert.ok(Math.abs(availability.retryAt - placed.rotationEndTime - (alacrity ? 2.4 : 3)) < 1e-9);
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

test('Caltrops preserves its field after a committed cancellation', () => {
  const commitMs = thiefCatalog.skillsByName.get('Caltrops').interruptCommitMs;
  const pulsesFor = (result) =>
    result.events.filter((event) => event.type === 'condition' && event.skillName === 'Caltrops');
  const full = pulsesFor(simulate('Core', ['Caltrops', { name: '__wait', waitMs: 11000 }]));
  assert.ok(full.length > 0);
  for (const interruptMs of [commitMs - 1, commitMs]) {
    const result = simulate('Core', [
      { name: 'Caltrops', interruptMs },
      // Observe through the last field pulse even when the cast ends before placement.
      { name: '__wait', waitMs: 11000 }
    ]);
    assert.deepEqual(result.warnings, []);
    assert.equal(cancelled(result, 0), interruptMs < commitMs);
    const pulses = pulsesFor(result);
    if (interruptMs < commitMs) {
      assert.equal(pulses.length, 0);
    } else {
      assert.deepEqual(pulses, full);
      assert.ok(pulses.every((event) => event.at > interruptMs / 1000));
    }
  }
});
