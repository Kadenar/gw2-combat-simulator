import assert from 'node:assert/strict';
import test from 'node:test';
import { antiquaryChakShieldActions } from '#gw2/integrations/logs/evtc/rotation/professions/thief.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

// Owned placement plus a fresh refund grant proves an instant shield without relying on every optional visual.
function shieldEvidence() {
  const guid = Buffer.from('1B48B91A5B0EC540BEA2765583412CBC', 'hex');
  return [
    event({ stateChange: 46, skillId: 77, source: guid.readBigUInt64LE(0), target: guid.readBigUInt64LE(8) }),
    event({ time: 1500, stateChange: 60, skillId: 77 }),
    event({ time: 1501, stateChange: 69, skillId: 78288, source: PLAYER, target: PLAYER, value: 12000, buff: 1 })
  ];
}

function context(events) {
  return {
    profile: { professionId: 'thief', specializationId: 'antiquary' },
    playerAddress: PLAYER,
    catalog: thiefCatalog,
    recordedActions: [],
    log: log({ agents: [{ ...log().agents[0], profession: 5, elite: 77 }], events })
  };
}

test('Chak Shield reconstruction requires owned corroboration and does not duplicate an existing cast', () => {
  const ctx = context(shieldEvidence());
  const actions = antiquaryChakShieldActions(ctx);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].rawSkillId, 76816);
  assert.equal(actions[0].eiRule, undefined);
  assert.deepEqual(antiquaryChakShieldActions({ ...ctx, recordedActions: actions }), []);
  const result = reconstructEvtcRotation(ctx.log, thiefCatalog);
  assert.ok(result.rotation.some((command) => command.skillId === 76816));
});

test('unrelated visuals, foreign grants, and initial snapshots cannot manufacture Chak Shield casts', () => {
  for (const events of [
    shieldEvidence().slice(0, 2),
    shieldEvidence().slice(1),
    shieldEvidence().map((e) => (e.stateChange === 69 ? { ...e, stateChange: 18 } : e)),
    shieldEvidence().map((e) => (e.stateChange === 69 ? { ...e, target: 99n } : e)),
    shieldEvidence().map((e) => (e.stateChange === 69 ? { ...e, source: 99n } : e)),
    shieldEvidence().map((e) => (e.stateChange === 60 ? { ...e, source: 99n } : e)),
    shieldEvidence().map((e) => (e.stateChange === 69 ? { ...e, time: 1600 } : e))
  ])
    assert.deepEqual(antiquaryChakShieldActions(context(events)), []);
});
