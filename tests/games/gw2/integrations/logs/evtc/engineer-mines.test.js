// Exercise EI's mine identity and evidence requirements without copying a full combat log.
import assert from 'node:assert/strict';
import test from 'node:test';

import { eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { engineerCatalog } from '#gw2/professions/engineer/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';
import { evtcReconstructionContext } from '#tests/helpers/evtc-reconstruction-context.js';

const mappings = [
  '885B7AAA68F09E48A926BFFE488DB5AD',
  '1B3ACEE36F61DE42AB1C24BD33B5B5AD',
  '2EE26B8656BD424B9BF9A7EA4CB0AA06',
  '997750CA2636154E9FFBFEE4AA51A970'
].map((guid, index) => {
  const bytes = Buffer.from(guid, 'hex');
  return event({
    stateChange: 46,
    skillId: index + 1,
    source: bytes.readBigUInt64LE(0),
    target: bytes.readBigUInt64LE(8)
  });
});
const explosion = (overrides = {}) => event({ time: 1000, stateChange: 60, skillId: 1, ...overrides });
const secondary = (overrides = {}) => explosion({ skillId: 2, ...overrides });
const mine = (overrides = {}) => event({ time: 500, stateChange: 60, skillId: 3, pad: 7, ...overrides });
const removal = (overrides = {}) => event({ time: 1000, stateChange: 61, pad: 7, ...overrides });
function context(events) {
  return evtcReconstructionContext({
    profile: { professionId: 'engineer', specializationId: 'core' },
    playerAddress: PLAYER,
    catalog: engineerCatalog,
    recordedActions: [],
    log: log({
      agents: [{ ...log().agents[0], profession: 3, elite: 0 }],
      events: [...mappings, ...events]
    })
  });
}

const find = (events) => eiInstantActions(context(events));
const ids = (events) => find(events).map((action) => action.rawSkillId);

test('mine detonation requires both explosion effects from the selected caster', () => {
  assert.deepEqual(ids([explosion()]), []);
  assert.deepEqual(ids([secondary()]), []);
  assert.deepEqual(ids([event({ skillId: 6162, value: 1000 })]), []);
  assert.deepEqual(ids([explosion(), secondary({ source: 0x2000n })]), []);
  assert.deepEqual(ids([explosion({ source: 0x2000n }), secondary({ source: 0x2000n })]), []);
  for (const offset of [-10, -9, 0, 9, 10]) {
    assert.deepEqual(ids([explosion(), secondary({ time: 1000 + offset })]), Math.abs(offset) < 10 ? [-37] : []);
  }
});

test('dynamic mine ends distinguish Throw Mine, Mine Field, and unidentified precasts', () => {
  const visuals = [explosion(), secondary()];
  assert.deepEqual(ids(visuals), [-37]);
  assert.deepEqual(ids([mine(), ...visuals]), [-37]);
  assert.deepEqual(ids([mine(), removal(), ...visuals]), [6162]);
  assert.deepEqual(ids([mine({ skillId: 4 }), removal(), ...visuals]), [6166]);
  assert.deepEqual(ids([mine({ source: 0x2000n }), removal(), ...visuals]), [-37]);
  assert.deepEqual(ids([mine(), removal({ pad: 8 }), ...visuals]), [-37]);
  for (const offset of [-10, -9, 0, 9, 10]) {
    assert.deepEqual(
      ids([mine(), removal({ time: 1000 + offset }), ...visuals]),
      Math.abs(offset) < 10 ? [6162] : [-37]
    );
  }

  const action = find(visuals)[0];
  assert.equal(action.rawName, 'Detonate (Throw Mine / Mine Field)');
  assert.equal(action.metadataAccurate, false);
  assert.equal(action.castOrigin, 'skill');
  const ctx = context([event({ time: 0, stateChange: 1 }), ...visuals]);
  const result = reconstructEvtcRotation(ctx.log, engineerCatalog);
  assert.ok(result.rotation.some((command) => command.skillId === 6162));
  assert.ok(!result.rotation.some((command) => command.skillId === 6161));
});
