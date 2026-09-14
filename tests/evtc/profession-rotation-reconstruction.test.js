import assert from 'node:assert/strict';
import test from 'node:test';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/lib/rotation/profiles.js';
import { evtcProfessionMetadata, evtcSpecializationMetadata } from '#gw2/integrations/logs/evtc/profession-metadata.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { reconstructProfessionActions } from '#gw2/integrations/logs/evtc/rotation/professions/index.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { agentOwners, eiInstantActions } from '#gw2/integrations/logs/evtc/rotation/ei-inference.js';
import { eiCustomAnimatedActions } from '#gw2/integrations/logs/evtc/rotation/ei-custom-casts.js';
import {
  eiMesmerPhaseRetreat,
  eiMesmerShatters,
  eiMinionSpawns
} from '#gw2/integrations/logs/evtc/rotation/ei-minions.js';
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

test('Mesmer shatter loading rejects matching clone visuals using packed ground coordinates', () => {
  const mapping = (skillId, guid) =>
    event({
      stateChange: 46,
      skillId,
      source: Buffer.from(guid, 'hex').readBigUInt64LE(0),
      target: Buffer.from(guid, 'hex').readBigUInt64LE(8)
    });
  const mappings = [mapping(77, '52F65A4D9970954BA849CB57A46A65A8'), mapping(78, '5FA6527231BB8041AC783396142C6200')];
  // The packed coordinates are valid even when orientation bytes happen to encode a float NaN.
  const visual = event({ time: 100, stateChange: 60, skillId: 77, target: 0x00030002ffffn, value: 0x7fc00000 });
  const find = (extra = [], overrides = {}) =>
    eiMesmerShatters(context('mesmer', 'mirage', [...mappings, { ...visual, ...overrides }, ...extra]));
  assert.equal(find()[0]?.rawSkillId, 10190);
  assert.deepEqual(find([{ ...visual, skillId: 78 }]), []);
  assert.equal(find([{ ...visual, skillId: 78, target: visual.target + (1n << 32n) }])[0]?.rawSkillId, 10190);
  assert.equal(find([{ ...visual, skillId: 78, time: 110 }])[0]?.rawSkillId, 10190);
  assert.deepEqual(find([], { source: 0x9999n }), []);
  assert.deepEqual(eiMesmerShatters(context('mesmer', 'virtuoso', [...mappings, visual])), []);
});

test('Phase Retreat loading requires a matching teleport and newly owned staff clone', () => {
  const guid = Buffer.from('C34E250B01FF534292EE6AB36D768337', 'hex');
  const clone = { ...log().agents[0], address: 0x2000n, profession: 8111, elite: 0xffffffff };
  const base = [
    event({ time: 0, stateChange: 1 }),
    event({ stateChange: 46, skillId: 77, source: guid.readBigUInt64LE(0), target: guid.readBigUInt64LE(8) }),
    event({ time: 100, stateChange: 62, skillId: 77, source: 0n, target: PLAYER })
  ];
  const spawn = event({ time: 100, stateChange: 6, source: clone.address, sourceInstance: 2, sourceMasterInstance: 1 });
  const find = (extra) =>
    eiMesmerPhaseRetreat(context('mesmer', 'mirage', [...base, ...extra], [...log().agents, clone]));
  assert.equal(find([spawn])[0]?.rawSkillId, 10310);
  assert.deepEqual(find([]), []);
  assert.deepEqual(find([{ ...spawn, time: 130 }]), []);
  assert.deepEqual(find([{ ...spawn, sourceMasterInstance: 0 }]), []);
  assert.deepEqual(find([spawn, event({ time: 100, stateChange: 71, skillId: 10353 })]), []);
});

