import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { isJsonRotationFile, readEvtcRotationFile } from '#gw2/app/build/io/evtc-rotation-import.js';
import { applyRotationImportPreview, previewRotationFile } from '#gw2/app/build/io/rotation-import-dialog.js';
import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { detectEvtcRotationPlayers, reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';

const PLAYER = 0x1000n;

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function zipEvtc(bytes) {
  const name = new TextEncoder().encode('fixture.evtc');
  const compressed = deflateRawSync(bytes);
  const checksum = crc32(bytes);
  const local = new Uint8Array(30 + name.length);
  const localView = new DataView(local.buffer);

  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, 8, true);
  localView.setUint32(14, checksum, true);
  localView.setUint32(18, compressed.length, true);
  localView.setUint32(22, bytes.length, true);
  localView.setUint16(26, name.length, true);
  local.set(name, 30);

  const central = new Uint8Array(46 + name.length);
  const centralView = new DataView(central.buffer);

  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, 8, true);
  centralView.setUint32(16, checksum, true);
  centralView.setUint32(20, compressed.length, true);
  centralView.setUint32(24, bytes.length, true);
  centralView.setUint16(28, name.length, true);
  central.set(name, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length + compressed.length, true);

  const result = new Uint8Array(local.length + compressed.length + central.length + end.length);

  result.set(local, 0);
  result.set(compressed, local.length);
  result.set(central, local.length + compressed.length);
  result.set(end, local.length + compressed.length + central.length);

  return result;
}

function event(overrides = {}) {
  return {
    time: 1_000,
    source: PLAYER,
    target: 0n,
    value: 0,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 0,
    sourceInstance: 1,
    targetInstance: 0,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 0,
    buff: 0,
    result: 0,
    activation: 0,
    buffRemove: 0,
    ninety: 0,
    fifty: 0,
    moving: 0,
    stateChange: 0,
    flanking: 0,
    shields: 0,
    offcycle: 0,
    pad: 0,
    ...overrides
  };
}

function log(overrides = {}) {
  return {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260815',
      revision: 1,
      encounterId: 16199,
      agentCount: 1,
      skillCount: 4,
      eventCount: 0
    },
    agents: [
      {
        address: PLAYER,
        profession: 7,
        elite: 40,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Chronomancer',
        account: ':Fixture.1234',
        subgroup: '1'
      }
    ],
    skills: [
      { id: 1_000, name: 'Mind Stab' },
      { id: 2_000, name: 'Time Sink' },
      { id: 3_000, name: 'Blink' },
      { id: 65_001, name: 'Dodge' }
    ],
    events: [],
    ...overrides
  };
}

const catalog = {
  skills: [
    {
      id: 1_000,
      name: 'Mind Stab',
      type: 'Weapon',
      slot: 'Weapon_2',
      castTimeMs: 800,
      effects: []
    },
    {
      id: 2_000,
      name: 'Time Sink',
      type: 'Profession',
      slot: 'Profession_3',
      castTimeMs: 0,
      effects: [{ type: 'strike', atMs: 0 }]
    },
    {
      id: 3_000,
      name: 'Blink',
      type: 'Utility',
      slot: 'Utility',
      castTimeMs: 500,
      effects: []
    },
    {
      id: -3,
      name: 'Swap Weapons',
      type: 'Action',
      slot: 'Action',
      castTimeMs: 0,
      effects: []
    }
  ]
};

