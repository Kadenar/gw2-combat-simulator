import assert from 'node:assert/strict';
import test from 'node:test';

import { skillBarDisplaySkill } from '#gw2/app/build/panels/skills.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(warriorProfession, {
  primaryWeapon: 'Sword',
  secondaryWeapon: 'Sword',
  selectedTraitIds: []
});

// Use real simulation projections so a missing runtime window cannot be hidden by a fabricated UI fixture.
function assertDisplayed(result, parentId, childId, expectedId) {
  const catalog = warriorProfession.catalog;
  const app = {
    build: { rotation: [] },
    profession: warriorProfession,
    activeCatalog: catalog,
    results: result
  };
  const parent = catalog.skillsById.get(parentId);
  const child = catalog.skillsById.get(childId);
  assert.deepEqual(
    displayedSkillTiles(app, [parent, child], { specialization: 'Core' }).map((skill) => skill.id),
    [expectedId]
  );
  assert.equal(skillBarDisplaySkill(app, parent).id, expectedId);
}

for (const [parentId, childId] of [
  [ID.IMPALE, ID.RIP],
  [ID.RIPOSTE, ID.ADRENALINE_RUSH]
]) {
  test(`${warriorProfession.catalog.skillsById.get(parentId).name} exposes one usable follow-up and restores its tile`, () => {
    const initial = simulate('Core', []);
    assertDisplayed(initial, parentId, childId, parentId);
    assert.equal(initial.planningState.availability[childId].ready, false);

    const armed = simulate('Core', [parentId]);
    assert.deepEqual(armed.warnings, []);
    assertDisplayed(armed, parentId, childId, childId);
    assert.equal(armed.planningState.availability[childId].ready, true);
    assert.equal(armed.planningState.availability[parentId].ready, false);

    const consumed = simulate('Core', [parentId, childId]);
    assert.deepEqual(consumed.warnings, []);
    assertDisplayed(consumed, parentId, childId, parentId);
    assert.equal(consumed.planningState.profession[STATE.AVAILABLE_FLIPS][childId], undefined);
    assert.equal(consumed.planningState.availability[childId].ready, false);
    assert.ok(consumed.planningState.cooldowns[parentId].remaining > 0);

    const expired = simulate('Core', [parentId, { type: 'wait', durationMs: 5000 }]);
    assertDisplayed(expired, parentId, childId, parentId);
    assert.equal(expired.planningState.availability[childId].ready, false);

    for (const rotation of [
      [childId],
      [parentId, childId, childId],
      [parentId, { type: 'wait', durationMs: 5000 }, childId]
    ]) {
      const rejected = simulate('Core', rotation);
      assert.equal(rejected.steps.at(-1).invalid, true);
      assert.match(rejected.warnings.at(-1).message, /requires an active/);
    }
  });
}

test('a completed Riposte block has no remaining Adrenaline Rush window', () => {
  // The follow-up belongs to the original block window, not a new window after the channel ends.
  const result = simulate('Core', [{ type: 'cast', skillId: ID.RIPOSTE, interruptAfterMs: 10000 }]);
  assertDisplayed(result, ID.RIPOSTE, ID.ADRENALINE_RUSH, ID.RIPOSTE);
  assert.equal(result.planningState.availability[ID.ADRENALINE_RUSH].ready, false);
});
