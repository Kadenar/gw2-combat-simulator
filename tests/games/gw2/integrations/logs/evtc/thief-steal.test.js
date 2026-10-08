import assert from 'node:assert/strict';
import test from 'node:test';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import {
  thiefStealActions,
  thiefThousandNeedlesActions
} from '#gw2/integrations/logs/evtc/rotation/professions/thief.js';
import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

const TARGET = 0x2000n;
const STEAL = 13014;

// Synthetic evidence isolates ownership, corroboration and duplicate handling without reproducing a saved rotation.
function mapping(skillId, guid) {
  const bytes = Buffer.from(guid, 'hex');
  return event({ stateChange: 46, skillId, source: bytes.readBigUInt64LE(0), target: bytes.readBigUInt64LE(8) });
}

function context(events, specialization = 'core') {
  return {
    profile: ROTATION_PROFILES.find((p) => p.professionId === 'thief' && p.specializationId === specialization),
    playerAddress: PLAYER,
    catalog: thiefCatalog,
    recordedActions: [],
    log: log({
      agents: [
        { ...log().agents[0], profession: 5, elite: 0 },
        { ...log().agents[0], address: TARGET, profession: 16199, elite: 0xffffffff }
      ],
      events
    })
  };
}

function stealEvidence() {
  return [
    mapping(77, 'A0F99AB672E77E459EBF8185867C4961'),
    event({ time: 1500, stateChange: 62, skillId: 77, target: TARGET }),
    ...[723, 723, 736, 736, 736].map((skillId) =>
      event({ time: 1500, stateChange: 69, skillId, target: TARGET, value: 10000, buff: 1 })
    )
  ];
}

test('corroborated Steal evidence becomes one owned input without claiming EI provenance', () => {
  const events = stealEvidence();
  events.push({ ...events[1], time: 1501 });
  const ctx = context(events);
  const actions = thiefStealActions(ctx);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].rawSkillId, STEAL);
  assert.equal(actions[0].evidence, 'effect');
  assert.deepEqual(thiefStealActions({ ...ctx, recordedActions: actions }), []);
  const result = reconstructEvtcRotation(ctx.log, thiefCatalog);
  assert.ok(result.rotation.some((command) => command.skillId === STEAL));
  assert.match(result.warnings.join('\n'), /corroborated profession-specific EVTC evidence/);
  assert.doesNotMatch(result.warnings.join('\n'), /Elite Insights rules/);
});

test('Steal inference rejects incomplete, unrelated, snapshot and wrong-specialization evidence', () => {
  const cases = [
    stealEvidence().slice(0, 2),
    stealEvidence().slice(1),
    stealEvidence().slice(0, -1),
    stealEvidence().map((e) => (e.stateChange === 69 ? { ...e, stateChange: 18 } : e)),
    stealEvidence().map((e) => (e.stateChange === 69 ? { ...e, source: TARGET } : e)),
    stealEvidence().map((e) => (e.stateChange === 69 ? { ...e, target: PLAYER } : e)),
    stealEvidence().map((e) => (e.stateChange === 69 ? { ...e, time: 1600 } : e)),
    stealEvidence().map((e) => (e.stateChange === 69 ? { ...e, value: 6000 } : e)),
    stealEvidence().map((e) => (e.stateChange === 62 ? { ...e, source: TARGET } : e)),
    stealEvidence().map((e) => (e.stateChange === 62 ? { ...e, stateChange: 60 } : e)),
    stealEvidence().map((e) => (e.stateChange === 46 ? { ...e, overstackValue: 1 } : e))
  ];
  for (const events of cases) assert.deepEqual(thiefStealActions(context(events)), []);
  for (const spec of ['deadeye', 'daredevil', 'specter', 'antiquary'])
    assert.deepEqual(thiefStealActions(context(stealEvidence(), spec)), []);
});

test('Thousand Needles requires both delayed same-owner effects after the generic hostile circle', () => {
  const events = [
    mapping(77, '2125A13079C1C5479C150926EB60A15D'),
    mapping(78, '9AF103E33FC235498190448A9496C98A'),
    mapping(79, 'B8DC8C6736C8E0439295A9DBBADC6296'),
    event({ time: 1500, stateChange: 60, skillId: 77 }),
    event({ time: 1780, stateChange: 60, skillId: 78 }),
    event({ time: 1780, stateChange: 60, skillId: 79 })
  ];
  const find = (rows) => eiInstantActions(context(rows)).filter((action) => action.rawSkillId === 56897);
  assert.equal(find(events).length, 1);
  assert.deepEqual(find(events.slice(0, -1)), []);
  assert.deepEqual(
    find(events.map((e) => (e.skillId === 79 && e.stateChange === 60 ? { ...e, source: TARGET } : e))),
    []
  );
  assert.deepEqual(find(events.map((e) => (e.skillId === 79 && e.stateChange === 60 ? { ...e, time: 1500 } : e))), []);
});