test('Mirage cloak normalization preserves endurance by retaining the represented shatter or mirror source', () => {
  const cloak = {
    start: 100,
    end: 100,
    rawSkillId: -17,
    rawName: 'Unknown -17',
    eventIndex: 0,
    status: 'instant',
    evidence: 'buff-transition'
  };
  const c = context('mesmer', 'mirage', []);
  c.recordedActions = [cloak];
  assert.equal(reconstructProfessionActions(c)[0]?.canonicalSkillId, -1);
  c.log.events = [event({ time: 100, skillId: 44677, value: 100 })];
  assert.equal(reconstructProfessionActions(c)[0]?.canonicalSkillId, -2);
  c.log.events = [];
  c.recordedActions = [{ ...cloak, rawSkillId: 10190, rawName: 'Cry of Frustration' }, cloak];
  const actions = reconstructProfessionActions(c);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].rawSkillId, 10190);
});

for (const [name, effectGuid, combinedId, normalId, finalId] of [
  ['Solace', '8F0C77784AFD7F40B27446617DC05CDC', -20, 41475, 42960],
  ['Potence', '95B52793B838524AB237EB9FED7834BF', -22, 42983, 41988]
]) {
  test(`Firebrand ${name} effect evidence resolves a complete charge burst without replacing source identity`, () => {
    const guid = Buffer.from(effectGuid, 'hex');
    const source = context('guardian', 'firebrand', [
      event({ stateChange: 15, source: 141374n }),
      event({ stateChange: 46, skillId: 77, source: guid.readBigUInt64LE(0), target: guid.readBigUInt64LE(8) }),
      ...[100, 1100, 2100].map((time) => event({ time, stateChange: 51, skillId: 77, source: 0n, target: PLAYER }))
    ]);
    source.catalog = guardianCatalog;
    source.recordedActions = eiInstantActions(source);
    const actions = reconstructProfessionActions(source);
    assert.deepEqual(
      actions.map((action) => action.canonicalSkillId),
      [normalId, normalId, finalId]
    );
    assert.ok(actions.every((action) => action.rawSkillId === combinedId && action.evidence === 'effect'));
  });
}

test('Firebrand effect finders distinguish mantra charges using nearby credited hits', () => {
  // An effect supplies the cast timestamp; only same-owner damage strictly inside EI's tolerance identifies its charge.
  const guid = Buffer.from('AF2B09AC1145AA4880B967C32A11E81C', 'hex');
  const mapping = event({
    stateChange: 46,
    skillId: 77,
    source: guid.readBigUInt64LE(0),
    target: guid.readBigUInt64LE(8)
  });
  const effect = event({ time: 100, stateChange: 51, skillId: 77, source: 0n, target: PLAYER });
  const find = (build, extra = [], overrides = {}) =>
    eiInstantActions(
      context('guardian', 'firebrand', [
        event({ stateChange: 15, source: BigInt(build) }),
        mapping,
        { ...effect, ...overrides },
        ...extra
      ])
    ).filter((action) => [45082, 42924, -61].includes(action.rawSkillId));
  for (const skillId of [45082, 42924]) {
    const hit = event({ time: 109, skillId, value: 100 });
    const [cast] = find(141374, [hit]);
    assert.equal(cast.rawSkillId, skillId);
    assert.equal(cast.start, effect.time);
    assert.match(cast.eiRule, /EffectCastFinderByDst/);
    assert.equal(find(141374, [{ ...hit, time: 110 }])[0].rawSkillId, -61);
    assert.equal(find(141374, [{ ...hit, source: 0x9999n }])[0].rawSkillId, -61);
    assert.deepEqual(find(141374, [hit], { target: 0x9999n }), []);
    assert.deepEqual(find(141373, [hit]), []);
  }

  assert.equal(find(141374)[0].rawSkillId, -61);
});

