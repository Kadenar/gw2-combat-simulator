import assert from 'node:assert/strict';
import test from 'node:test';
import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';

// Exercise EI's actual buff-give predicate independently of the number of venom charges in a real log.
const grant = (overrides = {}) =>
  event({ stateChange: 69, buff: 1, skillId: 13036, target: PLAYER, value: 24000, ...overrides });
function context(events) {
  return {
    profile: { professionId: 'thief', specializationId: 'core' },
    playerAddress: PLAYER,
    catalog: thiefCatalog,
    recordedActions: [],
    log: log({
      agents: [
        { ...log().agents[0], profession: 5, elite: 0 },
        { ...log().agents[0], address: 0x3000n, profession: 1, elite: 0xffffffff }
      ],
      events
    })
  };
}

const find = (events) => eiInstantActions(context(events)).filter((action) => action.rawSkillId === 13037);

test('Spider Venom uses EI recipient and strict self-duration checks without requiring six charges', () => {
  for (const value of [23991, 24000, 24009]) assert.equal(find([grant({ value })]).length, 1);
  for (const value of [23990, 24010, 30000]) assert.deepEqual(find([grant({ value })]), []);
  assert.equal(find([grant({ value: 30000, target: 0x2000n })]).length, 1);
  for (const change of [{ source: 0x2000n }, { stateChange: 18 }, { stateChange: 70 }, { stateChange: 71 }])
    assert.deepEqual(find([grant(change)]), []);
  const [action] = find([grant()]);
  assert.equal(action.eiRule, 'ThiefHelper.BuffGiveCastFinder(SpiderVenomSkill)');
  assert.equal(action.metadataAccurate, false);
  assert.equal(action.castOrigin, 'skill');
  const ctx = context([grant()]);
  assert.ok(reconstructEvtcRotation(ctx.log, thiefCatalog).rotation.some((command) => command.skillId === 13037));
});

test('Spider Venom applies EI sliding duplicate filtering only to qualifying grants', () => {
  const actions = find([0, 40, 80, 130].map((offset) => grant({ time: 1000 + offset })));
  assert.deepEqual(
    actions.map((action) => action.start),
    [1000, 1130]
  );
  const separated = find([grant(), grant({ time: 1040, value: 30000 }), grant({ time: 1050 })]);
  assert.deepEqual(
    separated.map((action) => action.start),
    [1000, 1050]
  );
});

test('Spider Venom checks raw recipients before attributing owned minion grants to the player', () => {
  const minion = 0x3000n;
  const base = event({ stateChange: 1 });
  const owned = grant({ source: minion, target: minion, sourceInstance: 3, sourceMasterInstance: 1 });
  assert.equal(find([base, owned]).length, 1);
  assert.deepEqual(find([base, { ...owned, value: 30000 }]), []);
  assert.equal(find([base, { ...owned, target: PLAYER, value: 30000 }]).length, 1);
});