function expandedEvtcFixture({ interruptedDamage = false, secondActivation = false, skillName = 'Mind Stab' } = {}) {
  const header = Buffer.alloc(16);

  header.write('EVTC20260815', 0, 'ascii');
  header[12] = 1;
  header.writeUInt16LE(16_199, 13);
  const agentCount = Buffer.alloc(4);

  agentCount.writeUInt32LE(1);
  const agent = Buffer.alloc(96);

  agent.writeBigUInt64LE(PLAYER, 0);
  agent.writeUInt32LE(7, 8);
  agent.writeUInt32LE(40, 12);
  Buffer.from(['Fixture Chronomancer', ':Fixture.1234', '1', ''].join('\0'), 'utf8').copy(agent, 28);
  const skillCount = Buffer.alloc(4);

  skillCount.writeUInt32LE(1);
  const skill = Buffer.alloc(68);

  skill.writeUInt32LE(1_000, 0);
  skill.write(skillName, 4, 'utf8');
  const activation = Buffer.alloc(64);

  activation.writeBigUInt64LE(1_000n, 0);
  activation.writeBigUInt64LE(PLAYER, 8);
  activation.writeInt32LE(800, 24);
  activation.writeUInt32LE(1_000, 36);
  activation.writeUInt16LE(1, 40);
  activation[56] = 67;

  const laterActivation = Buffer.from(activation);

  laterActivation.writeBigUInt64LE(3_000n, 0);

  if (!interruptedDamage) {
    return Buffer.concat([
      header,
      agentCount,
      agent,
      skillCount,
      skill,
      activation,
      ...(secondActivation ? [laterActivation] : [])
    ]);
  }

  const animationStop = Buffer.alloc(64);

  animationStop.writeBigUInt64LE(1_000n, 0);
  animationStop.writeBigUInt64LE(PLAYER, 8);
  animationStop.writeUInt32LE(1_000, 36);
  animationStop.writeUInt16LE(1, 40);
  animationStop[51] = 4;
  animationStop[56] = 68;
  const damage = Buffer.alloc(64);

  damage.writeBigUInt64LE(1_350n, 0);
  damage.writeBigUInt64LE(PLAYER, 8);
  damage.writeBigUInt64LE(0x2000n, 16);
  damage.writeInt32LE(100, 24);
  damage.writeUInt32LE(1_000, 36);
  damage.writeUInt16LE(1, 40);

  return Buffer.concat([header, agentCount, agent, skillCount, skill, activation, animationStop, damage]);
}