test('EI missile finders preserve creation evidence and suppress duplicate projectiles per skill and caster', () => {
  // Creation is sufficient without a hit; launches, removals, damage and another actor cannot invent a cast.
  const events = [
    ...[100, 140, 180, 230].map((time) => event({ time, stateChange: 57, skillId: 42163 })),
    event({ time: 140, stateChange: 57, skillId: 45732 }),
    event({ time: 270, stateChange: 57, skillId: 42163, source: 0x2000n, sourceMasterInstance: 1 }),
    event({ time: 300, stateChange: 57, skillId: 999999 }),
    ...[0, 58, 59].map((stateChange) => event({ time: 400, stateChange, skillId: 45732, value: 100 }))
  ];
  const c = context('engineer', 'holosmith', events);
  const actions = eiInstantActions(c);
  assert.deepEqual(
    actions.map((a) => [a.rawSkillId, a.start]),
    [
      [42163, 100],
      [42163, 230],
      [45732, 140]
    ]
  );
  for (const action of actions) {
    assert.equal(action.evidence, 'missile');
    assert.equal(action.metadataAccurate, true);
    assert.equal(action.castOrigin, 'skill');
    assert.match(action.eiRule, /HolosmithHelper\.MissileCastFinder/);
    assert.equal(events[action.eventIndex].time, action.start);
  }

  assert.deepEqual(eiInstantActions(context('engineer', 'scrapper', events)), []);

  const imported = reconstructEvtcRotation(
    log({ ...c.log, agents: [{ ...c.log.agents[0], profession: 3, elite: 57 }] }),
    engineerCatalog,
    { includeCombatStart: false }
  );
  assert.ok(imported.rotation.some((command) => command.name === 'Blade Burst'));
  assert.ok(imported.rotation.some((command) => command.name === 'Particle Accelerator'));
  assert.ok(imported.warnings.some((warning) => warning.includes('3 instant casts')));
});

test('Hurl missile inference uses a sliding 900 ms window for every Elementalist specialization', () => {
  // Only the player's creations advance the volley window; its exact boundary permits another input.
  const events = [
    ...[100, 300, 500, 700, 900, 1799, 2699].map((time) => event({ time, stateChange: 57, skillId: 5780 })),
    event({ time: 2200, stateChange: 57, skillId: 5780, source: 0x2000n, sourceMasterInstance: 1 }),
    ...[0, 58, 59].map((stateChange) => event({ time: 2600, stateChange, skillId: 5780, value: 100 }))
  ];
  for (const profile of ROTATION_PROFILES.filter((p) => p.professionId === 'elementalist')) {
    const actions = eiInstantActions(context('elementalist', profile.specializationId, events));
    assert.deepEqual(
      actions.map((action) => action.start),
      [100, 2699]
    );
    for (const action of actions) {
      assert.equal(action.rawSkillId, 5780);
      assert.equal(action.evidence, 'missile');
      assert.equal(action.metadataAccurate, true);
      assert.equal(action.castOrigin, 'skill');
      assert.equal(action.eiRule, 'ElementalistHelper.MissileCastFinder(Hurl)');
    }
  }
});

test('both importers retain the Forge exit but exclude the generated Overheat input', () => {
  // Resource consequences must not become unknown skill IDs or displace the recorded bar exit.
  const evtc = reconstructEvtcRotation(
    log({
      agents: [{ ...log().agents[0], profession: 3, elite: 57 }],
      events: [
        event({ time: 100, stateChange: 69, target: PLAYER, skillId: 43708, value: 1000, buff: 1 }),
        event({ time: 500, stateChange: 69, target: PLAYER, skillId: 41037, value: 1000, buff: 1 }),
        event({ time: 500, stateChange: 72, source: PLAYER, skillId: 43708, buff: 1 })
      ]
    }),
    engineerCatalog,
    { includeCombatStart: false }
  );
  const report = reconstructDpsReportRotation(
    {
      players: [
        {
          name: 'Fixture',
          profession: 'Holosmith',
          rotation: [
            { id: 42938, skills: [{ castTime: 100, duration: 0 }] },
            { id: 43937, skills: [{ castTime: 500, duration: 0 }] },
            { id: 41123, skills: [{ castTime: 500, duration: 0 }] }
          ]
        }
      ],
      phases: [{ name: 'Full Fight', start: 100, end: 1000 }],
      skillMap: {
        s42938: { name: 'Engage Photon Forge' },
        s43937: { name: 'Overheat' },
        s41123: { name: 'Deactivate Photon Forge' }
      }
    },
    engineerCatalog
  );
  for (const imported of [evtc, report]) {
    assert.ok(imported.rotation.some((command) => command.name === 'Deactivate Photon Forge'));
    assert.equal(
      imported.rotation.some((command) => command.skillId === 43937),
      false
    );
    assert.ok(imported.actions.every((action) => action.supportedByCatalog));
  }
});

