import assert from 'node:assert/strict';
import test from 'node:test';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { evtcProfessionMetadata, evtcSpecializationMetadata } from '#gw2/integrations/logs/evtc/profession-metadata.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { reconstructProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { agentOwners, eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { eiCustomAnimatedActions } from '#gw2/integrations/logs/evtc/rotation/ei-custom-casts.js';
import { eiMinionSpawns } from '#gw2/integrations/logs/evtc/rotation/ei-minions.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '../helpers/evtc-fixture.js';

function context(profession, specialization, events, agents = log().agents) {
  return {
    profile: ROTATION_PROFILES.find((p) => p.professionId === profession && p.specializationId === specialization),
    playerAddress: PLAYER,
    log: log({ events, agents }),
    catalog: null,
    recordedActions: [],
    timelineOriginMs: 0
  };
}

// Normalization may reorder tied signals, but each action must retain its own EVTC source identity.
test('tied Revenant stance and upkeep signals preserve source metadata in either raw order', () => {
  const events = [
    event({ stateChange: 69, target: PLAYER, skillId: 27890, buff: 1, value: 1000 }),
    event({ stateChange: 72, source: PLAYER, skillId: 27581, buff: 1 })
  ];
  for (const orderedEvents of [events, [...events].reverse()]) {
    const fixture = log({ agents: [{ ...log().agents[0], profession: 9, elite: 63 }], events: orderedEvents });
    const out = reconstructEvtcRotation(fixture, revenantCatalog, { includeCombatStart: false });
    const swap = out.actions.find((action) => action.skillId === -4);
    assert.ok(swap);
    assert.equal(swap.evidence, 'buff-transition');
    const c = { ...context('revenant', 'renegade', orderedEvents, fixture.agents), catalog: revenantCatalog };
    const recordedActions = eiInstantActions(c).sort((a, b) => a.eventIndex - b.eventIndex);
    const stance = recordedActions.find(
      (action) => action.eventIndex === orderedEvents.findIndex((source) => source.skillId === 27890)
    );
    assert.ok(stance);
    assert.equal(swap.rawSkillId, stance.rawSkillId);
    assert.equal(swap.eiRule, stance.eiRule);
    assert.equal(swap.metadataAccurate, stance.metadataAccurate);
    const normalized = reconstructProfessionActions({ ...c, recordedActions });
    const normalizedSwap = normalized.find((action) => action.canonicalSkillId === -4);
    assert.ok(normalizedSwap);
    assert.equal(normalizedSwap.eventIndex, stance.eventIndex);
    assert.equal(normalizedSwap.expectedDuration, stance.expectedDuration);
    assert.deepEqual(
      out.rotation.map((action) => action.skillId),
      [-4]
    );
  }
});

test('every profession imports incomplete evidence without inventing setup from snapshots, summons or dependent skills', () => {
  for (const profile of ROTATION_PROFILES) {
    const profession = Array.from({ length: 9 }, (_, i) => i + 1).find(
      (i) => evtcProfessionMetadata(i)?.id === profile.professionId
    );
    const elite = Array.from({ length: 100 }, (_, i) => i).find(
      (i) => evtcSpecializationMetadata(i, profile.professionId)?.id === profile.specializationId
    );
    const player = { ...log().agents[0], profession, elite };
    const minion = { ...player, address: 0x2000n, profession: 8108, elite: 0xffffffff };
    const fixture = log({
      agents: [player, minion],
      skills: [{ id: 900001, name: 'Dependent input' }],
      events: [
        event({ time: 0, stateChange: 18, source: minion.address, sourceInstance: 2, sourceMasterInstance: 1 }),
        event({ time: 0, stateChange: 18, target: PLAYER, skillId: 30136, value: 10000, buff: 1 }),
        event({ time: 0, stateChange: 67, skillId: 900001, value: 400 }),
        event({ time: 400, stateChange: 68, skillId: 900001, value: 400, activation: 5 }),
        event({ time: 800, skillId: 900002, value: 200 })
      ]
    });
    const out = reconstructEvtcRotation(fixture, {
      skills: [
        { id: 900001, name: 'Dependent input', castTimeMs: 400, effects: [] },
        { id: 900002, name: 'Missing instant', castTimeMs: 0, effects: [] }
      ]
    });
    assert.deepEqual(
      out.sourceActions.map((a) => a.rawSkillId),
      [900001],
      profile.specializationName
    );
    assert.equal(out.rotation.filter((c) => c.skillId != null).length, 1, profile.specializationName);
  }
});

test('buff gain finders reject initial snapshots and extensions, and use sliding duplicate suppression', () => {
  const c = context('mesmer', 'chronomancer', [
    event({ time: 0, stateChange: 18, target: PLAYER, skillId: 30136, value: 1000 }),
    ...[100, 140, 180, 240].map((time) =>
      event({ time, stateChange: 69, target: PLAYER, skillId: 30136, value: 1000 })
    ),
    event({ time: 400, stateChange: 70, target: PLAYER, skillId: 30136, value: 1000 })
  ]);
  assert.deepEqual(
    eiInstantActions(c)
      .filter((a) => a.rawSkillId === 29830)
      .map((a) => a.start),
    [100, 240]
  );
});