test('reconstructs Thief Antiquary buff, precast, and animation-only mechanics', () => {
  const target = 0x2000n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 5,
        elite: 77,
        character: 'Fixture Antiquary'
      }
    ],
    skills: [
      [13_026, 'Prepare Thousand Needles'],
      [13_028, 'Caltrops'],
      [13_036, 'Spider Venom Charges'],
      [44_597, "Assassin's Signet Active"],
      [56_895, 'Prepared Thousand Needles'],
      [76_596, 'Metal Legion Guitar Follow-up'],
      [76_725, 'Stone Summit Cannon'],
      [76_816, 'Chak Shield'],
      [77_397, 'Skritt Swipe'],
      [78_288, 'Chak Shield Active'],
      [13_009, 'Slice'],
      [18_059, 'Movement Follow-up']
    ].map(([id, name]) => ({ id, name })),
    events: [
      event({
        time: 900,
        target: PLAYER,
        skillId: 56_895,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_000, skillId: 77_397, stateChange: 57 }),
      event({
        time: 1_100,
        skillId: 13_028,
        value: 500,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 1_200,
        target: PLAYER,
        skillId: 44_597,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 1_250,
        target: PLAYER,
        skillId: 44_597,
        buff: 1,
        stateChange: 69
      }),
      ...[1_300, 1_320, 1_340].map((time) =>
        event({
          time,
          target: PLAYER,
          skillId: 13_036,
          buff: 1,
          stateChange: 69
        })
      ),
      ...[1_400, 1_420, 1_440].map((time) =>
        event({
          time,
          target: PLAYER,
          skillId: 78_288,
          buff: 1,
          stateChange: 69
        })
      ),
      event({
        time: 1_500,
        target: PLAYER,
        skillId: 56_895,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({ time: 1_600, skillId: 18_059, value: 100, stateChange: 67 }),
      event({
        time: 1_700,
        skillId: 18_059,
        value: 100,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 1_800, skillId: 76_582, value: 200, stateChange: 67 }),
      event({
        time: 2_000,
        skillId: 76_582,
        value: 200,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 2_000, skillId: 76_596, value: 100, stateChange: 67 }),
      event({
        time: 2_100,
        skillId: 76_596,
        value: 100,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 2_200, skillId: 13_009, value: 100, stateChange: 67 }),
      event({
        time: 2_233,
        skillId: 13_009,
        value: 33,
        activation: 4,
        stateChange: 68
      }),
      event({ time: 2_400, skillId: 76_725, value: 500, stateChange: 67 }),
      event({
        time: 2_900,
        skillId: 76_725,
        value: 500,
        activation: 3,
        stateChange: 68
      }),
      ...[100, 110, 120, 1_000].map((value, index) =>
        event({
          time: 3_000 + index * 100,
          target,
          skillId: 76_725,
          value
        })
      )
    ]
  });
  const rotationCatalog = {
    skills: [
      [13_026, 'Prepare Thousand Needles', 'Utility', 'Utility', 500, 30],
      [13_028, 'Caltrops', 'Utility', 'Utility', 500, 0],
      [13_037, 'Spider Venom', 'Utility', 'Utility', 0, 0],
      [13_046, "Assassin's Signet", 'Utility', 'Utility', 0, 0],
      [56_898, 'Thousand Needles', 'Utility', 'Utility', 0, 0],
      [76_582, 'Metal Legion Guitar', 'Profession', 'Profession_1', 300, 0],
      [76_725, 'Stone Summit Cannon', 'Utility', 'Utility', 500, 0],
      [76_816, 'Chak Shield', 'Profession', 'Profession_1', 0, 0],
      [77_397, 'Skritt Swipe', 'Profession', 'Profession_1', 0, 0],
      [13_009, 'Slice', 'Weapon', 'Weapon_1', 1_400, 0]
    ].map(([id, name, type, slot, castTimeMs, cooldown]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs,
      quicknessCastTimeMs: castTimeMs,
      cooldown,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false
  });
  const names = result.actions.map((action) => action.name);

  assert.deepEqual(result.warnings, []);
  assert.equal(names.includes('Movement Follow-up'), false);
  assert.equal(names.includes('Slice'), false);
  assert.equal(result.actions.find((action) => action.name === 'Metal Legion Guitar')?.durationMs, 300);
  for (const name of [
    'Prepare Thousand Needles',
    'Caltrops',
    'Skritt Swipe',
    "Assassin's Signet",
    'Spider Venom',
    'Chak Shield',
    'Thousand Needles'
  ]) {
    assert.equal(names.filter((candidate) => candidate === name).length, 1);
  }

  assert.deepEqual(
    result.actions.filter((action) => action.name === 'Stone Summit Cannon').map((action) => action.doubleEdgeOutcome),
    ['success', 'backfire']
  );
});

test('infers resource-only Canach tosses from sustained Antiquary bursts', () => {
  const flawlessStarts = [
    2_000, 4_000, 6_000, 8_000, 10_000, 12_000, 14_000, 16_000, 19_000, 21_000, 23_000, 25_000, 27_000, 30_000, 31_000,
    32_000, 33_000, 36_000, 39_000, 42_000, 45_000, 48_000, 51_000, 54_000, 57_000, 60_000, 61_000, 62_000, 63_000,
    74_000
  ];
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 5,
        elite: 77,
        character: 'Fixture Antiquary'
      }
    ],
    skills: [
      { id: 76_725, name: 'Stone Summit Cannon' },
      { id: 80_244, name: 'Flawless Execution' }
    ],
    events: [
      event({ time: 1_000, stateChange: 1 }),
      ...flawlessStarts.flatMap((time) => [
        event({ time, skillId: 80_244, value: 1_000, stateChange: 67 }),
        event({
          time: time + 1_000,
          skillId: 80_244,
          value: 1_000,
          activation: 3,
          stateChange: 68
        })
      ]),
      event({ time: 73_500, skillId: 76_725, value: 500, stateChange: 67 }),
      event({
        time: 74_000,
        skillId: 76_725,
        value: 500,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      [76_725, 'Stone Summit Cannon', 'Utility', 'Utility', 500],
      [77_230, 'Canach-Coin Toss', 'Utility', 'Utility', 0],
      [80_244, 'Flawless Execution', 'Weapon', 'Weapon_3', 1_000]
    ].map(([id, name, type, slot, castTimeMs]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs,
      quicknessCastTimeMs: castTimeMs,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false
  });
  const canach = result.actions.filter((action) => action.name === 'Canach-Coin Toss');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    canach.map((action) => action.timestampMs),
    [3_100, 17_810, 31_000, 32_000, 61_000, 62_000, 73_000]
  );
  assert.deepEqual(
    canach.map((action) => action.doubleEdgeOutcome),
    ['success', 'backfire', 'backfire', 'backfire', 'backfire', 'backfire', 'backfire']
  );
  assert.ok(canach.every((action) => action.evidence === 'resource-inference'));
  assert.equal(
    reconstructEvtcRotation(fixture, rotationCatalog, {
      inferInstantCasts: false,
      selectedSkillNames: ["Assassin's Signet"]
    }).actions.some((action) => action.name === 'Canach-Coin Toss'),
    false
  );
});