test('EVTC Forge bundle changes replace an equipped kit without replaying swaps or stows', () => {
  // Buff transitions identify Forge actions; their paired bundle signals must collapse into those same inputs.
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 3, elite: 57 }],
    skills: [{ id: 5823, name: 'Fire Bomb' }],
    events: [
      event({ time: 0, stateChange: 11, target: 2n }),
      event({ time: 100, stateChange: 67, skillId: 5823, value: 600 }),
      event({ time: 700, stateChange: 68, skillId: 5823, value: 600, activation: 5 }),
      event({ time: 800, stateChange: 11, target: 4n }),
      event({ time: 800, stateChange: 69, target: PLAYER, skillId: 43708, value: 1000, buff: 1 }),
      event({ time: 801, stateChange: 11, target: 3n }),
      event({ time: 1500, stateChange: 72, source: PLAYER, skillId: 43708, buff: 1 }),
      event({ time: 1500, stateChange: 11, target: 4n })
    ]
  });
  const result = reconstructEvtcRotation(fixture, engineerCatalog, { includeCombatStart: false });
  assert.ok(result.rotation.some((command) => command.name === 'Bomb Kit'));
  assert.ok(result.rotation.some((command) => command.name === 'Engage Photon Forge'));
  assert.ok(result.rotation.some((command) => command.name === 'Deactivate Photon Forge'));
  assert.equal(
    result.rotation.some((command) => command.name === 'Swap Weapons' || command.name === 'Stow Bomb Kit'),
    false
  );
});

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

// A shared visual alone cannot identify Distortion; EI requires a nearby buff on that caster and an eligible spec.
test('Distortion effect inference requires matching buff evidence and respects specialization build gates', () => {
  const guid = Buffer.from('3D29ABD39CB5BD458C4D50A22FCC0E4B', 'hex');
  const mapping = event({
    stateChange: 46,
    skillId: 77,
    source: guid.readBigUInt64LE(0),
    target: guid.readBigUInt64LE(8)
  });
  const effect = event({ time: 100, stateChange: 51, skillId: 77 });
  for (const arcdpsBuild of ['20260430', '20260501']) {
    const buff = event({
      time: 109,
      stateChange: arcdpsBuild === '20260430' ? 0 : 69,
      buff: 1,
      value: 1000,
      skillId: 10243,
      target: PLAYER
    });
    const find = (specialization, build, evidence = [effect, buff]) => {
      const source = context('mesmer', specialization, [
        event({ stateChange: 15, source: BigInt(build) }),
        mapping,
        ...evidence
      ]);
      source.log.header.arcdpsBuild = arcdpsBuild;
      return eiInstantActions(source).filter((action) => action.rawSkillId === 10192);
    };

    for (const specialization of ['core', 'mirage', 'chronomancer']) {
      const [cast] = find(specialization, 135242);
      assert.equal(cast.start, effect.time);
      assert.equal(cast.evidence, 'effect');
      assert.equal(cast.castOrigin, 'skill');
      assert.match(cast.eiRule, /MesmerHelper\.EffectCastFinder/);
      assert.equal(find(specialization, 135241).length, specialization === 'chronomancer' ? 0 : 1);
    }

    for (const specialization of ['virtuoso', 'troubadour']) {
      assert.deepEqual(find(specialization, 200000), []);
    }

    for (const evidence of [
      [effect],
      [buff],
      [effect, { ...buff, time: 110 }],
      [effect, { ...buff, target: 0x9999n }],
      [{ ...effect, source: 0x9999n }, buff],
      [effect, { ...buff, stateChange: 70 }]
    ]) {
      assert.deepEqual(find('chronomancer', 135242, evidence), []);
    }

    // HasGainedBuff accepts a snapshot only as corroboration of an actual effect, unlike a buff-gain finder.
    assert.equal(find('chronomancer', 135242, [effect, { ...buff, stateChange: 18 }]).length, 1);
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
