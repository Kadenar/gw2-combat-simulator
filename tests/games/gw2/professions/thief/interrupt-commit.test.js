import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession, thiefCatalog } from '#gw2/professions/thief/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';

const simulate = createObservedProfessionSimulator(thiefProfession, {
  primaryWeapon: 'Dagger',
  secondaryWeapon: 'Dagger',
  selectedSkillIds: [13028, 13026],
  selectedDodge: 'Lotus Training',
  target: { armor: 2597, conditions: {} },
  boons: { quickness: true }
});

test('preparations flip while arming, use Alacrity, and restore placement after activation', () => {
  for (const name of ['Thousand Needles', 'Pitfall']) {
    for (const alacrity of [false, true]) {
      const prepare = thiefCatalog.skillsByName.get(`Prepare ${name}`);
      const trigger = thiefCatalog.skillsByName.get(name);
      const config = { selectedSkillIds: [prepare.id], boons: { alacrity } };
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
      const availability = placed.planningState.availability[trigger.id];
      assert.equal(availability.ready, false);
      assert.match(availability.reason, /arming/);
      assert.ok(Math.abs(availability.retryAt - placed.rotationEndTime - 2.4) < 1e-9);
      assert.equal(
        simulate('Core', [prepare.name, { type: 'wait', durationMs: 2400 }], config).planningState.availability[
          trigger.id
        ].ready,
        true
      );
      assert.equal(triggered.planningState.availability[trigger.id].ready, false);
      assert.equal(triggered.steps[1].start, Math.round(availability.retryAt * 1000));
    }
  }
});