test('assigns every Antiquary Cannon outcome from its own EVTC packet signature', () => {
  const target = 0x2000n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 5,
        elite: 77,
        character: 'Fixture Antiquary'
      }
    ],
    skills: [{ id: 76_725, name: 'Stone Summit Cannon' }],
    events: [
      event({ time: 1_000, stateChange: 1 }),
      ...[
        [2_000, 2_500],
        [12_000, 12_500],
        [14_000, 14_500]
      ].flatMap(([start, end]) => [
        event({ time: start, skillId: 76_725, value: end - start, stateChange: 67 }),
        event({
          time: end,
          skillId: 76_725,
          value: end - start,
          activation: 3,
          stateChange: 68
        })
      ]),
      ...[
        [3_000, 100],
        [3_100, 110],
        [3_200, 120],
        [3_300, 1_000],
        [13_000, 105],
        [13_100, 115],
        [13_200, 110],
        [16_000, 950]
      ].map(([time, value]) => event({ time, target, skillId: 76_725, value }))
    ]
  });
  const rotationCatalog = {
    skills: [
      {
        id: 76_725,
        name: 'Stone Summit Cannon',
        type: 'Utility',
        slot: 'Utility',
        castTimeMs: 500,
        quicknessCastTimeMs: 500,
        effects: []
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, { inferInstantCasts: false });

  assert.deepEqual(
    result.actions.filter((action) => action.name === 'Stone Summit Cannon').map((action) => action.doubleEdgeOutcome),
    ['success', 'backfire', 'success', 'backfire']
  );
});

test('reconstructs Daredevil dodge, steal, shared utilities, and truncated casts', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 5,
        elite: 7,
        character: 'Fixture Daredevil'
      }
    ],
    skills: [
      { id: 13_014, name: 'Steal' },
      { id: 13_004, name: 'Dagger Strike' },
      { id: 13_106, name: 'Death Blossom' },
      { id: 23_275, name: 'Dodge' },
      { id: 44_597, name: "Assassin's Signet Active" },
      { id: 726, name: 'Vigor' },
      { id: 740, name: 'Might' }
    ],
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_100, skillId: 23_275, stateChange: 67 }),
      event({
        time: 1_500,
        skillId: 23_275,
        activation: 6,
        stateChange: 68
      }),
      event({
        time: 2_000,
        target: PLAYER,
        skillId: 726,
        buff: 1,
        stateChange: 69
      }),
      ...Array.from({ length: 5 }, (_, index) =>
        event({
          time: 2_000 + index,
          target: PLAYER,
          skillId: 740,
          buff: 1,
          stateChange: 69
        })
      ),
      event({
        time: 2_500,
        target: PLAYER,
        skillId: 44_597,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 3_000, skillId: 13_106, stateChange: 67 }),
      event({
        time: 3_034,
        skillId: 13_106,
        value: 34,
        activation: 4,
        stateChange: 68
      }),
      event({ time: 4_000, skillId: 13_004, value: 400, stateChange: 67 }),
      event({
        time: 4_050,
        skillId: 13_004,
        value: 50,
        activation: 4,
        stateChange: 68
      }),
      event({ time: 4_200, skillId: 13_004, value: 100 })
    ]
  });
  const rotationCatalog = {
    skills: [
      [-5, 'Dodge', 'Action', 'Action', 0],
      [13_014, 'Steal', 'Profession', 'Profession_1', 0],
      [13_046, "Assassin's Signet", 'Utility', 'Utility', 0],
      [13_106, 'Death Blossom', 'Weapon', 'Weapon_3', 1_040],
      [
        13_004,
        'Dagger Strike',
        'Weapon',
        'Weapon_1',
        400,
        [{ type: 'strike', atMs: 200, persistsAfterInterrupt: true }]
      ]
    ].map(([id, name, type, slot, castTimeMs, effects = []]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs,
      quicknessCastTimeMs: castTimeMs,
      effects,
      ...(id === 13_004 ? { interruptCommitMs: 0 } : {})
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false
  });

  assert.deepEqual(result.warnings, []);
  const deathBlossom = result.actions.find((action) => action.name === 'Death Blossom');

  assert.equal(deathBlossom?.timestampMs, 2_000);
  assert.equal(deathBlossom?.durationMs, 1_040);
  assert.equal(deathBlossom?.status, 'completed');
  assert.equal(result.rotation.find((command) => command.name === 'Dagger Strike')?.interruptMs, 40);
});

