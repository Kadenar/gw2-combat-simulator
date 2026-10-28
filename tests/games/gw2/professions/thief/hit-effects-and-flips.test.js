import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { thiefCatalog, thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { describeSimulationSkill } from '#gw2/app/shared/simulation-tooltip.js';
import { thiefTooltips } from '#gw2/professions/thief/app/tooltips.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';

const simulate = createObservedProfessionSimulator(thiefProfession, {
  primaryWeapon: 'Staff',
  selectedSkillIds: [13028, 30868],
  target: { armor: 2597, conditions: {} }
});

// Tooltips must read the selected charge grant, including edited balance data.
test('Shadow Strike tooltip describes the selected Repeater grant', () => {
  const current = { catalog: thiefCatalog };
  for (const [uses, durationSec] of [
    [3, 10],
    [2, 7]
  ]) {
    const catalog = withSkill(current.catalog, ID.SHADOW_STRIKE, {
      sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.REPEATER_ID_59526, uses, durationSec } }]
    });
    const tooltip = describeSimulationSkill(
      { ...current, catalog },
      catalog.skillsById.get(ID.SHADOW_STRIKE),
      thiefTooltips
    );
    const facts = new Map(tooltip.facts.map(({ name, detail }) => [name, detail]));
    assert.equal(facts.get('Repeater charges'), String(uses));
    assert.equal(facts.get('Repeater duration'), `${durationSec}s`);
    assert.equal(facts.has('Repeater initiative cost'), false);
    assert.match(tooltip.description, /unused charges expire together/);
  }
});

// Exercise live weapon availability and its projected state rather than duplicating the authored charge grant.
test('Shadow Strike grants three Repeater activations before restoring the opener', () => {
  const config = { primaryWeapon: 'Pistol', secondaryWeapon: 'Dagger' };
  const repeater = { type: 'cast', skillId: ID.REPEATER_ID_59526 };
  const rotation = ['Shadow Strike'];
  for (const remaining of [3, 2, 1, 0]) {
    const result = simulate('Core', rotation, config);
    assert.deepEqual(result.warnings, []);
    const window = result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.REPEATER_ID_59526];
    assert.equal(window?.remainingUses ?? 0, remaining);

    if (window) assert.equal(window.expiresAt - window.availableAt, 10);

    if (remaining) {
      const blockedParent = simulate('Core', [...rotation, 'Shadow Strike'], config);
      assert.ok(blockedParent.warnings.some(({ message }) => /active follow-up/.test(message)));
    }

    rotation.push(repeater);
  }

  const exhausted = simulate('Core', rotation, config);
  assert.ok(exhausted.warnings.some(({ message }) => /opening dual-wield skill/.test(message)));
  const refreshed = simulate('Core', [...rotation.slice(0, -1), 'Shadow Strike'], config);
  assert.deepEqual(refreshed.warnings, []);
  assert.equal(refreshed.planningState.profession[STATE.AVAILABLE_FLIPS][ID.REPEATER_ID_59526].remainingUses, 3);
});

test('Repeater charges expire together and activation spends a charge even when interrupted', () => {
  const config = { primaryWeapon: 'Pistol', secondaryWeapon: 'Dagger' };
  const repeater = { type: 'cast', skillId: ID.REPEATER_ID_59526 };
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  const late = simulate('Core', ['Shadow Strike', wait(8000), repeater], config);
  assert.deepEqual(late.warnings, []);
  assert.equal(late.planningState.profession[STATE.AVAILABLE_FLIPS][ID.REPEATER_ID_59526].remainingUses, 2);
  const lateWindow = late.planningState.profession[STATE.AVAILABLE_FLIPS][ID.REPEATER_ID_59526];
  assert.equal(lateWindow.expiresAt - lateWindow.availableAt, 10);
  for (const spent of [[], [repeater]]) {
    const expired = simulate('Core', ['Shadow Strike', ...spent, wait(10000), repeater], config);
    assert.equal(expired.planningState.profession[STATE.AVAILABLE_FLIPS][ID.REPEATER_ID_59526], undefined);
    assert.ok(expired.warnings.some(({ message }) => /opening dual-wield skill/.test(message)));
  }

  const interrupted = simulate('Core', ['Shadow Strike', { ...repeater, interruptAfterMs: 100 }], config);
  assert.deepEqual(interrupted.warnings, []);
  assert.equal(interrupted.planningState.profession[STATE.AVAILABLE_FLIPS][ID.REPEATER_ID_59526].remainingUses, 2);
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
    }
  }
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
    const context = {
      specialization: 'Daredevil',
      professionState: result.planningState.profession,
      time: result.rotationEndTime
    };
    const app = { profession: thiefProfession, activeCatalog: thiefCatalog, build: { rotation: [] }, results: result };
    assert.equal(displayedSkillTiles(app, [parent], context)[0].id, expected);
    assert.equal(
      Number(
        result.planningState.profession[STATE.AVAILABLE_FLIPS][thiefCatalog.skillsById.get(30693).id]?.expiresAt || 0
      ) > result.rotationEndTime,
      expected === ID.PALM_STRIKE
    );
  }

  // Consuming the window must reject a second follow-up through the scheduler.
  assert.match(
    simulate('Daredevil', ['Fist Flurry', 'Palm Strike', 'Palm Strike'])
      .warnings.map(({ message }) => message)
      .join('\n'),
    /Fist Flurry must connect/
  );
});
