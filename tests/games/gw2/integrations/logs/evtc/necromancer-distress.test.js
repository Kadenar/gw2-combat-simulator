import assert from 'node:assert/strict';
import test from 'node:test';
import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

const guid = Buffer.from('239BF9EA9B747B44ACC63B86DC49B0D0', 'hex');
const mapping = event({
  stateChange: 46,
  skillId: 77,
  source: guid.readBigUInt64LE(0),
  target: guid.readBigUInt64LE(8)
});
const visual = (overrides = {}) => event({ stateChange: 62, skillId: 77, ...overrides });
const removal = (overrides = {}) => event({ stateChange: 72, skillId: 72976, ...overrides });

// Minimal evidence isolates EI's corroboration and ownership rules without relying on a saved rotation.
function context(events, arcdpsBuild = '20260815') {
  return {
    profile: { professionId: 'necromancer', specializationId: 'ritualist' },
    playerAddress: PLAYER,
    catalog: necromancerCatalog,
    recordedActions: [],
    log: log({
      header: { ...log().header, arcdpsBuild },
      agents: [{ ...log().agents[0], profession: 8, elite: 76 }],
      events: [mapping, ...events]
    })
  };
}

const find = (events, build) =>
  eiInstantActions(context(events, build)).filter((action) => action.rawSkillId === 73116);

test('Distress requires both the caster effect and a nearby complete buff removal', () => {
  assert.deepEqual(find([visual()]), []);
  assert.deepEqual(find([removal()]), []);
  for (const offset of [-10, -9, 0, 9, 10]) {
    assert.equal(find([visual(), removal({ time: 1000 + offset })]).length, Math.abs(offset) < 10 ? 1 : 0);
  }

  for (const stateChange of [18, 69, 70, 71]) {
    assert.deepEqual(find([visual(), removal({ stateChange })]), []);
  }

  assert.deepEqual(find([visual(), removal({ skillId: 12345 })]), []);
  assert.deepEqual(find([visual({ source: 0x2000n }), removal()]), []);
  const wrongNamespace = context([visual(), removal()]);
  wrongNamespace.log.events[0] = { ...mapping, overstackValue: 1 };
  assert.deepEqual(eiInstantActions(wrongNamespace), []);
  // EI's removal predicate is global; only the visual supplies caster attribution.
  assert.equal(find([visual(), removal({ source: 0x2000n, target: 0x3000n })]).length, 1);
  const ctx = context([visual(), removal()]);
  ctx.profile = { professionId: 'mesmer', specializationId: 'core' };
  assert.ok(eiInstantActions(ctx).every((action) => action.rawSkillId !== 73116));
});

test('Distress accepts legacy complete removals but rejects legacy partial removals and applications', () => {
  const legacyRemoval = removal({ stateChange: 0, buff: 1, buffRemove: 1 });
  assert.equal(find([visual(), legacyRemoval], '20260401').length, 1);
  for (const buffRemove of [0, 2, 3]) {
    assert.deepEqual(find([visual(), { ...legacyRemoval, buffRemove }], '20260401'), []);
  }
});

test('Distress uses the shared sliding duplicate window and carries effect provenance into import', () => {
  const actions = find(
    [0, 40, 80, 130].flatMap((offset) => [visual({ time: 1000 + offset }), removal({ time: 1000 + offset })])
  );
  assert.deepEqual(
    actions.map((action) => action.start),
    [1000, 1130]
  );
  assert.equal(actions[0].eiRule, 'NecromancerHelper.EffectCastFinder(DistressSkill)');
  assert.equal(actions[0].evidence, 'effect');
  assert.equal(actions[0].metadataAccurate, false);
  assert.equal(actions[0].castOrigin, 'skill');
  const ctx = context([event({ stateChange: 1, time: 900 }), visual(), removal()]);
  const result = reconstructEvtcRotation(ctx.log, necromancerCatalog);
  assert.ok(result.rotation.some((command) => command.skillId === 73116));
});