test('reconstructs Deadeye mark, Mercy, Kneel, and Shadow Swap signals', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 5,
        elite: 58,
        character: 'Fixture Deadeye'
      }
    ],
    skills: [
      [42_774, 'Shadow Flare Return'],
      [42_869, 'Kneeling'],
      [42_863, 'Steal Time'],
      [44_597, "Assassin's Signet Active"],
      [46_333, "Deadeye's Gaze"],
      [70_282, 'Relic of the Deadeye']
    ].map(([id, name]) => ({ id, name })),
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 46_333,
        buff: 1,
        stateChange: 18
      }),
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 42_869,
        buff: 1,
        stateChange: 18
      }),
      event({
        time: 2_000,
        target: PLAYER,
        skillId: 44_597,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 2_088,
        target: PLAYER,
        skillId: 70_282,
        buff: 1,
        buffRemove: 2,
        stateChange: 71
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 46_333,
        value: 15_000,
        buff: 1,
        buffRemove: 2,
        stateChange: 71
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 46_333,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 4_500, skillId: 42_863, stateChange: 67 }),
      event({
        time: 4_780,
        skillId: 42_863,
        value: 280,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 4_950,
        target: PLAYER,
        skillId: 70_282,
        buff: 1,
        buffRemove: 2,
        stateChange: 71
      }),
      event({
        time: 5_000,
        target: PLAYER,
        skillId: 46_333,
        value: 15_000,
        buff: 1,
        buffRemove: 2,
        stateChange: 71
      }),
      event({
        time: 5_000,
        target: PLAYER,
        skillId: 46_333,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 5_500,
        skillId: 42_774,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      [13_046, "Assassin's Signet", 'Utility', 'Utility', 0],
      [40_600, 'Kneel', 'Weapon', 'Weapon_5', 0],
      [41_372, 'Mercy', 'Utility', 'Utility', 0],
      [42_863, 'Steal Time', 'Profession', 'Profession_2', 280],
      [43_390, "Deadeye's Mark", 'Profession', 'Profession_1', 0],
      [45_672, 'Shadow Swap', 'Utility', 'Utility', 0]
    ].map(([id, name, type, slot, castTimeMs]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs,
      quicknessCastTimeMs: castTimeMs,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false
  });
  const actions = result.actions;
  const mercies = actions.filter((action) => action.name === 'Mercy');

  assert.deepEqual(result.warnings, []);
  assert.equal(actions.filter((action) => action.name === "Deadeye's Mark").length, 3);
  assert.equal(actions.filter((action) => action.name === 'Kneel').length, 1);
  assert.equal(actions.filter((action) => action.name === 'Shadow Swap').length, 1);
  assert.equal(mercies.length, 2);
  assert.ok(mercies[0].timestampMs < actions.find((action) => action.name === "Assassin's Signet").timestampMs);
  assert.ok(mercies[1].timestampMs < actions.find((action) => action.name === 'Steal Time').timestampMs);
});