// A wider visual window requires independent owned damage, so unrelated circles cannot invent a preparation trigger.
test('Thousand Needles tolerates delayed visuals only with corroborated owned damage and no existing input', () => {
  const events = [
    mapping(77, '2125A13079C1C5479C150926EB60A15D'),
    mapping(78, '9AF103E33FC235498190448A9496C98A'),
    mapping(79, 'B8DC8C6736C8E0439295A9DBBADC6296'),
    event({ time: 1500, stateChange: 60, skillId: 77 }),
    event({ time: 1806, stateChange: 60, skillId: 78 }),
    event({ time: 1809, stateChange: 60, skillId: 79 }),
    event({ time: 1809, skillId: 56897, target: TARGET, value: 1000 })
  ];
  const ctx = context(events);
  const actions = thiefThousandNeedlesActions(ctx);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].rawSkillId, 56897);
  assert.equal(actions[0].eiRule, undefined);
  assert.deepEqual(thiefThousandNeedlesActions({ ...ctx, recordedActions: actions }), []);
  assert.ok(reconstructEvtcRotation(ctx.log, thiefCatalog).rotation.some((command) => command.skillId === 56898));
  const standard = context(events.map((e) => (e.time > 1500 ? { ...e, time: 1780 } : e)));
  const eiActions = eiInstantActions(standard);
  assert.ok(eiActions.some((action) => action.eiRule === 'ThiefHelper.EffectCastFinder(ThousandNeedles)'));
  assert.deepEqual(thiefThousandNeedlesActions({ ...standard, recordedActions: eiActions }), []);
  for (const rows of [
    events.slice(0, -1),
    events.filter((e) => e.skillId !== 79),
    events.map((e) => (e.skillId === 56897 ? { ...e, source: TARGET } : e)),
    events.map((e) => (e.skillId === 56897 ? { ...e, value: 0 } : e)),
    events.map((e) => (e.skillId === 79 && e.stateChange === 60 ? { ...e, source: TARGET } : e)),
    events.map((e) => (e.skillId === 79 && e.stateChange === 60 ? { ...e, time: 1900 } : e))
  ])
    assert.deepEqual(thiefThousandNeedlesActions(context(rows)), []);
});

// A recording can omit the generic circle; both specific impact effects and owned damage still identify one trigger.
test('Thousand Needles recovers a missing circle only from paired owned impact evidence', () => {
  const events = [
    mapping(78, '9AF103E33FC235498190448A9496C98A'),
    mapping(79, 'B8DC8C6736C8E0439295A9DBBADC6296'),
    event({ time: 1780, stateChange: 60, skillId: 78 }),
    event({ time: 1780, stateChange: 60, skillId: 79 }),
    event({ time: 1780, skillId: 56897, target: TARGET, value: 1000 })
  ];
  const ctx = context(events);
  assert.ok(!eiInstantActions(ctx).some((action) => action.rawSkillId === 56897));
  const actions = thiefThousandNeedlesActions(ctx);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].rawSkillId, 56897);
  assert.ok(actions[0].start < events.at(-1).time, 'the activation must precede its corroborating impact');
  assert.equal(actions[0].eiRule, undefined);
  assert.deepEqual(thiefThousandNeedlesActions({ ...ctx, recordedActions: actions }), []);
  for (const rows of [
    events.slice(0, -1),
    events.filter((event) => event.skillId !== 79),
    events.map((event) => (event.skillId === 56897 ? { ...event, source: TARGET } : event)),
    events.map((event) => (event.skillId === 56897 ? { ...event, value: 0 } : event)),
    events.map((event) => (event.skillId === 79 && event.stateChange === 60 ? { ...event, source: TARGET } : event)),
    events.map((event) => (event.skillId === 79 && event.stateChange === 60 ? { ...event, time: 2000 } : event))
  ])
    assert.deepEqual(thiefThousandNeedlesActions(context(rows)), []);
});
