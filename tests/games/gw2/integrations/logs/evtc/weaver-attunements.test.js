import assert from 'node:assert/strict';
import test from 'node:test';
import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/reconstruct.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

// Minimal raw component buffs exercise EI preprocessing independently of saved rotations and catalog skill names.
function context(modern, events) {
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 6, elite: 56 }],
    skills: [],
    events
  });
  fixture.header.arcdpsBuild = modern ? '20260815' : '20260429';
  return {
    log: fixture,
    playerAddress: PLAYER,
    profile: ROTATION_PROFILES.find((profile) => profile.specializationId === 'weaver'),
    catalog: elementalistCatalog,
    recordedActions: []
  };
}

const apply = (modern, skillId, time = 100, extras = {}) =>
  event({
    time,
    skillId,
    target: PLAYER,
    stateChange: modern ? 69 : 0,
    buff: 1,
    value: 10000,
    ...extras
  });

test('Weaver composes attunement evidence within a strict, anchored 10 ms window', () => {
  for (const modern of [false, true]) {
    const find = (events) => eiInstantActions(context(modern, events));
    const major = apply(modern, 40926);
    const minor = apply(modern, 43370, 109);
    const [mixed] = find([minor, major]);
    assert.equal(mixed.rawSkillId, -5);
    assert.equal(mixed.start, 100);
    assert.equal(mixed.rawName, 'Fire Water Attunement');
    assert.equal(mixed.canonicalSkillId, ID.FIRE_ATTUNEMENT);
    assert.deepEqual(find([major]), []);
    assert.deepEqual(find([minor]), []);
    assert.deepEqual(find([major, { ...minor, time: 110 }]), []);
    assert.deepEqual(find([major, { ...minor, target: 0x2000n }]), []);
    // The window is anchored to 100, so 118 must not overwrite the first group's primary element.
    assert.deepEqual(
      find([major, minor, apply(modern, 43236, 118)]).map((action) => action.rawSkillId),
      [-5]
    );
  }
});

test('Weaver suppresses component duplicates and preserves EI dual, snapshot, and sliding-window semantics', () => {
  for (const modern of [false, true]) {
    const c = context(modern, [
      apply(modern, 5585, 100),
      apply(modern, 40926, 100),
      apply(modern, 43370, 100),
      apply(modern, 40926, 140),
      apply(modern, 43370, 140),
      apply(modern, 40926, 180),
      apply(modern, 43370, 180),
      apply(modern, 40926, 230),
      apply(modern, 43370, 230),
      apply(modern, 5586, 300),
      apply(modern, 40926, 400),
      apply(modern, 43370, 400),
      apply(modern, 42264, 400),
      apply(modern, 40926, 500, { stateChange: 18 }),
      apply(modern, 43370, 500, { stateChange: 18 })
    ]);
    const original = structuredClone(c.log);
    const actions = eiInstantActions(c);
    assert.deepEqual(
      actions.map((action) => [action.rawSkillId, action.start]).sort((a, b) => a[1] - b[1]),
      [
        [-5, 100],
        [-5, 230],
        [41166, 300],
        [42264, 400],
        [-5, 500]
      ]
    );
    assert.deepEqual(c.log, original);
  }
});

test('Weaver removal and extension evidence can anchor a group but cannot supply a missing attunement', () => {
  for (const modern of [false, true]) {
    const removal = event({ time: 100, skillId: 43470, stateChange: modern ? 72 : 0, buffRemove: 1 });
    const extension = apply(modern, 43370, 100, modern ? { stateChange: 70 } : { offcycle: 1 });
    for (const anchor of [removal, extension]) {
      assert.deepEqual(eiInstantActions(context(modern, [anchor, apply(modern, 40926, 109)])), []);
      const actions = eiInstantActions(context(modern, [anchor, apply(modern, 40926, 109), apply(modern, 43370, 109)]));
      assert.equal(actions[0].start, 100);
      assert.equal(actions[0].rawSkillId, -5);
    }
  }
});

test('Weaver reconstruction replays synthetic Fire/Water as an attunement and retains genuine dodge', () => {
  const c = context(true, [
    apply(true, 40926, 100),
    apply(true, 43370, 100),
    event({ time: 1000, stateChange: 67, skillId: 23275, value: 750 }),
    event({ time: 1750, stateChange: 68, skillId: 23275, value: 750, activation: 5 })
  ]);
  const imported = reconstructEvtcRotation(c.log, elementalistCatalog);
  const attunement = imported.actions.find((action) => action.rawSkillId === -5);
  assert.equal(attunement.skillId, ID.FIRE_ATTUNEMENT);
  assert.equal(attunement.kind, 'profession-skill');
  assert.equal(imported.actions.find((action) => action.rawSkillId === 23275).skillId, SHARED_SKILL_IDS.DODGE);
  const simulation = simulateGw2({
    profession: elementalistProfession,
    rotation: imported.rotation,
    config: defaultSimulationConfig({ specialization: 'Weaver', startAttunement: 'Water', secondaryAttunement: 'Air' })
  });
  assert.equal(simulation.planningState.profession.primaryAttunement, 'Fire');
  assert.equal(simulation.planningState.profession.secondaryAttunement, 'Water');
  assert.equal(
    simulation.steps.some((step) => step.invalid),
    false
  );
});

test('Weaver Unravel consumes its synthetic dual transition while other Elementalists keep ordinary buff inference', () => {
  const c = context(true, [
    event({ stateChange: 15, source: 203989n }),
    apply(true, 42683, 100),
    apply(true, 5585, 101)
  ]);
  const imported = reconstructEvtcRotation(c.log, elementalistCatalog);
  assert.equal(
    imported.rotation.some((command) => command.skillId === ID.UNRAVEL),
    true
  );
  assert.equal(
    imported.rotation.some((command) => command.skillId === ID.FIRE_ATTUNEMENT),
    false
  );
  const core = {
    ...context(true, [apply(true, 5585)]),
    profile: ROTATION_PROFILES.find(
      (profile) => profile.professionId === 'elementalist' && profile.specializationId === 'core'
    )
  };
  assert.equal(eiInstantActions(core)[0].rawSkillId, ID.FIRE_ATTUNEMENT);
});