test('reconstructs Specter shroud, swaps, aliases, and opening precasts', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 5,
        elite: 71,
        character: 'Fixture Specter'
      }
    ],
    skills: [
      [13_036, 'Spider Venom Charges'],
      [23_285, 'Unknown Specter Animation'],
      [63_181, 'Twilight Combo Follow-up'],
      [63_239, 'Shadow Shroud'],
      [63_254, 'Twilight Combo'],
      [63_276, 'Well of Sorrow']
    ].map(([id, name]) => ({ id, name })),
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 13_036,
        buff: 1,
        stateChange: 18
      }),
      event({ time: 1_000, skillId: 63_276, value: 100 }),
      event({
        time: 2_000,
        target: PLAYER,
        skillId: 63_239,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 2_000, target: 3n, stateChange: 11 }),
      event({ time: 2_090, target: 4n, stateChange: 11 }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 63_239,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({ time: 3_000, target: 4n, stateChange: 11 }),
      event({ time: 3_090, target: 5n, stateChange: 11 }),
      event({ time: 4_000, skillId: 63_254, stateChange: 67 }),
      event({
        time: 4_400,
        skillId: 63_254,
        value: 400,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 4_400, skillId: 63_181, stateChange: 67 }),
      event({
        time: 4_800,
        skillId: 63_181,
        value: 400,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 5_000, skillId: 23_285, stateChange: 67 })
    ]
  });
  const rotationCatalog = {
    skills: [
      [-3, 'Swap Weapons', 'Action', 'Action', 0],
      [13_037, 'Spider Venom', 'Utility', 'Utility', 0],
      [63_155, 'Enter Shadow Shroud', 'Profession', 'Profession_1', 0],
      [63_251, 'Exit Shadow Shroud', 'Profession', 'Profession_1', 0],
      [63_254, 'Twilight Combo', 'Weapon', 'Weapon_3', 800],
      [63_276, 'Well of Sorrow', 'Utility', 'Utility', 600]
    ].map(([id, name, type, slot, castTimeMs]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs,
      quicknessCastTimeMs: castTimeMs,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false,
    selectedSkillNames: ['Spider Venom', 'Well of Sorrow']
  });
  const names = result.actions.map((action) => action.name);

  assert.deepEqual(result.warnings, []);
  assert.equal(names.includes('Unknown Specter Animation'), false);
  assert.equal(names.filter((name) => name === 'Swap Weapons').length, 2);
  for (const name of [
    'Spider Venom',
    'Well of Sorrow',
    'Enter Shadow Shroud',
    'Exit Shadow Shroud',
    'Twilight Combo'
  ]) {
    assert.equal(names.filter((candidate) => candidate === name).length, 1);
  }

  assert.equal(result.actions.find((action) => action.name === 'Twilight Combo').durationMs, 800);
});

test('requires an address when multiple players have equal action evidence', () => {
  const secondAddress = 0x2000n;
  const fixture = log({
    agents: [
      ...log().agents,
      {
        ...log().agents[0],
        address: secondAddress,
        character: 'Second Chronomancer'
      }
    ],
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000 }),
      event({
        time: 1_000,
        source: secondAddress,
        stateChange: 67,
        skillId: 1_000
      })
    ]
  });
  const players = detectEvtcRotationPlayers(fixture);

  assert.equal(players.length, 2);
  assert.throws(
    () => reconstructEvtcRotation(fixture, catalog),
    (error) => error instanceof EvtcError && error.code === 'PLAYER_SELECTION_REQUIRED'
  );
});

