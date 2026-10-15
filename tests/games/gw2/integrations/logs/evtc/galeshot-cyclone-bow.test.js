import assert from 'node:assert/strict';
import test from 'node:test';
import { galeshotCycloneBowActions } from '#gw2/integrations/logs/evtc/rotation/professions/galeshot.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

// Minimal bar-change scenarios protect form ownership, not the shape or timing of a benchmark rotation.
function action(start, skillId, extra = {}) {
  return {
    start,
    end: start,
    rawSkillId: skillId,
    rawName: rangerCatalog.skills.find((skill) => skill.id === skillId)?.name ?? 'Swap Weapons',
    status: 'instant',
    evidence: 'state-change',
    eventIndex: start,
    ...extra
  };
}

function context(recordedActions, specializationId = 'galeshot') {
  return {
    log: log(),
    playerAddress: PLAYER,
    profile: ROTATION_PROFILES.find(
      (profile) => profile.professionId === 'ranger' && profile.specializationId === specializationId
    ),
    catalog: rangerCatalog,
    recordedActions
  };
}

test('Cyclone Bow bar changes become form transitions without changing equipped weapon swaps', () => {
  const enter = action(1000, 0, { weaponSet: 2 });
  const bow = action(1500, ID.BLUSTER);
  const exit = action(2500, 0, { weaponSet: 4 });
  const swap = action(3000, 0, { weaponSet: 5 });
  const actions = galeshotCycloneBowActions(context([enter, bow, exit, swap]));
  assert.equal(actions.find((item) => item.start === enter.start).rawSkillId, ID.SUMMON_CYCLONE_BOW);
  assert.equal(actions.find((item) => item.start === exit.start).rawSkillId, ID.DISMISS_CYCLONE_BOW);
  assert.equal(
    actions.find((item) => item.start === swap.start),
    swap
  );
  for (const item of actions.filter((item) =>
    [ID.SUMMON_CYCLONE_BOW, ID.DISMISS_CYCLONE_BOW].includes(item.rawSkillId)
  )) {
    assert.equal(item.weaponSet, undefined);
    assert.equal(item.isSwap, false);
  }
});

test('explicit Cyclone Bow evidence and matching bar signals describe only one transition', () => {
  const enter = action(999, ID.SUMMON_CYCLONE_BOW, { evidence: 'effect' });
  const exit = action(2499, ID.DISMISS_CYCLONE_BOW, { evidence: 'effect' });
  const actions = galeshotCycloneBowActions(
    context([
      enter,
      action(1000, 0, { weaponSet: 2 }),
      action(1500, ID.BLUSTER),
      exit,
      action(2500, 0, { weaponSet: 4 })
    ])
  );
  assert.deepEqual(
    actions.filter((item) => item.rawSkillId === ID.SUMMON_CYCLONE_BOW),
    [enter]
  );
  assert.deepEqual(
    actions.filter((item) => item.rawSkillId === ID.DISMISS_CYCLONE_BOW),
    [exit]
  );
  assert.ok(actions.every((item) => item.weaponSet == null));
});

test('a recording that starts in Cyclone Bow restores explicit form state before its first use', () => {
  const bow = action(1000, ID.BLUSTER, { evidence: 'animation', end: 1800 });
  const actions = galeshotCycloneBowActions(context([bow, action(2000, 0, { weaponSet: 4 })]));
  const enter = actions.find((item) => item.rawSkillId === ID.SUMMON_CYCLONE_BOW);
  assert.equal(enter.evidence, 'synthesized');
  assert.equal(enter.metadataAccurate, false);
  assert.equal(enter.start, bow.start, 'Unrecorded setup must not invent an earlier activation timestamp.');
  assert.ok(actions.indexOf(enter) < actions.indexOf(bow));
  assert.ok(actions.some((item) => item.rawSkillId === ID.DISMISS_CYCLONE_BOW));
});

test('unidentified bundles and other Ranger specializations are not treated as Cyclone Bow', () => {
  const actions = [action(1000, 0, { weaponSet: 2 }), action(2000, 0, { weaponSet: 4 })];
  assert.deepEqual(galeshotCycloneBowActions(context(actions)), actions);
  const other = [...actions, action(1500, ID.BLUSTER)];
  assert.equal(galeshotCycloneBowActions(context(other, 'druid')), other);
});

test('EVTC import preserves usable Cyclone Bow entry and exit without dismissal visuals', () => {
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 4, elite: 78 }],
    skills: [{ id: ID.BLUSTER, name: 'Bluster' }],
    events: [
      event({ time: 1000, stateChange: 1 }),
      event({ time: 1100, stateChange: 11, target: 2n, value: 4 }),
      event({ time: 1500, stateChange: 67, skillId: ID.BLUSTER, value: 700 }),
      event({ time: 2200, stateChange: 68, skillId: ID.BLUSTER, value: 700, activation: 3 }),
      event({ time: 3000, stateChange: 11, target: 4n, value: 2 }),
      event({ time: 4000, stateChange: 2 })
    ]
  });
  const imported = reconstructEvtcRotation(fixture, rangerCatalog);
  let inBow = false;
  for (const command of imported.rotation) {
    if (command.skillId === ID.SUMMON_CYCLONE_BOW) inBow = true;
    if (command.skillId === ID.BLUSTER) assert.equal(inBow, true);
    if (command.skillId === ID.DISMISS_CYCLONE_BOW) inBow = false;
    assert.notEqual(command.skillId, -3, 'Bundle changes must not spend equipped-weapon swaps.');
  }

  assert.ok(imported.rotation.some((command) => command.skillId === ID.SUMMON_CYCLONE_BOW));
  assert.ok(imported.rotation.some((command) => command.skillId === ID.DISMISS_CYCLONE_BOW));
  assert.equal(inBow, false);
  const simulated = runRanger(imported.rotation, { specialization: 'Galeshot', initialArrows: 8 });
  assert.deepEqual(simulated.warnings, []);
});