test('buff loss uses remove-all recipient orientation and Forge applies EI before-swap offsets', () => {
  const c = context('guardian', 'luminary', [
    event({ time: 100, stateChange: 69, target: PLAYER, skillId: 77142, value: 1000 }),
    event({ time: 100, stateChange: 11, target: 3n }),
    event({ time: 200, stateChange: 71, source: PLAYER, skillId: 77142 }),
    event({ time: 300, stateChange: 72, source: PLAYER, skillId: 77142 }),
    event({ time: 300, stateChange: 11, target: 4n })
  ]);
  const forge = eiInstantActions(c).filter((a) => [77073, 76616].includes(a.rawSkillId));
  assert.deepEqual(
    forge.map((a) => [a.rawSkillId, a.start]),
    [
      [77073, 99],
      [76616, 299]
    ]
  );
  assert.ok(forge.every((a) => a.metadataAccurate && a.castOrigin === 'skill' && a.eiRule));
});

test('custom animated buff finders retain their explicit initial-state exception without simulator backdating', () => {
  const c = context('guardian', 'willbender', [
    event({ time: 100, stateChange: 18, target: PLAYER, skillId: 62632, value: 500 })
  ]);
  const [cast] = eiCustomAnimatedActions(c);
  assert.deepEqual([cast.start, cast.end, cast.status], [-340, 160, 'completed']);
  assert.equal(
    eiInstantActions(c).some((a) => a.rawSkillId === 62603),
    false
  );
});

test('minion spawn inference needs an actual owned spawn rather than initial presence', () => {
  const minion = { ...log().agents[0], address: 0x2000n, profession: 15314, elite: 0xffffffff };
  const c = context(
    'necromancer',
    'reaper',
    [
      event({ time: 0, stateChange: 18, source: minion.address, sourceInstance: 2, sourceMasterInstance: 1 }),
      event({ time: 0, stateChange: 1 })
    ],
    [...log().agents, minion]
  );
  assert.equal(eiMinionSpawns(c).length, 0);
  const spawned = {
    ...c,
    log: {
      ...c.log,
      events: [
        ...c.log.events,
        event({ time: 200, stateChange: 6, source: minion.address, sourceInstance: 2, sourceMasterInstance: 1 })
      ]
    }
  };
  assert.equal(eiMinionSpawns(spawned)[0]?.start, 200);
});

// Effect evidence must satisfy the full finder, including version, destination and secondary signal.
test('effect finders require their secondary evidence and half-open build gate', () => {
  const primary = 'CA9899BBDAC8C348B9011250945C9A7B';
  const secondary = 'FF3DE8D09A6FE846B24A7CDFACB8078C';
  const mapping = (id, guid) =>
    event({
      stateChange: 46,
      skillId: id,
      source: Buffer.from(guid, 'hex').readBigUInt64LE(0),
      target: Buffer.from(guid, 'hex').readBigUInt64LE(8),
      sourceInstance: 0
    });
  const base = [mapping(1, primary), mapping(2, secondary), event({ time: 100, stateChange: 51, skillId: 1 })];
  const find = (build, extra = []) =>
    eiInstantActions(
      context('elementalist', 'evoker', [
        event({ stateChange: 15, source: BigInt(build), sourceInstance: 0 }),
        ...base,
        ...extra
      ])
    ).filter((a) => a.rawSkillId === 77038);
  const matching = event({ time: 109, stateChange: 51, skillId: 2 });
  assert.equal(find(190000).length, 0);
  assert.equal(find(189999, [matching]).length, 0);
  assert.equal(find(190000, [{ ...matching, time: 110 }]).length, 0);
  assert.equal(find(190000, [{ ...matching, source: 0x9999n }]).length, 0);
  assert.equal(find(190000, [matching])[0]?.start, 100);
});

test('minion cast finder requires owned animation evidence and rejects ambiguous instance reuse', () => {
  const minion = { ...log().agents[0], address: 0x2000n, profession: 123, elite: 0xffffffff };
  const events = [
    event({ time: 0, stateChange: 1 }),
    event({
      time: 100,
      stateChange: 67,
      source: minion.address,
      sourceInstance: 2,
      sourceMasterInstance: 1,
      skillId: 76882,
      value: 200
    }),
    event({
      time: 300,
      stateChange: 68,
      source: minion.address,
      sourceInstance: 2,
      sourceMasterInstance: 1,
      skillId: 76882,
      value: 200,
      activation: 5
    })
  ];
  const c = context('elementalist', 'evoker', events, [...log().agents, minion]);
  assert.equal(eiInstantActions(c).find((a) => a.rawSkillId === 76643)?.start, 100);
  const stranger = { ...log().agents[0], address: 0x3000n };
  const ambiguous = {
    ...c.log,
    agents: [...c.log.agents, stranger],
    events: [...events, event({ source: stranger.address, sourceInstance: 1 })]
  };
  assert.equal(agentOwners(ambiguous).has(minion.address), false);
  assert.equal(
    eiInstantActions({ ...c, log: ambiguous }).some((a) => a.rawSkillId === 76643),
    false
  );
});

test('custom animation suppression requires a decoded cast rather than a rejected stop', () => {
  const c = context('guardian', 'willbender', [
    event({ time: 0, stateChange: 1 }),
    event({ time: 100, stateChange: 68, skillId: 62603, value: 10, activation: 5 }),
    event({ time: 200, stateChange: 69, target: PLAYER, skillId: 62632, value: 500 })
  ]);
  assert.equal(eiCustomAnimatedActions(c).find((a) => a.rawSkillId === 62603)?.start, -240);
  const real = {
    ...c,
    log: {
      ...c.log,
      events: [
        event({ time: 0, stateChange: 67, skillId: 62603, value: 100 }),
        event({ time: 100, stateChange: 68, skillId: 62603, value: 100, activation: 5 }),
        ...c.log.events.slice(2)
      ]
    }
  };
  assert.equal(
    eiCustomAnimatedActions(real).some((a) => a.rawSkillId === 62603),
    false
  );
});