test('the browser rotation importer previews compressed .zevtc files before applying them', async () => {
  assert.equal(isJsonRotationFile({ name: 'rotation.json', type: '' }), true);
  assert.equal(isJsonRotationFile({ name: 'fight.zevtc', type: '' }), false);
  const bytes = zipEvtc(expandedEvtcFixture());
  const changedCalls = [];
  const originalRotation = [{ type: 'wait', durationMs: 250 }];
  const app = {
    profession: { id: 'mesmer', name: 'Mesmer' },
    adapter: { eliteSpecialization: () => 'Chronomancer' },
    build: { rotation: originalRotation },
    activeCatalog: catalog,
    changed(...args) {
      changedCalls.push(args);
    }
  };
  const imported = await previewRotationFile(
    {
      name: 'fight.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    },
    app
  );

  assert.equal(imported.description, 'Reconstructed Fixture Chronomancer (:Fixture.1234)');
  assert.equal(imported.actionCount, 1);
  assert.deepEqual(imported.rotation, [{ type: 'cast', skillId: 1_000 }]);
  assert.match(imported.warnings[0], /no matching stop event/);
  assert.strictEqual(app.build.rotation, originalRotation);
  assert.deepEqual(changedCalls, []);

  applyRotationImportPreview(app, imported);

  assert.deepEqual(app.build.rotation, imported.rotation);
  assert.notStrictEqual(app.build.rotation, imported.rotation);
  assert.deepEqual(changedCalls, [[false]]);

  const idleGapBytes = zipEvtc(expandedEvtcFixture({ secondActivation: true }));
  const idleGapImport = await readEvtcRotationFile(
    {
      name: 'idle-gap.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        idleGapBytes.buffer.slice(idleGapBytes.byteOffset, idleGapBytes.byteOffset + idleGapBytes.byteLength)
    },
    {
      profession: { id: 'mesmer', name: 'Mesmer' },
      adapter: { eliteSpecialization: () => 'Chronomancer' },
      build: {},
      activeCatalog: catalog
    }
  );

  assert.deepEqual(idleGapImport.rotation, [
    { type: 'cast', skillId: 1_000 },
    { type: 'wait', durationMs: 1200 },
    { type: 'cast', skillId: 1_000 }
  ]);

  const interruptedBytes = zipEvtc(expandedEvtcFixture({ interruptedDamage: true }));
  const interruptedImport = await readEvtcRotationFile(
    {
      name: 'interrupted.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        interruptedBytes.buffer.slice(
          interruptedBytes.byteOffset,
          interruptedBytes.byteOffset + interruptedBytes.byteLength
        )
    },
    {
      profession: { id: 'mesmer', name: 'Mesmer' },
      adapter: { eliteSpecialization: () => 'Chronomancer' },
      build: {},
      activeCatalog: {
        skills: catalog.skills.map((skill) =>
          skill.id === 1_000
            ? {
                ...skill,
                quicknessCastTimeMs: 540,
                effects: [{ type: 'strike', atMs: 350, timingAnchor: 'castStart', timingScale: 'fixed' }]
              }
            : skill
        )
      }
    }
  );

  assert.deepEqual(interruptedImport.rotation, [{ type: 'cast', skillId: 1_000 }]);
  assert.doesNotMatch(interruptedImport.warnings.join('\n'), /no interruptCommitMs cutoff/);

  const perPacketImport = await readEvtcRotationFile(
    {
      name: 'interrupted-channel.zevtc',
      type: 'application/octet-stream',
      arrayBuffer: async () =>
        interruptedBytes.buffer.slice(
          interruptedBytes.byteOffset,
          interruptedBytes.byteOffset + interruptedBytes.byteLength
        )
    },
    {
      profession: { id: 'mesmer', name: 'Mesmer' },
      adapter: { eliteSpecialization: () => 'Chronomancer' },
      build: {},
      activeCatalog: {
        skills: catalog.skills.map((skill) =>
          skill.id === 1_000
            ? {
                ...skill,
                interruptMode: 'per-packet',
                quicknessCastTimeMs: 540,
                effects: [{ type: 'strike', atMs: 350, timingAnchor: 'castStart', timingScale: 'fixed' }]
              }
            : skill
        )
      }
    }
  );

  assert.doesNotMatch(perPacketImport.warnings.join('\n'), /no interruptCommitMs cutoff/);
});

test('every profession page exposes JSON and EVTC rotation files', async () => {
  const pages = [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ];

  for (const page of pages) {
    const html = await readFile(new URL(`../../dist/site/${page}.html`, import.meta.url), 'utf8');

    assert.match(
      html,
      /id="rotation-file-input"\s+accept="\.json,\.evtc,\.evtc\.zip,\.zevtc,application\/json,application\/zip"/,
      page
    );
  }
});
