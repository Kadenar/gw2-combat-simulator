import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';

import { isJsonRotationFile, readEvtcRotationFile } from '#gw2/app/build/io/evtc-rotation-import.js';
import { applyRotationImportPreview, previewRotationFile } from '#gw2/app/build/io/rotation-import-dialog.js';
import { EvtcError } from '#gw2/integrations/logs/evtc/errors.js';
import { parseEvtc } from '#gw2/integrations/logs/evtc/parser.js';
import { evtcProfessionMetadata, evtcSpecializationMetadata } from '#gw2/integrations/logs/evtc/profession-metadata.js';
import {
  detectEvtcRotationPlayers,
  EVTC_PROFESSION_ROTATION_PARSERS,
  getEvtcProfessionRotationParser,
  initialHarbingerBlight,
  reconstructEvtcRotation
} from '#gw2/integrations/logs/evtc/rotation/index.js';

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

test('canonicalizes Master Tuning Crystal EVTC labels to Tuning Icicle', () => {
  const parsed = parseEvtc(expandedEvtcFixture({ skillName: 'Master Tuning Crystal' }));

  assert.equal(parsed.skills[0].name, 'Tuning Icicle');
});

test('registers an individual parser for every current profession specialization', () => {
  assert.equal(EVTC_PROFESSION_ROTATION_PARSERS.length, 45);
  assert.equal(new Set(EVTC_PROFESSION_ROTATION_PARSERS.map((parser) => parser.id)).size, 45);
  assert.equal(getEvtcProfessionRotationParser('mesmer', 'chronomancer')?.id, 'mesmer:chronomancer');
  assert.equal(getEvtcProfessionRotationParser('guardian', 'luminary')?.id, 'guardian:luminary');
  assert.equal(getEvtcProfessionRotationParser('mesmer', 'reaper'), null);

  for (const parser of EVTC_PROFESSION_ROTATION_PARSERS) {
    const profession = Array.from({ length: 256 }, (_, code) => evtcProfessionMetadata(code)).find(
      (candidate) => candidate?.id === parser.professionId
    );
    const specialization = Array.from({ length: 256 }, (_, code) =>
      evtcSpecializationMetadata(code, parser.professionId)
    ).find((candidate) => candidate?.id === parser.specializationId);
    assert.ok(profession, `missing EVTC profession metadata for ${parser.professionId}`);
    assert.ok(specialization, `missing EVTC specialization metadata for ${parser.id}`);
    const fixture = log({
      agents: [
        {
          ...log().agents[0],
          profession: profession.code,
          elite: specialization?.code || 0
        }
      ],
      events: [event({ stateChange: 67, skillId: 1_000 })]
    });

    assert.equal(
      parser.reconstruct(fixture, catalog, {
        inferInstantCasts: false
      }).parserId,
      parser.id
    );
  }
});

test('reconstructs casts, inferred instants, serial weapon swaps, dodges, and 40 ms replay timing', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_200, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_300,
        target: 0x2000n,
        skillId: 2_000,
        value: 100,
        iff: 1
      }),
      event({
        time: 1_301,
        target: 0x2000n,
        skillId: 2_000,
        value: 100,
        iff: 1
      }),
      event({ time: 1_400, stateChange: 11, target: 5n }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 400,
        activation: 3
      }),
      event({ time: 1_700, stateChange: 67, skillId: 65_001 }),
      event({
        time: 2_450,
        stateChange: 68,
        skillId: 65_001,
        value: 750,
        activation: 5
      })
    ]
  });

  fixture.header.eventCount = fixture.events.length;

  const result = reconstructEvtcRotation(fixture, catalog);

  assert.equal(result.parserId, 'mesmer:chronomancer');
  assert.equal(Object.hasOwn(result, 'logStartTime'), false);
  assert.equal(result.combatStartTimestampMs, 0);
  assert.deepEqual(
    result.actions.map((action) => [action.name, action.timestampMs, action.durationMs, action.kind, action.evidence]),
    [
      ['Mind Stab', 200, 400, 'weapon-skill', 'animation'],
      ['Time Sink', 300, 0, 'profession-skill', 'effect'],
      ['Swap Weapons', 400, 0, 'weapon-swap', 'state-change'],
      ['Dodge', 700, 750, 'dodge', 'animation']
    ]
  );
  assert.equal(result.actions[0].status, 'completed');
  assert.equal(result.actions[2].weaponSet, 5);
  assert.equal(result.actions[3].supportedByCatalog, false);
  assert.deepEqual(result.rotation, [
    { name: '__combat_start' },
    { name: '__wait', waitMs: 200 },
    { name: 'Mind Stab', skillId: 1_000 },
    { name: 'Time Sink', skillId: 2_000, offset: 120 },
    { name: 'Swap Weapons', skillId: -3 },
    { name: '__wait', waitMs: 320 },
    { name: 'Dodge', skillId: -5 }
  ]);
  assert.match(result.warnings[0], /instant cast was inferred/);
  assert.match(result.warnings[1], /not present/);
});

test('does not add EVTC idle time after a weapon-swap-cancelled retained cast', () => {
  const retainedSkill = {
    id: 4_100,
    name: 'Retained Cast',
    type: 'Weapon',
    slot: 'Weapon_2',
    quicknessCastTimeMs: 600,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    effects: []
  };
  const nextSkill = {
    id: 4_101,
    name: 'Next Cast',
    type: 'Weapon',
    slot: 'Weapon_3',
    quicknessCastTimeMs: 400,
    effects: []
  };
  const fixture = log({
    skills: [
      { id: retainedSkill.id, name: retainedSkill.name },
      { id: nextSkill.id, name: nextSkill.name }
    ],
    events: [
      event({ time: 1_200, stateChange: 67, skillId: retainedSkill.id, value: 900 }),
      event({ time: 1_561, stateChange: 68, skillId: retainedSkill.id, value: 361, activation: 4 }),
      event({ time: 1_561, stateChange: 11, target: 5n }),
      event({ time: 1_800, stateChange: 67, skillId: nextSkill.id, value: 600 }),
      event({ time: 2_200, stateChange: 68, skillId: nextSkill.id, value: 400, activation: 3 })
    ]
  });

  const result = reconstructEvtcRotation(
    fixture,
    { skills: [retainedSkill, nextSkill, catalog.skills.at(-1)] },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.deepEqual(result.rotation, [
    { name: 'Retained Cast', skillId: 4_100, interruptMs: 360 },
    { name: 'Swap Weapons', skillId: -3 },
    { name: 'Next Cast', skillId: 4_101 }
  ]);
});

test('preserves cancelled autoattacks and their recorded timeline without artificial waits', () => {
  const autoattack = {
    id: 4_000,
    name: 'Fixture Autoattack',
    type: 'Weapon',
    slot: 'Weapon_1',
    castTimeMs: 840,
    quicknessCastTimeMs: 560,
    effects: []
  };
  const fixture = log({
    skills: [{ id: autoattack.id, name: autoattack.name }],
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_200, stateChange: 67, skillId: autoattack.id, value: 840 }),
      event({ time: 1_600, stateChange: 68, skillId: autoattack.id, value: 400, activation: 3 }),
      event({ time: 1_733, target: 0x2000n, skillId: autoattack.id, value: 100 }),
      event({ time: 1_760, stateChange: 67, skillId: autoattack.id, value: 840 }),
      event({ time: 1_900, stateChange: 68, skillId: autoattack.id, value: 140, activation: 4 }),
      event({ time: 2_000, stateChange: 67, skillId: autoattack.id, value: 840 }),
      event({ time: 2_400, stateChange: 68, skillId: autoattack.id, value: 400, activation: 3 }),
      event({ time: 2_533, target: 0x2000n, skillId: autoattack.id, value: 100 })
    ]
  });

  const result = reconstructEvtcRotation(fixture, { skills: [...catalog.skills, autoattack] });
  const autoattackCommands = result.rotation.filter((command) => command.name === autoattack.name);

  assert.equal(autoattackCommands.length, 3);
  assert.equal(
    autoattackCommands.every((command) => command.offset == null),
    true
  );
  assert.deepEqual(
    autoattackCommands.map(({ interruptMs }) => interruptMs),
    [undefined, 160, undefined]
  );
  assert.deepEqual(
    result.rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
    [200, 80]
  );
});

test('represents observed post-combat idle time with explicit waits', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_200, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_600, stateChange: 68, skillId: 1_000, value: 400, activation: 3 }),
      event({ time: 1_940, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 2_340, stateChange: 68, skillId: 1_000, value: 400, activation: 3 }),
      event({ time: 3_100, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 3_500, stateChange: 68, skillId: 1_000, value: 400, activation: 3 })
    ]
  });

  const result = reconstructEvtcRotation(fixture, catalog);

  assert.deepEqual(
    result.rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
    [200, 200, 600]
  );
});

test('uses observed strike packets to reconcile interrupted casts generically', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_000,
        stateChange: 68,
        skillId: 1_000,
        activation: 4
      }),
      event({ time: 1_350, target: 0x2000n, skillId: 1_000, value: 100 })
    ]
  });
  const rotationCatalog = {
    skills: [
      {
        ...catalog.skills[0],
        quicknessCastTimeMs: 540,
        effects: [
          {
            type: 'strike',
            atMs: 350,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    includeCombatStart: false,
    inferInstantCasts: false
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.actions[0].status, 'completed');
  assert.deepEqual(result.rotation, [
    {
      name: 'Mind Stab',
      skillId: 1_000
    }
  ]);
});

test('does not infer cast commitment when no effect packet was observed', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_000,
        stateChange: 68,
        skillId: 1_000,
        activation: 4
      }),
      event({ time: 1_350, target: 0x2000n, skillId: 1_000, value: 0 })
    ]
  });
  const rotationCatalog = {
    skills: [
      {
        ...catalog.skills[0],
        quicknessCastTimeMs: 540,
        effects: [
          {
            type: 'strike',
            atMs: 350,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    includeCombatStart: false,
    inferInstantCasts: false
  });

  assert.equal(result.actions[0].status, 'interrupted');
  assert.ok(result.warnings.some((warning) => warning.includes('interrupted')));
  assert.deepEqual(result.rotation, [{ name: 'Mind Stab', skillId: 1_000 }]);
});

test('uses rounded EVTC timing when it reaches the engine interrupt cutoff', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_437, stateChange: 68, skillId: 1_000, value: 437, activation: 4 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [{ ...catalog.skills[0], interruptCommitMs: 400 }]
    },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.equal(result.actions[0].durationMs, 437);
  assert.deepEqual(result.rotation, [{ name: 'Mind Stab', skillId: 1_000, interruptMs: 440 }]);
  assert.deepEqual(result.warnings, []);
});

test('replays a completed cast only through its committed aftercast boundary', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_400, target: 0x2000n, skillId: 1_000, value: 100 }),
      event({ time: 1_437, stateChange: 68, skillId: 1_000, value: 437, activation: 3 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          ...catalog.skills[0],
          quicknessCastTimeMs: 800,
          interruptCommitMs: 400,
          effects: [{ type: 'strike', atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }]
        }
      ]
    },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.equal(result.actions[0].status, 'reduced');
  assert.deepEqual(result.rotation, [{ name: 'Mind Stab', skillId: 1_000, interruptMs: 440 }]);
});

test('right-aligns damage-inferred ammo flips within an active cast', () => {
  const fixture = log({
    skills: [...log().skills, { id: 4_000, name: 'Ammo Flip' }],
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({ time: 1_300, target: 0x2000n, skillId: 4_000, value: 100 }),
      event({
        time: 1_800,
        stateChange: 68,
        skillId: 1_000,
        value: 800,
        activation: 3
      }),
      event({ time: 2_200, stateChange: 67, skillId: 3_000, value: 500 }),
      event({
        time: 2_700,
        stateChange: 68,
        skillId: 3_000,
        value: 500,
        activation: 3
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      ...catalog.skills,
      {
        id: 4_000,
        name: 'Ammo Flip',
        type: 'Utility',
        slot: 'Utility',
        castTimeMs: 0,
        ammo: 2,
        flipParentId: 4_001,
        canCastConcurrently: true,
        effects: [{ type: 'strike', atMs: 0 }]
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    includeCombatStart: false
  });
  const ammoFlip = result.actions.find((action) => action.name === 'Ammo Flip');

  assert.equal(ammoFlip.timestampMs, 700);
});

test('pairs a stop before the next same-millisecond animation start', () => {
  const fixture = log({
    events: [
      event({
        time: 1_000,
        stateChange: 68,
        skillId: 2_000,
        value: 500,
        activation: 3
      }),
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3
      }),
      event({ time: 1_600, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 2_200,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, catalog, {
    includeCombatStart: false,
    inferInstantCasts: false
  });

  assert.deepEqual(
    result.actions.map((action) => ({
      timestampMs: action.timestampMs,
      durationMs: action.durationMs
    })),
    [
      { timestampMs: 0, durationMs: 600 },
      { timestampMs: 600, durationMs: 600 }
    ]
  );
  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait'),
    [
      { name: 'Mind Stab', skillId: 1_000 },
      { name: 'Mind Stab', skillId: 1_000 }
    ]
  );
});

test('keeps an instant at the preceding cast end sequential', () => {
  const fixture = log({
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 1_000, value: 800 }),
      event({
        time: 1_600,
        stateChange: 68,
        skillId: 1_000,
        value: 600,
        activation: 3
      }),
      event({
        time: 1_600,
        target: 0x2000n,
        skillId: 2_000,
        value: 100
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, catalog, {
    includeCombatStart: false
  });

  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait'),
    [
      { name: 'Mind Stab', skillId: 1_000 },
      { name: 'Time Sink', skillId: 2_000 }
    ]
  );
});

test('resolves Weaponmaster skills owned by another specialization', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 45_846, name: 'Harrowing Wave' }],
    events: [event({ stateChange: 67, skillId: 45_846 })]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 45_846,
        name: 'Harrowing Wave',
        type: 'Weapon',
        slot: 'Weapon_4',
        specialization: 'Scourge',
        castTimeMs: 650,
        effects: []
      }
    ]
  });

  assert.equal(result.actions[0].skillId, 45_846);
  assert.equal(result.actions[0].supportedByCatalog, true);
});

test('reconstructs Harbinger Shroud entry and exit from buff transitions', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 59_964, name: 'Harbinger Shroud' }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        value: 10_000,
        skillId: 59_964,
        buff: 1
      }),
      event({ time: 1_000, target: 4n, stateChange: 11 }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 59_964,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 59_964,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({ time: 3_000, target: 5n, stateChange: 11 })
    ]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 62_567,
        name: 'Harbinger Shroud',
        type: 'Profession',
        slot: 'Profession_1',
        specialization: 'Harbinger',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 62_540,
        name: 'Exit Harbinger Shroud',
        type: 'Profession',
        slot: 'Profession_1',
        specialization: 'Harbinger',
        castTimeMs: 0,
        effects: []
      },
      catalog.skills.at(-1)
    ]
  });

  assert.deepEqual(
    result.actions.map((action) => ({
      name: action.name,
      skillId: action.skillId,
      evidence: action.evidence
    })),
    [
      {
        name: 'Harbinger Shroud',
        skillId: 62_567,
        evidence: 'buff-transition'
      },
      {
        name: 'Exit Harbinger Shroud',
        skillId: 62_540,
        evidence: 'buff-transition'
      }
    ]
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Swap Weapons'),
    false
  );
});

test('reconstructs a Soul Barbs shroud precast and Harbinger starting Blight', () => {
  const initialBuff = (skillId) =>
    event({
      time: 1_000,
      target: PLAYER,
      skillId,
      buff: 1,
      stateChange: 18
    });
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 45_846, name: 'Harrowing Wave' }],
    events: [
      initialBuff(53_489),
      initialBuff(62_653),
      initialBuff(62_653),
      initialBuff(62_653),
      event({ time: 10_000, stateChange: 1 }),
      event({ time: 10_000, stateChange: 67, skillId: 45_846 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        [62_567, 'Harbinger Shroud', 'Profession'],
        [62_540, 'Exit Harbinger Shroud', 'Profession'],
        [45_846, 'Harrowing Wave', 'Weapon']
      ].map(([id, name, type]) => ({
        id,
        name,
        type,
        slot: type === 'Profession' ? 'Profession_1' : 'Weapon_4',
        specialization: type === 'Profession' ? 'Harbinger' : 'Scourge',
        castTimeMs: 0,
        effects: []
      }))
    },
    { inferInstantCasts: false }
  );

  assert.deepEqual(result.rotation, [
    { name: 'Harbinger Shroud', skillId: 62_567 },
    { name: 'Exit Harbinger Shroud', skillId: 62_540 },
    { name: '__wait', waitMs: 9_000 },
    { name: '__combat_start' },
    { name: 'Harrowing Wave', skillId: 45_846 }
  ]);
  assert.equal(initialHarbingerBlight(fixture, PLAYER), 3);

  const app = { build: { rotation: [], initialBlight: 0 }, changed() {} };
  applyRotationImportPreview(app, {
    rotation: result.rotation,
    actionCount: result.actions.length,
    description: 'Fixture Harbinger',
    warnings: [],
    observations: [],
    initialBlight: initialHarbingerBlight(fixture, PLAYER)
  });
  assert.equal(app.build.initialBlight, 3);
});

test('reconstructs Plague Signet once per passive-buff removal', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 72_368, name: 'Plague Signet' }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 10_562,
          name: 'Plague Signet',
          type: 'Utility',
          slot: 'Utility_2',
          castTimeMs: 0,
          effects: []
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.deepEqual(
    result.actions.map((action) => ({
      timestampMs: action.timestampMs,
      name: action.name,
      skillId: action.skillId,
      evidence: action.evidence
    })),
    [
      {
        timestampMs: 0,
        name: 'Plague Signet',
        skillId: 10_562,
        evidence: 'buff-transition'
      },
      {
        timestampMs: 2_000,
        name: 'Plague Signet',
        skillId: 10_562,
        evidence: 'buff-transition'
      }
    ]
  );
});

test('places Plague Signet after an overlapping Blood Is Power cast completes', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [
      { id: 10_544, name: 'Blood Is Power' },
      { id: 72_368, name: 'Plague Signet' }
    ],
    events: [
      event({ time: 1_000, skillId: 10_544, value: 1_320, stateChange: 67 }),
      event({
        time: 1_500,
        target: PLAYER,
        skillId: 72_368,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 1_600,
        skillId: 10_544,
        value: 600,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 10_544,
          name: 'Blood Is Power',
          type: 'Utility',
          slot: 'Utility_1',
          castTimeMs: 880,
          quicknessCastTimeMs: 880,
          retainsCastLockoutAfterInterrupt: true,
          effects: []
        },
        {
          id: 10_562,
          name: 'Plague Signet',
          type: 'Utility',
          slot: 'Utility_2',
          castTimeMs: 0,
          effects: []
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.deepEqual(
    result.actions.map((action) => ({
      name: action.name,
      timestampMs: action.timestampMs,
      durationMs: action.durationMs
    })),
    [
      { name: 'Blood Is Power', timestampMs: 0, durationMs: 880 },
      { name: 'Plague Signet', timestampMs: 880, durationMs: 0 }
    ]
  );
  assert.deepEqual(result.rotation, [
    { name: 'Blood Is Power', skillId: 10_544 },
    { name: 'Plague Signet', skillId: 10_562 }
  ]);
  assert.deepEqual(result.warnings, []);
});

test('uses the default Quickness cast when EVTC timing is below the commit cutoff', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 62_672, name: 'Devouring Cut' }],
    events: [
      event({ time: 1_000, skillId: 62_672, value: 1_040, stateChange: 67 }),
      event({
        time: 1_360,
        skillId: 62_672,
        value: 360,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 1_360, target: 0x2000n, skillId: 62_672, value: 100 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 62_672,
          name: 'Devouring Cut',
          type: 'Profession',
          slot: 'Weapon_3',
          quicknessCastTimeMs: 480,
          interruptCommitMs: 400,
          effects: [
            {
              type: 'strike',
              coefficient: 1,
              hits: 1,
              atMs: 360,
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            }
          ]
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.equal(result.actions[0].durationMs, 360);
  assert.deepEqual(result.rotation, [{ name: 'Devouring Cut', skillId: 62_672 }]);
  assert.deepEqual(result.warnings, []);
});

test('accepts EVTC timing at the commit frame and rejects timing below it', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [
      { id: 62_621, name: 'Dark Barrage' },
      { id: 10_706, name: 'Enfeebling Blood' }
    ],
    events: [
      event({ time: 1_000, skillId: 62_621, value: 1_240, stateChange: 67 }),
      event({
        time: 1_794,
        skillId: 62_621,
        value: 794,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 2_500, skillId: 10_706, value: 1_200, stateChange: 67 }),
      event({
        time: 3_099,
        skillId: 10_706,
        value: 599,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 62_621,
          name: 'Dark Barrage',
          type: 'Profession',
          slot: 'Weapon_2',
          quicknessCastTimeMs: 920,
          interruptCommitMs: 800,
          effects: []
        },
        {
          id: 10_706,
          name: 'Enfeebling Blood',
          type: 'Weapon',
          slot: 'Weapon_2',
          quicknessCastTimeMs: 840,
          interruptCommitMs: 638,
          effects: []
        }
      ]
    },
    {
      includeCombatStart: false,
      inferInstantCasts: false
    }
  );

  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait'),
    [
      { name: 'Dark Barrage', skillId: 62_621, interruptMs: 800 },
      { name: 'Enfeebling Blood', skillId: 10_706 }
    ]
  );
  assert.deepEqual(result.warnings, []);
});

test('reconstructs Distress from its consumed availability buff', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 64,
        character: 'Fixture Harbinger'
      }
    ],
    skills: [{ id: 72_976, name: 'Distress' }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        value: 3_000,
        skillId: 72_976,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 1_800,
        target: PLAYER,
        value: 2_200,
        skillId: 72_976,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 1_800,
        target: PLAYER,
        value: 2_200,
        buffDamage: 2_200,
        skillId: 72_976,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({
        time: 4_000,
        target: PLAYER,
        value: 3_000,
        skillId: 72_976,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 7_000,
        target: PLAYER,
        skillId: 72_976,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 73_116,
        name: 'Distress',
        type: 'Weapon',
        slot: 'Weapon_4',
        castTimeMs: 0,
        effects: []
      }
    ]
  });

  assert.deepEqual(
    result.actions.map((action) => [action.name, action.skillId, action.evidence]),
    [['Distress', 73_116, 'buff-transition']]
  );
});

test('reconstructs Ritualist shroud and player-owned initial minion precasts', () => {
  const boneMinion1 = 0x2001n;
  const boneMinion2 = 0x2002n;
  const bloodFiend = 0x2003n;
  const fleshGolem = 0x2004n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 76,
        character: 'Fixture Ritualist'
      },
      {
        ...log().agents[0],
        address: boneMinion1,
        profession: 1_192,
        elite: 0xffffffff,
        character: 'Bone Minion'
      },
      {
        ...log().agents[0],
        address: boneMinion2,
        profession: 1_192,
        elite: 0xffffffff,
        character: 'Bone Minion'
      },
      {
        ...log().agents[0],
        address: bloodFiend,
        profession: 1_104,
        elite: 0xffffffff,
        character: 'Blood Fiend'
      },
      {
        ...log().agents[0],
        address: fleshGolem,
        profession: 1_792,
        elite: 0xffffffff,
        character: 'Flesh Golem'
      }
    ],
    skills: [
      { id: 76_958, name: "Ritualist's Shroud" },
      { id: 76_864, name: 'Anguish' },
      { id: 76_961, name: 'Wanderlust' }
    ],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 76_958,
        sourceInstance: 23,
        targetInstance: 23,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1_000, sourceInstance: 23, stateChange: 1 }),
      ...[boneMinion1, boneMinion2, bloodFiend, fleshGolem].map((source, index) =>
        event({
          time: 1_000,
          source,
          target: source,
          sourceInstance: 40 + index,
          targetInstance: 40 + index,
          sourceMasterInstance: 23,
          buff: 18,
          stateChange: 18
        })
      ),
      event({
        time: 1_198,
        skillId: 76_864,
        value: 559,
        buffDamage: 839,
        sourceInstance: 23,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 2_000,
        skillId: 76_961,
        value: 1_000,
        sourceInstance: 23,
        stateChange: 67
      }),
      event({
        time: 2_760,
        skillId: 76_961,
        value: 760,
        sourceInstance: 23,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 5_480,
        target: PLAYER,
        skillId: 76_958,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 5_480,
        target: PLAYER,
        skillId: 76_958,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buffDamage: 2_147_483_647,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 10_547,
        name: 'Summon Blood Fiend',
        type: 'Heal',
        slot: 'Heal',
        castTimeMs: 1_000,
        effects: []
      },
      {
        id: 10_646,
        name: 'Summon Flesh Golem',
        type: 'Elite',
        slot: 'Elite',
        castTimeMs: 1_000,
        effects: []
      },
      {
        id: 10_541,
        name: 'Summon Bone Minions',
        type: 'Utility',
        slot: 'Utility',
        castTimeMs: 500,
        effects: []
      },
      {
        id: 77_238,
        name: "Ritualist's Shroud",
        type: 'Profession',
        slot: 'Profession_1',
        specialization: 'Ritualist',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 76_933,
        name: "Exit Ritualist's Shroud",
        type: 'Profession',
        slot: 'Profession_1',
        specialization: 'Ritualist',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 76_864,
        name: 'Anguish',
        type: 'Profession',
        slot: 'Weapon_2',
        specialization: 'Ritualist',
        castTimeMs: 560,
        effects: []
      },
      {
        id: 76_961,
        name: 'Wanderlust',
        type: 'Profession',
        slot: 'Weapon_3',
        specialization: 'Ritualist',
        castTimeMs: 760,
        effects: []
      }
    ]
  });

  assert.deepEqual(result.rotation.slice(0, 6), [
    { name: 'Summon Blood Fiend', skillId: 10_547 },
    { name: 'Summon Flesh Golem', skillId: 10_646 },
    { name: 'Summon Bone Minions', skillId: 10_541 },
    { name: "Ritualist's Shroud", skillId: 77_238 },
    { name: 'Anguish', skillId: 76_864 },
    { name: '__combat_start', offset: 360 }
  ]);
  assert.deepEqual(
    result.actions.filter((action) => action.evidence === 'initial-state').map((action) => action.name),
    ['Summon Blood Fiend', 'Summon Flesh Golem', 'Summon Bone Minions']
  );
  assert.deepEqual(
    result.actions.filter((action) => action.evidence === 'buff-transition').map((action) => action.name),
    ["Ritualist's Shroud", "Exit Ritualist's Shroud"]
  );
});

test('reconstructs Ritualist Summon Spirits and innervates from effects', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 76,
        character: 'Fixture Ritualist'
      }
    ],
    skills: [
      { id: 78_660, name: 'Summon Spirits' },
      { id: 79_246, name: 'Summon Spirits' },
      { id: 77_860, name: 'Summon Spirits' },
      { id: 77_050, name: 'Innervate Anguish' },
      { id: 791, name: 'Fear' }
    ],
    events: [
      event({ time: 1_360, skillId: 78_660, value: 5_000 }),
      event({ time: 1_680, skillId: 79_246, value: 5_000 }),
      event({ time: 1_840, skillId: 77_860, value: 20_000 }),
      event({ time: 3_000, skillId: 77_050, value: 5_000 }),
      event({
        time: 4_000,
        target: 0x2000n,
        skillId: 791,
        value: 1_500,
        buff: 1,
        stateChange: 69
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 76_607,
          name: 'Summon Spirits',
          type: 'Profession',
          slot: 'Weapon_5',
          specialization: 'Ritualist',
          castTimeMs: 0,
          effects: []
        },
        {
          id: 77_003,
          name: 'Innervate Anguish',
          type: 'Profession',
          slot: 'Profession_2',
          specialization: 'Ritualist',
          castTimeMs: 0,
          effects: []
        },
        {
          id: 76_732,
          name: 'Innervate Wanderlust',
          type: 'Profession',
          slot: 'Profession_3',
          specialization: 'Ritualist',
          castTimeMs: 0,
          effects: []
        }
      ]
    },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.deepEqual(
    result.actions.map((action) => [
      action.timestampMs,
      action.rawSkillId,
      action.skillId,
      action.name,
      action.evidence
    ]),
    [
      [0, 78_660, 76_607, 'Summon Spirits', 'effect'],
      [2_000, 77_050, 77_003, 'Innervate Anguish', 'effect'],
      [3_000, 791, 76_732, 'Innervate Wanderlust', 'effect']
    ]
  );
});

test('reconstructs Scourge shade skills and Shadow Fiend Haunt', () => {
  const shadowFiend = 0x3000n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 60,
        character: 'Fixture Scourge'
      },
      {
        ...log().agents[0],
        address: shadowFiend,
        profession: 5_673,
        elite: 0xffffffff,
        character: 'Shadow Fiend'
      }
    ],
    skills: [
      { id: 3_643, name: 'Haunt' },
      { id: 10_544, name: 'Blood Is Power' },
      { id: 43_448, name: 'Sand Cascade' },
      { id: 44_946, name: 'Manifest Sand Shade' },
      { id: 45_079, name: 'Sand Shade' },
      { id: 46_726, name: 'Desert Shroud' },
      { id: 46_808, name: 'Manifest Sand Shade' },
      { id: 791, name: 'Fear' }
    ],
    events: [
      event({
        time: 5_000,
        target: PLAYER,
        skillId: 45_079,
        sourceInstance: 23,
        targetInstance: 23,
        value: 13_436,
        buffDamage: 15_000,
        buff: 18,
        stateChange: 18
      }),
      event({
        time: 5_000,
        source: shadowFiend,
        target: shadowFiend,
        sourceInstance: 40,
        targetInstance: 40,
        sourceMasterInstance: 23,
        buff: 18,
        stateChange: 18
      }),
      event({
        time: 5_652,
        source: shadowFiend,
        sourceInstance: 40,
        sourceMasterInstance: 23,
        skillId: 3_643,
        value: 2_000,
        stateChange: 67
      }),
      event({
        time: 5_814,
        skillId: 10_544,
        sourceInstance: 23,
        value: 876,
        buffDamage: 1_304,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 6_000,
        skillId: 46_808,
        sourceInstance: 23,
        value: 1_000
      }),
      ...Array.from({ length: 7 }, (_, index) =>
        event({
          time: 6_100 + index * 1_000,
          skillId: 46_726,
          sourceInstance: 23,
          value: 1_000
        })
      ),
      event({ time: 6_500, sourceInstance: 23, stateChange: 1 }),
      event({
        time: 13_000,
        skillId: 43_448,
        sourceInstance: 23,
        value: 1_000,
        stateChange: 38
      }),
      event({
        time: 14_000,
        target: 0x4000n,
        skillId: 791,
        sourceInstance: 23,
        value: 1_000,
        buff: 1,
        stateChange: 69
      }),
      ...Array.from({ length: 7 }, (_, index) =>
        event({
          time: 20_000 + index * 1_000,
          skillId: 46_726,
          sourceInstance: 23,
          value: 1_000
        })
      ),
      event({
        time: 30_000,
        skillId: 44_946,
        sourceInstance: 23,
        value: 480,
        stateChange: 67
      }),
      event({
        time: 30_480,
        skillId: 44_946,
        sourceInstance: 23,
        value: 480,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        [10_589, 'Summon Shadow Fiend', 'Utility', 500],
        [10_590, 'Haunt', 'Utility', 0],
        [10_544, 'Blood Is Power', 'Utility', 1_320],
        [44_946, 'Manifest Sand Shade', 'Profession', 720],
        [40_813, 'Nefarious Favor', 'Profession', 0],
        [43_448, 'Sand Cascade', 'Profession', 0],
        [44_428, 'Garish Pillar', 'Profession', 0],
        [44_663, 'Desert Shroud', 'Profession', 0]
      ].map(([id, name, type, castTimeMs]) => ({
        id,
        name,
        type,
        slot: type === 'Profession' ? 'Profession_1' : 'Utility',
        specialization: type === 'Profession' ? 'Scourge' : '',
        castTimeMs,
        ...(id === 44_946 ? { quicknessCastTimeMs: 480 } : {}),
        effects: []
      }))
    },
    { inferInstantCasts: false }
  );

  assert.deepEqual(
    result.actions.slice(0, 6).map((action) => ({ name: action.name, skillId: action.skillId })),
    [
      { name: 'Summon Shadow Fiend', skillId: 10_589 },
      { name: 'Manifest Sand Shade', skillId: 44_946 },
      { name: 'Blood Is Power', skillId: 10_544 },
      { name: 'Haunt', skillId: 10_590 },
      { name: 'Nefarious Favor', skillId: 40_813 },
      { name: 'Desert Shroud', skillId: 44_663 }
    ]
  );
  assert.deepEqual(
    result.actions
      .filter((action) => [3_643, 46_808, 46_726, 43_448, 791].includes(action.rawSkillId))
      .map((action) => [action.rawSkillId, action.skillId, action.name]),
    [
      [3_643, 10_590, 'Haunt'],
      [46_808, 40_813, 'Nefarious Favor'],
      [46_726, 44_663, 'Desert Shroud'],
      [43_448, 43_448, 'Sand Cascade'],
      [791, 44_428, 'Garish Pillar'],
      [46_726, 44_663, 'Desert Shroud']
    ]
  );
  assert.equal(result.actions.filter((action) => action.name === 'Manifest Sand Shade').length, 2);
  assert.equal(
    result.actions.find((action) => action.name === 'Manifest Sand Shade' && action.evidence === 'initial-state')
      ?.durationMs,
    480
  );
});

test('reconstructs Reaper shroud and truncated opening precasts', () => {
  const fleshGolem = 0x3000n;
  const target = 0x4000n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 34,
        character: 'Fixture Reaper'
      },
      {
        ...log().agents[0],
        address: fleshGolem,
        profession: 1_792,
        elite: 0xffffffff,
        character: 'Flesh Golem'
      },
      {
        ...log().agents[0],
        address: target,
        profession: 16_199,
        elite: 0xffffffff,
        character: 'Standard Kitty Golem'
      }
    ],
    skills: [
      { id: 29_740, name: 'Grasping Darkness' },
      { id: 29_855, name: 'Nightfall' },
      { id: 29_446, name: "Reaper's Shroud" },
      { id: 30_825, name: "Death's Charge" }
    ],
    events: [
      event({
        time: 1_000,
        skillId: 29_740,
        sourceInstance: 23,
        stateChange: 58
      }),
      event({
        time: 1_000,
        source: fleshGolem,
        target: fleshGolem,
        sourceInstance: 40,
        targetInstance: 40,
        sourceMasterInstance: 23,
        buff: 18,
        stateChange: 18
      }),
      event({
        time: 1_082,
        skillId: 29_855,
        sourceInstance: 23,
        value: 481,
        buffDamage: 719,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 1_400, sourceInstance: 23, stateChange: 1 }),
      event({
        time: 2_399,
        target: 3n,
        sourceInstance: 23,
        stateChange: 11
      }),
      event({
        time: 2_399,
        target: PLAYER,
        skillId: 29_446,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 2_438,
        target,
        skillId: 30_825,
        sourceInstance: 23,
        value: 1_200,
        stateChange: 67
      }),
      event({
        time: 3_640,
        skillId: 30_825,
        sourceInstance: 23,
        value: 1_202,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 5_000,
        target: 5n,
        sourceInstance: 23,
        stateChange: 11
      }),
      event({
        time: 5_000,
        target: PLAYER,
        skillId: 29_446,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 5_000,
        target: PLAYER,
        skillId: 29_446,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buffDamage: 2_147_483_647,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({
        time: 6_000,
        target: 4n,
        sourceInstance: 23,
        stateChange: 11
      }),
      event({
        time: 6_500,
        target: 3n,
        sourceInstance: 23,
        stateChange: 11
      }),
      event({
        time: 6_500,
        target: PLAYER,
        skillId: 29_446,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 7_000, source: target, stateChange: 2 }),
      event({
        time: 7_100,
        target: 5n,
        sourceInstance: 23,
        stateChange: 11
      }),
      event({
        time: 7_100,
        target: PLAYER,
        skillId: 29_446,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 7_100,
        target: PLAYER,
        skillId: 29_446,
        sourceInstance: 23,
        targetInstance: 23,
        value: 2_147_483_647,
        buffDamage: 2_147_483_647,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        [10_646, 'Summon Flesh Golem', 'Elite', 1_000],
        [29_740, 'Grasping Darkness', 'Weapon', 780],
        [29_855, 'Nightfall', 'Weapon', 1_020],
        [30_792, "Reaper's Shroud", 'Profession', 0],
        [30_961, "Exit Reaper's Shroud", 'Profession', 0],
        [30_825, "Death's Charge", 'Profession', 1_200],
        [-3, 'Swap Weapons', 'Action', 0]
      ].map(([id, name, type, castTimeMs]) => ({
        id,
        name,
        type,
        slot: type === 'Profession' ? 'Profession_1' : type,
        specialization: type === 'Profession' ? 'Reaper' : '',
        castTimeMs,
        ...(id === 29_740 ? { quicknessCastTimeMs: 520 } : {}),
        effects: []
      }))
    },
    { inferInstantCasts: false }
  );

  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      'Summon Flesh Golem',
      'Grasping Darkness',
      'Nightfall',
      "Reaper's Shroud",
      "Death's Charge",
      "Exit Reaper's Shroud",
      'Swap Weapons',
      "Reaper's Shroud"
    ]
  );
  assert.deepEqual(
    result.rotation.find((action) => action.name === 'Grasping Darkness'),
    {
      name: 'Grasping Darkness',
      skillId: 29_740
    }
  );
  assert.equal(result.actions.filter((action) => action.name === "Reaper's Shroud").length, 2);
  assert.equal(result.actions.filter((action) => action.name === "Exit Reaper's Shroud").length, 1);
});

test('normalizes Necromancer autoattack packets after chain resets', () => {
  const casts = [
    [29_705, 'Dusk Strike', 1_000, 200, 3],
    [30_799, 'Fading Twilight', 1_300, 200, 3],
    [76_739, 'Nightmare Weapon', 1_600, 100, 3],
    [29_867, 'Chilling Scythe', 1_800, 100, 2],
    [73_012, 'Dark Slash', 2_000, 200, 3],
    [73_012, 'Dark Slash', 2_300, 200, 3],
    [73_012, 'Dark Slash', 2_600, 200, 3],
    [73_013, 'Addle', 2_900, 100, 3],
    [73_047, 'Sinister Stab', 3_100, 200, 3],
    [73_012, 'Dark Slash', 3_400, 100, 4]
  ];
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 76,
        character: 'Fixture Ritualist'
      }
    ],
    skills: casts.map(([id, name]) => ({ id, name })),
    events: casts
      .flatMap(([skillId, , start, duration, activation]) => [
        event({ time: start, stateChange: 67, skillId, value: duration }),
        event({
          time: start + duration,
          stateChange: 68,
          skillId,
          value: duration,
          activation
        })
      ])
      .concat(event({ time: 3_450, skillId: 73_012, value: 100 }))
      .sort((left, right) => left.time - right.time)
  });
  const rotationCatalog = {
    skills: [
      [29_705, 'Dusk Strike', 'Weapon', 'Reaper'],
      [30_799, 'Fading Twilight', 'Weapon', 'Reaper'],
      [29_867, 'Chilling Scythe', 'Weapon', 'Reaper'],
      [73_012, 'Dark Slash', 'Weapon', '', [{ type: 'strike', atMs: 50 }]],
      [73_040, 'Deadly Slice', 'Weapon', '', [{ type: 'strike', atMs: 50 }]],
      [73_047, 'Sinister Stab', 'Weapon', ''],
      [73_013, 'Addle', 'Weapon', ''],
      [76_739, 'Nightmare Weapon', 'Utility', 'Ritualist']
    ].map(([id, name, type, specialization, effects = []]) => ({
      id,
      name,
      type,
      slot: type === 'Weapon' ? 'Weapon_1' : 'Utility',
      specialization,
      castTimeMs: 100,
      effects
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    includeCombatStart: false,
    inferInstantCasts: false
  });

  assert.deepEqual(
    result.actions.map((action) => [action.rawSkillId, action.skillId, action.name]),
    [
      [29_705, 29_705, 'Dusk Strike'],
      [30_799, 30_799, 'Fading Twilight'],
      [76_739, 76_739, 'Nightmare Weapon'],
      [29_867, 29_705, 'Dusk Strike'],
      [73_012, 73_012, 'Dark Slash'],
      [73_012, 73_040, 'Deadly Slice'],
      [73_012, 73_047, 'Sinister Stab'],
      [73_013, 73_013, 'Addle'],
      [73_047, 73_012, 'Dark Slash'],
      [73_012, 73_040, 'Deadly Slice']
    ]
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('interrupted cast')),
    false
  );
});

test('turns a completed no-hit Necromancer autoattack into observed idle time', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 8,
        elite: 76,
        character: 'Fixture Ritualist'
      }
    ],
    skills: [
      { id: 4_000, name: 'Before' },
      { id: 4_001, name: 'No-hit Autoattack' },
      { id: 4_002, name: 'After' }
    ],
    events: [
      event({ time: 1_000, stateChange: 67, skillId: 4_000, value: 300 }),
      event({ time: 1_200, stateChange: 68, skillId: 4_000, value: 200, activation: 3 }),
      event({ time: 1_200, stateChange: 67, skillId: 4_001, value: 900 }),
      event({ time: 1_443, stateChange: 68, skillId: 4_001, value: 243, activation: 3 }),
      event({ time: 1_443, stateChange: 67, skillId: 4_002, value: 360 }),
      event({ time: 1_683, stateChange: 68, skillId: 4_002, value: 240, activation: 3 })
    ]
  });
  const result = reconstructEvtcRotation(
    fixture,
    {
      skills: [
        {
          id: 4_000,
          name: 'Before',
          type: 'Utility',
          slot: 'Utility',
          quicknessCastTimeMs: 200,
          effects: []
        },
        {
          id: 4_001,
          name: 'No-hit Autoattack',
          type: 'Weapon',
          slot: 'Weapon_1',
          quicknessCastTimeMs: 600,
          effects: [{ type: 'strike', atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }]
        },
        {
          id: 4_002,
          name: 'After',
          type: 'Utility',
          slot: 'Utility',
          quicknessCastTimeMs: 240,
          effects: []
        }
      ]
    },
    { includeCombatStart: false, inferInstantCasts: false }
  );

  assert.deepEqual(
    result.actions.map((action) => action.name),
    ['Before', 'After']
  );
  assert.deepEqual(result.rotation, [
    { name: 'Before', skillId: 4_000 },
    { name: '__wait', waitMs: 240 },
    { name: 'After', skillId: 4_002 }
  ]);
});

test('reconstructs Spellbreaker precasts and collapses internal Warrior animations', () => {
  const initialBuff = (skillId) =>
    event({
      time: 1_000,
      target: PLAYER,
      skillId,
      value: 1_000,
      buffDamage: 6_000,
      buff: 18,
      stateChange: 18
    });
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 2,
        elite: 61,
        character: 'Fixture Spellbreaker'
      }
    ],
    skills: [
      [26_980, 'Resistance'],
      [36_781, 'Unblockable'],
      [46_853, 'Peak Performance'],
      [51_664, 'Signet of Fury'],
      [45_333, 'Winds of Disenchantment'],
      [69_297, 'Breaching Strike'],
      [80_247, 'Rend'],
      [80_224, 'Rend'],
      [42_745, 'Precise Cut'],
      [14_518, 'Crushing Blow']
    ].map(([id, name]) => ({ id, name })),
    events: [
      initialBuff(26_980),
      initialBuff(36_781),
      initialBuff(46_853),
      initialBuff(51_664),
      event({ time: 1_000, stateChange: 1 }),
      event({
        time: 1_042,
        target: 0x2000n,
        skillId: 45_333,
        value: 3_000
      }),
      event({
        time: 1_083,
        skillId: 69_297,
        value: 842,
        buffDamage: 839,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 2_000,
        skillId: 80_247,
        value: 840,
        buffDamage: 850,
        stateChange: 67
      }),
      event({
        time: 2_358,
        skillId: 80_247,
        value: 358,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 2_358,
        skillId: 80_224,
        value: 840,
        buffDamage: 850,
        stateChange: 67
      }),
      event({
        time: 2_716,
        skillId: 80_224,
        value: 358,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 3_000,
        skillId: 42_745,
        value: 480,
        buffDamage: 500,
        stateChange: 67
      }),
      event({
        time: 3_200,
        skillId: 42_745,
        value: 200,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 4_000,
        skillId: 14_518,
        value: 960,
        buffDamage: 800,
        stateChange: 67
      }),
      event({
        time: 4_359,
        skillId: 14_518,
        value: 359,
        activation: 4,
        stateChange: 68
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      [14_389, 'Healing Signet', 'Heal', 'Heal', 833, 1_250, []],
      [14_404, 'Signet of Might', 'Utility', 'Utility', 333, 500, []],
      [14_502, 'Kick', 'Utility', 'Utility', 640, 640, []],
      [14_410, 'Signet of Fury', 'Utility', 'Utility', 350, 525, []],
      [45_333, 'Winds of Disenchantment', 'Elite', 'Elite', 1_000, 1_500, []],
      [
        69_297,
        'Breaching Strike',
        'Profession',
        'Profession_1',
        840,
        840,
        [{ type: 'strike', atMs: 760, timingScale: 'fixed' }]
      ],
      [80_247, 'Rend', 'Weapon', 'Weapon_3', 960, 1_440, [{ type: 'strike', atMs: 440, timingScale: 'cast' }]],
      [42_745, 'Precise Cut', 'Weapon', 'Weapon_1', 320, 480, [{ type: 'strike', atMs: 280, timingScale: 'cast' }]],
      [14_518, 'Crushing Blow', 'Weapon', 'Weapon_2', 560, 1_200, [{ type: 'strike', atMs: 308, timingScale: 'cast' }]]
    ].map(([id, name, type, slot, quicknessCastTimeMs, castTimeMs, effects]) => ({
      id,
      name,
      type,
      slot,
      quicknessCastTimeMs,
      castTimeMs,
      effects,
      ...([80_247, 42_745, 14_518].includes(id)
        ? {
            dualWieldCastTimeMs: id === 80_247 ? 720 : id === 42_745 ? 240 : 400
          }
        : {})
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.rotation.slice(0, 7), [
    { name: 'Healing Signet', skillId: 14_389 },
    { name: 'Signet of Might', skillId: 14_404 },
    { name: 'Kick', skillId: 14_502 },
    { name: 'Signet of Fury', skillId: 14_410 },
    { name: 'Winds of Disenchantment', skillId: 45_333 },
    { name: 'Breaching Strike', skillId: 69_297 },
    { name: '__combat_start', offset: 760 }
  ]);
  assert.deepEqual(
    result.actions
      .filter((action) => [80_247, 80_224, 42_745].includes(action.rawSkillId))
      .map((action) => [action.rawSkillId, action.name]),
    [[80_247, 'Rend']]
  );
  assert.equal(result.actions.find((action) => action.name === 'Crushing Blow')?.status, 'completed');
});

test('reconstructs Paragon precasts from initial Warrior buffs', () => {
  const initialBuff = (skillId) =>
    event({
      time: 1_000,
      target: PLAYER,
      skillId,
      value: 1_000,
      buffDamage: 6_000,
      buff: 18,
      stateChange: 18
    });
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 2,
        elite: 74,
        character: 'Fixture Paragon'
      }
    ],
    skills: [{ id: 45_252, name: 'Breaching Strike' }],
    events: [
      initialBuff(26_980),
      initialBuff(719),
      initialBuff(46_853),
      initialBuff(76_865),
      initialBuff(51_664),
      event({ time: 1_000, stateChange: 1 }),
      event({
        time: 1_000,
        target: 0x2000n,
        skillId: 45_252,
        value: 842,
        stateChange: 67
      }),
      event({
        time: 1_842,
        skillId: 45_252,
        value: 842,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      [14_389, 'Healing Signet', 'Heal', 'Heal', 833],
      [14_355, 'Signet of Rage', 'Elite', 'Elite', 167],
      [77_342, 'Chant of Action', 'Profession', 'Profession_1', 167],
      [14_410, 'Signet of Fury', 'Utility', 'Utility', 350],
      [14_516, "Bull's Charge", 'Utility', 'Utility', 640],
      [45_252, 'Breaching Strike', 'Profession', 'Profession_1', 842]
    ].map(([id, name, type, slot, quicknessCastTimeMs]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs: quicknessCastTimeMs,
      quicknessCastTimeMs,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.rotation.slice(0, 7).map((action) => action.name),
    [
      'Healing Signet',
      'Signet of Rage',
      'Chant of Action',
      'Signet of Fury',
      "Bull's Charge",
      '__combat_start',
      'Breaching Strike'
    ]
  );
  assert.deepEqual(
    result.actions.filter((action) => action.evidence === 'initial-state').map((action) => action.name),
    ['Healing Signet', 'Signet of Rage', 'Chant of Action', 'Signet of Fury', "Bull's Charge"]
  );
});

test('reconstructs Galeshot bundle, pet, and Path of Scars mechanics', () => {
  const carrionDevourer = 0x3000n;
  const fangedIboga = 0x3001n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 4,
        elite: 78,
        character: 'Fixture Galeshot'
      },
      {
        ...log().agents[0],
        address: carrionDevourer,
        profession: 5_581,
        elite: 0xffffffff,
        character: 'Juvenile Carrion Devourer'
      },
      {
        ...log().agents[0],
        address: fangedIboga,
        profession: 18_688,
        elite: 0xffffffff,
        character: 'Juvenile Fanged Iboga'
      }
    ],
    skills: [
      { id: 12_469, name: 'Barrage' },
      { id: 12_638, name: 'Path of Scars' },
      { id: 12_675, name: 'Poisonous Cloud' },
      { id: 45_262, name: 'Narcotic Spores' },
      { id: 76_807, name: "Quarry's Peril" },
      { id: 77_319, name: 'Bluster' }
    ],
    events: [
      event({
        time: 900,
        source: carrionDevourer,
        sourceInstance: 24,
        sourceMasterInstance: 23,
        skillId: 12_675,
        value: 300,
        activation: 5
      }),
      event({ time: 1_000, sourceInstance: 23, stateChange: 1 }),
      event({
        time: 1_100,
        sourceInstance: 23,
        skillId: 12_469,
        value: 600,
        buffDamage: 900,
        activation: 3
      }),
      event({
        time: 1_100,
        sourceInstance: 23,
        skillId: 77_319,
        value: 1_200,
        buffDamage: 1_300,
        activation: 1
      }),
      event({
        time: 1_100,
        sourceInstance: 23,
        skillId: 77_319,
        activation: 4
      }),
      event({
        time: 1_780,
        sourceInstance: 23,
        skillId: 76_807,
        value: 400,
        activation: 1
      }),
      event({
        time: 2_180,
        sourceInstance: 23,
        skillId: 76_807,
        value: 400,
        activation: 3
      }),
      event({
        time: 2_300,
        source: fangedIboga,
        sourceInstance: 25,
        stateChange: 6
      }),
      event({
        time: 2_400,
        source: fangedIboga,
        sourceInstance: 25,
        sourceMasterInstance: 23,
        skillId: 45_262,
        value: 600,
        activation: 1
      }),
      event({
        time: 2_900,
        source: fangedIboga,
        sourceInstance: 25,
        sourceMasterInstance: 23,
        skillId: 45_262,
        value: 500,
        activation: 5
      }),
      event({
        time: 3_000,
        sourceInstance: 23,
        skillId: 12_638,
        value: 440,
        activation: 1
      }),
      event({
        time: 3_440,
        sourceInstance: 23,
        skillId: 12_638,
        value: 440,
        activation: 3
      }),
      event({ time: 3_400, target: 0x4000n, skillId: 12_638, value: 100 }),
      event({ time: 4_800, target: 0x4000n, skillId: 12_638, value: 100 }),
      event({
        time: 5_000,
        sourceInstance: 23,
        target: 4n,
        value: 2,
        stateChange: 11
      }),
      event({
        time: 6_000,
        sourceInstance: 23,
        target: 5n,
        value: 4,
        stateChange: 11
      }),
      event({
        time: 7_000,
        sourceInstance: 23,
        target: 2n,
        value: 5,
        stateChange: 11
      }),
      event({
        time: 8_000,
        sourceInstance: 23,
        skillId: 12_638,
        value: 440,
        activation: 1
      }),
      event({
        time: 8_440,
        sourceInstance: 23,
        skillId: 12_638,
        value: 440,
        activation: 3
      }),
      event({ time: 8_400, target: 0x4000n, skillId: 12_638, value: 100 }),
      event({ time: 8_900, target: 0x4000n, skillId: 12_638, value: 100 })
    ]
  });
  const rotationCatalog = {
    skills: [
      [12_469, 'Barrage', 'Weapon', '', 1_880],
      [12_638, 'Path of Scars', 'Weapon', '', 440],
      [-1_001, 'Path of Scars (Max Range)', 'Weapon', '', 440],
      [76_807, "Quarry's Peril", 'Bundle', 'Galeshot', 680],
      [77_319, 'Bluster', 'Bundle', 'Galeshot', 680],
      [76_787, 'Summon Cyclone Bow', 'Profession', 'Galeshot', 0],
      [77_213, 'Dismiss Cyclone Bow', 'Profession', 'Galeshot', 0],
      [-3, 'Swap Weapons', 'Action', '', 0],
      [-4, 'Swap Pets', 'Action', '', 0],
      [12_675, 'Poisonous Cloud', 'Profession', '', 880],
      [45_262, 'Narcotic Spores', 'Profession', '', 720]
    ].map(([id, name, type, specialization, quicknessCastTimeMs]) => ({
      id,
      name,
      type,
      slot: type === 'Weapon' || type === 'Bundle' ? 'Weapon_1' : 'Action',
      specialization,
      castTimeMs: quicknessCastTimeMs,
      quicknessCastTimeMs,
      effects: [],
      ...([12_675, 45_262].includes(id)
        ? {
            petSkill: true,
            petAutonomousSkill: false,
            independentCast: true,
            independentCastCanOverlap: true
          }
        : {})
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, {
    inferInstantCasts: false
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.rotation.slice(0, 5), [
    { name: 'Barrage', skillId: 12_469 },
    { name: 'Summon Cyclone Bow', skillId: 76_787, offset: 0 },
    { name: 'Poisonous Cloud', skillId: 12_675, offset: 120 },
    { name: '__combat_start', offset: 520 },
    { name: 'Bluster', skillId: 77_319 }
  ]);
  assert.deepEqual(
    result.actions
      .filter((action) =>
        ['Summon Cyclone Bow', 'Dismiss Cyclone Bow', 'Swap Weapons', 'Swap Pets'].includes(action.name)
      )
      .map((action) => [action.name, action.skillId, action.weaponSet]),
    [
      ['Summon Cyclone Bow', 76_787, 2],
      ['Swap Pets', -4, undefined],
      ['Dismiss Cyclone Bow', 77_213, 4],
      ['Swap Weapons', -3, 5],
      ['Summon Cyclone Bow', 76_787, 2]
    ]
  );
  assert.deepEqual(
    result.actions.filter((action) => action.rawSkillId === 12_638).map((action) => [action.name, action.skillId]),
    [
      ['Path of Scars (Max Range)', -1_001],
      ['Path of Scars', 12_638]
    ]
  );
  assert.deepEqual(
    result.actions
      .filter((action) => ['Poisonous Cloud', 'Narcotic Spores'].includes(action.name))
      .map((action) => [action.name, action.evidence]),
    [
      ['Poisonous Cloud', 'initial-state'],
      ['Narcotic Spores', 'animation']
    ]
  );
  assert.deepEqual(
    result.actions.find((action) => action.name === 'Bluster'),
    {
      timestampMs: 600,
      endTimestampMs: 1_280,
      durationMs: 680,
      expectedDurationMs: 680,
      rawSkillId: 77_319,
      skillId: 77_319,
      name: 'Bluster',
      kind: 'unknown',
      evidence: 'legacy-activation',
      status: 'completed',
      supportedByCatalog: true
    }
  );
});

test('reconstructs Revenant legend, warband, and split animation mechanics', () => {
  const razorclaw = 0x3000n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 9,
        elite: 63,
        character: 'Fixture Renegade'
      },
      {
        ...log().agents[0],
        address: razorclaw,
        profession: 18_791,
        elite: 0xffffffff,
        character: 'Jas Razorclaw'
      }
    ],
    skills: [
      { id: 44_272, name: 'Legendary Renegade Stance' },
      { id: 46_849, name: 'Call of the Renegade' },
      { id: 27_074, name: 'Deathstrike' },
      { id: 28_625, name: 'Deathstrike' },
      { id: 29_057, name: 'Preparation Thrust' },
      { id: 29_256, name: 'Brutal Blade' },
      { id: 72_370, name: "Razorclaw's Rage" }
    ],
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({
        time: 1_100,
        target: PLAYER,
        skillId: 44_272,
        value: 2_147_483_647,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 1_101,
        target: 0x2000n,
        skillId: 46_849,
        value: 100
      }),
      event({ time: 1_200, skillId: 27_074, value: 720, stateChange: 67 }),
      event({
        time: 1_560,
        skillId: 27_074,
        value: 360,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 1_560, skillId: 28_625, value: 480, stateChange: 67 }),
      event({
        time: 1_920,
        skillId: 28_625,
        value: 360,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 2_000, skillId: 29_057, value: 540, stateChange: 67 }),
      event({
        time: 2_100,
        skillId: 29_057,
        value: 100,
        activation: 4,
        stateChange: 68
      }),
      event({ time: 2_100, skillId: 29_256, value: 840, stateChange: 67 }),
      event({ time: 2_320, skillId: 29_057, value: 100 }),
      event({
        time: 2_660,
        skillId: 29_256,
        value: 560,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 2_700,
        source: razorclaw,
        sourceInstance: 24,
        sourceMasterInstance: 1,
        skillId: 72_370,
        stateChange: 67
      }),
      event({ time: 2_700, skillId: 29_057, value: 540, stateChange: 67 }),
      event({
        time: 3_060,
        skillId: 29_057,
        value: 360,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      [-4, 'Swap Legends', 'Profession', 'Profession_1', 0, []],
      [46_849, 'Call of the Renegade', 'Action', 'Action', 0, []],
      [27_074, 'Deathstrike', 'Weapon', 'Weapon_3', 720, []],
      [28_625, 'Deathstrike', 'Action', 'Action', 0, []],
      [29_057, 'Preparation Thrust', 'Weapon', 'Weapon_1', 360, [{ type: 'strike', atMs: 320 }]],
      [29_256, 'Brutal Blade', 'Weapon', 'Weapon_1', 560, [{ type: 'strike', atMs: 480 }]],
      [42_949, "Razorclaw's Rage", 'Utility', 'Utility', 500, []]
    ].map(([id, name, type, slot, quicknessCastTimeMs, effects]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs: quicknessCastTimeMs,
      quicknessCastTimeMs,
      effects
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map((action) => action.name),
    ['Swap Legends', 'Deathstrike', 'Preparation Thrust', 'Brutal Blade', 'Preparation Thrust', "Razorclaw's Rage"]
  );
  assert.equal(result.actions.filter((action) => action.name === 'Deathstrike').length, 1);
  assert.equal(
    result.actions.some((action) => action.name === 'Call of the Renegade'),
    false
  );
  const finalAutoattack = result.actions.filter((action) => action.name === 'Preparation Thrust').at(-1);
  const inferredRazorclaw = result.actions.find((action) => action.name === "Razorclaw's Rage");
  assert.equal(inferredRazorclaw.timestampMs - finalAutoattack.timestampMs, 100);
  assert.equal(result.rotation.find((action) => action.name === "Razorclaw's Rage")?.offset, 120);
});

test('packs initial Renegade summons against the first cast and chains later concurrent offsets', () => {
  const icerazor = 0x3000n;
  const razorclaw = 0x3001n;
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 9,
        elite: 63,
        character: 'Fixture Renegade'
      },
      {
        ...log().agents[0],
        address: icerazor,
        profession: 18_524,
        elite: 0xffffffff,
        character: 'Visk Icerazor'
      },
      {
        ...log().agents[0],
        address: razorclaw,
        profession: 18_791,
        elite: 0xffffffff,
        character: 'Jas Razorclaw'
      }
    ],
    skills: [
      { id: 28_357, name: 'Searing Fissure' },
      { id: 44_272, name: 'Legendary Renegade Stance' },
      { id: 72_370, name: "Razorclaw's Rage" }
    ],
    events: [
      event({
        time: 1_000,
        source: icerazor,
        sourceInstance: 24,
        sourceMasterInstance: 1,
        stateChange: 18
      }),
      event({ time: 2_000, skillId: 28_357, value: 600, stateChange: 67 }),
      event({
        time: 2_200,
        source: razorclaw,
        sourceInstance: 25,
        sourceMasterInstance: 1,
        skillId: 72_370,
        stateChange: 67
      }),
      event({ time: 2_280, stateChange: 1 }),
      event({
        time: 2_520,
        target: PLAYER,
        skillId: 44_272,
        value: 2_147_483_647,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 2_600, skillId: 28_357, value: 600, activation: 3, stateChange: 68 })
    ]
  });
  const rotationCatalog = {
    skills: [
      [-4, 'Swap Legends', 'Profession', 'Profession_1', 0],
      [28_357, 'Searing Fissure', 'Weapon', 'Weapon_2', 600],
      [40_485, "Icerazor's Ire", 'Utility', 'Utility', 520],
      [42_949, "Razorclaw's Rage", 'Utility', 'Utility', 500]
    ].map(([id, name, type, slot, quicknessCastTimeMs]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs: quicknessCastTimeMs,
      quicknessCastTimeMs,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog);

  assert.deepEqual(
    result.rotation.map(({ name, offset, waitMs }) => ({ name, offset, waitMs })),
    [
      { name: "Icerazor's Ire", offset: undefined, waitMs: undefined },
      { name: 'Searing Fissure', offset: undefined, waitMs: undefined },
      { name: "Razorclaw's Rage", offset: 200, waitMs: undefined },
      { name: '__combat_start', offset: 80, waitMs: undefined },
      { name: 'Swap Legends', offset: 320, waitMs: undefined }
    ]
  );
});

test('does not duplicate a truncated Revenant weapon precast recovered by the generic parser', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 9,
        elite: 63,
        character: 'Fixture Renegade'
      }
    ],
    skills: [
      { id: 28_357, name: 'Searing Fissure' },
      { id: 28_409, name: 'Temporal Rift' },
      { id: 44_272, name: 'Legendary Renegade Stance' }
    ],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        skillId: 44_272,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1_400, target: 0x2000n, skillId: 28_357, value: 100 }),
      event({ time: 1_460, stateChange: 1 }),
      event({
        time: 1_600,
        skillId: 28_357,
        value: 600,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 2_000, skillId: 28_409, value: 600, stateChange: 67 }),
      event({
        time: 2_600,
        skillId: 28_409,
        value: 600,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      [28_357, 'Searing Fissure'],
      [28_409, 'Temporal Rift']
    ].map(([id, name]) => ({
      id,
      name,
      type: 'Weapon',
      slot: 'Weapon_2',
      castTimeMs: 600,
      quicknessCastTimeMs: 600,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog);

  assert.equal(result.actions.filter((action) => action.name === 'Searing Fissure').length, 1);
});

test('preserves cancelled Revenant autoattacks and per-packet cast timing', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 9,
        elite: 63,
        character: 'Fixture Renegade'
      }
    ],
    skills: [
      { id: 40_497, name: 'Shattershot' },
      { id: 40_175, name: 'Bloodbane Path' }
    ],
    events: [
      event({ time: 1_000, stateChange: 1 }),
      event({ time: 1_100, skillId: 40_497, value: 488, stateChange: 67 }),
      event({ time: 1_100, skillId: 40_497, activation: 4, stateChange: 68 }),
      event({ time: 1_200, skillId: 40_497, value: 488, stateChange: 67 }),
      event({ time: 1_597, skillId: 40_497, value: 397, activation: 4, stateChange: 68 }),
      event({ time: 1_600, skillId: 40_497, value: 488, stateChange: 67 }),
      event({ time: 2_080, skillId: 40_497, value: 480, activation: 3, stateChange: 68 }),
      event({ time: 2_200, skillId: 40_175, value: 760, stateChange: 67 }),
      event({ time: 2_519, skillId: 40_175, value: 319, activation: 3, stateChange: 68 })
    ]
  });
  const rotationCatalog = {
    skills: [
      {
        id: 40_497,
        name: 'Shattershot',
        type: 'Weapon',
        slot: 'Weapon_1',
        castTimeMs: 480,
        quicknessCastTimeMs: 480,
        interruptCommitMs: 400,
        effects: []
      },
      {
        id: 40_175,
        name: 'Bloodbane Path',
        type: 'Weapon',
        slot: 'Weapon_2',
        castTimeMs: 760,
        quicknessCastTimeMs: 760,
        interruptMode: 'per-packet',
        effects: []
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog, { inferInstantCasts: false });

  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Shattershot' || action.name === 'Bloodbane Path')
      .map(({ name, durationMs }) => [name, durationMs]),
    [
      ['Shattershot', 397],
      ['Shattershot', 480],
      ['Bloodbane Path', 319]
    ]
  );
  assert.deepEqual(
    result.rotation.filter((command) => command.name === 'Shattershot' || command.name === 'Bloodbane Path'),
    [
      { name: 'Shattershot', skillId: 40_497, interruptMs: 400 },
      { name: 'Shattershot', skillId: 40_497 },
      { name: 'Bloodbane Path', skillId: 40_175, interruptMs: 319 }
    ]
  );
});

test('reconstructs Herald initial facets and later facet activations', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 9,
        elite: 52,
        character: 'Fixture Herald'
      }
    ],
    skills: [
      { id: 27_732, name: 'Legendary Dragon Stance' },
      { id: 27_928, name: 'Legendary Demon Stance' },
      { id: 28_243, name: 'Facet of Elements' },
      { id: 28_287, name: 'Embrace the Darkness' },
      { id: 59_591, name: 'Invoke Torment' }
    ],
    events: [
      event({
        time: 900,
        target: PLAYER,
        skillId: 27_732,
        value: 2_147_483_647,
        buffDamage: 2_147_483_647,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1_000, stateChange: 1 }),
      event({
        time: 1_100,
        target: PLAYER,
        skillId: 28_243,
        value: 2_147_483_647,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 1_200,
        target: PLAYER,
        skillId: 27_928,
        value: 2_147_483_647,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 1_201, target: 0x2000n, skillId: 59_591, value: 100 }),
      event({ time: 1_300, skillId: 28_287, value: 440, stateChange: 67 }),
      event({
        time: 1_740,
        skillId: 28_287,
        value: 440,
        activation: 3,
        stateChange: 68
      })
    ]
  });
  const rotationCatalog = {
    skills: [
      [-4, 'Swap Legends', 'Profession', 'Profession_1', 0],
      [27_220, 'Facet of Light', 'Heal', 'Heal', 250],
      [28_379, 'Facet of Darkness', 'Utility', 'Utility', 0],
      [27_014, 'Facet of Elements', 'Utility', 'Utility', 0],
      [26_644, 'Facet of Strength', 'Utility', 'Utility', 0],
      [27_760, 'Facet of Chaos', 'Elite', 'Elite', 0],
      [29_371, 'Facet of Nature', 'Profession', 'Profession_2', 0],
      [28_287, 'Embrace the Darkness', 'Elite', 'Elite', 440],
      [59_591, 'Invoke Torment', 'Action', 'Action', 0]
    ].map(([id, name, type, slot, quicknessCastTimeMs]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs: quicknessCastTimeMs,
      quicknessCastTimeMs,
      effects: []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.filter((action) => action.evidence === 'initial-state').map((action) => action.name),
    [
      'Facet of Light',
      'Facet of Darkness',
      'Facet of Elements',
      'Facet of Strength',
      'Facet of Chaos',
      'Facet of Nature'
    ]
  );
  assert.equal(result.actions.filter((action) => action.name === 'Facet of Elements').length, 2);
  assert.equal(
    result.actions.some((action) => action.name === 'Invoke Torment'),
    false
  );
});

test('reconstructs Conduit state packets and Cosmic Wisdom skill variants', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 9,
        elite: 79,
        character: 'Fixture Conduit'
      }
    ],
    skills: [
      { id: 77234, name: 'Legendary Entity Stance' },
      { id: 27928, name: 'Legendary Demon Stance' },
      { id: 76559, name: 'Cosmic Wisdom' },
      { id: 77243, name: 'Hex-Eater Vortex' },
      { id: 28409, name: 'Temporal Rift' },
      { id: 76968, name: 'Twin Moon Sweep' },
      { id: 78191, name: 'Embrace the Darkness' },
      { id: 76818, name: 'Form of the Dervish' },
      { id: 77116, name: 'Form of the Dervish' },
      { id: 73149, name: 'Blitz Mines' },
      { id: 28029, name: 'Frigid Blitz' },
      { id: 26923, name: 'Frigid Blitz' }
    ],
    events: [
      event({
        time: 1000,
        target: PLAYER,
        skillId: 77234,
        value: 2_147_483_647,
        buffDamage: 2_147_483_647,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1076, skillId: 77243, value: 518, activation: 3 }),
      event({ time: 1076, skillId: 76968, value: 921, activation: 1 }),
      event({ time: 1156, target: PLAYER, skillId: 76559, value: 7000, buff: 1 }),
      event({ time: 1200, target: 0x2000n, skillId: 28409, value: 1000 }),
      event({
        time: 1318,
        target: PLAYER,
        skillId: 27928,
        value: 2_147_483_647,
        buff: 1
      }),
      event({ time: 1997, skillId: 76968, value: 921, activation: 3 }),
      event({ time: 1997, skillId: 78191, value: 440, activation: 1 }),
      event({ time: 2100, target: 0x2000n, skillId: 76818, value: 1000 }),
      event({ time: 2200, target: 0x2000n, skillId: 77116, value: 1000 }),
      event({ time: 2250, target: 0x2000n, skillId: 73149, value: 1000 }),
      event({ time: 2437, skillId: 78191, value: 440, activation: 3 }),
      event({ time: 3000, skillId: 28029, value: 320, activation: 1 }),
      event({ time: 3320, skillId: 28029, value: 320, activation: 3 }),
      event({ time: 3320, skillId: 26923, value: 641, activation: 1 }),
      event({ time: 3961, skillId: 26923, value: 641, activation: 3 }),
      event({ time: 3961, skillId: 27066, value: 440, activation: 1 }),
      event({ time: 4118, skillId: 27066, value: 157, activation: 3 }),
      event({ time: 4200, source: 0x2000n, target: 0n, stateChange: 4 }),
      event({ time: 4300, skillId: 27066, value: 440, activation: 1 }),
      event({ time: 4740, skillId: 27066, value: 440, activation: 5 })
    ]
  });
  const rotationCatalog = {
    skills: [
      [-4, 'Swap Legends', 'Profession', 'Profession_1', 0],
      [77371, 'Cosmic Wisdom', 'Profession', 'Profession_2', 0],
      [28409, 'Temporal Rift', 'Weapon', 'Weapon_5', 560],
      [77243, 'Hex-Eater Vortex', 'Utility', 'Utility', 518],
      [76968, 'Twin Moon Sweep', 'Elite', 'Elite', 921],
      [28287, 'Embrace the Darkness', 'Elite', 'Elite', 440],
      [76818, 'Form of the Dervish', 'Action', 'Action', 0],
      [77116, 'Form of the Dervish (Elite)', 'Action', 'Action', 0],
      [73149, 'Blitz Mines', 'Action', 'Action', 0],
      [28029, 'Frigid Blitz', 'Weapon', 'Weapon_3', 961],
      [27066, 'Misery Swipe', 'Weapon', 'Weapon_1', 440]
    ].map(([id, name, type, slot, quicknessCastTimeMs]) => ({
      id,
      name,
      type,
      slot,
      castTimeMs: quicknessCastTimeMs,
      quicknessCastTimeMs,
      effects:
        id === 27066
          ? [{ type: 'strike', atMs: 280 }]
          : id === 28409
            ? [{ type: 'strike', atMs: 640, timingAnchor: 'castEnd' }]
            : []
    }))
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.combatStartTimestampMs, 1000);
  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait').map((command) => command.name),
    [
      'Temporal Rift',
      'Hex-Eater Vortex',
      '__combat_start',
      'Twin Moon Sweep',
      'Cosmic Wisdom',
      'Swap Legends',
      'Embrace the Darkness',
      'Frigid Blitz',
      'Misery Swipe'
    ]
  );
  assert.equal(result.actions.filter((action) => action.name === 'Frigid Blitz').length, 1);
  assert.equal(
    result.actions.some((action) => action.name.startsWith('Form of the Dervish')),
    false
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Blitz Mines'),
    false
  );
  assert.equal(result.actions.find((action) => action.name === 'Misery Swipe')?.durationMs, 157);
  assert.equal(result.rotation.find((command) => command.name === 'Misery Swipe')?.interruptMs, 160);
  assert.equal(
    result.actions.every((action) => action.supportedByCatalog),
    true
  );
});

test('recovers a truncated Spiritcrush precast for non-Herald Revenants', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 9,
        elite: 69,
        character: 'Fixture Vindicator'
      }
    ],
    skills: [{ id: 43_993, name: 'Spiritcrush' }],
    events: [event({ time: 3_000, stateChange: 1 }), event({ time: 3_500, skillId: 43_993, value: 100 })]
  });
  const rotationCatalog = {
    skills: [
      {
        id: 43_993,
        name: 'Spiritcrush',
        type: 'Weapon',
        slot: 'Weapon_4',
        castTimeMs: 400,
        quicknessCastTimeMs: 400,
        effects: [{ type: 'strike', atMs: 1_320 }]
      }
    ]
  };

  const result = reconstructEvtcRotation(fixture, rotationCatalog);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Spiritcrush')
      .map((action) => ({
        timestampMs: action.timestampMs,
        endTimestampMs: action.endTimestampMs,
        evidence: action.evidence
      })),
    [
      {
        timestampMs: 0,
        endTimestampMs: 400,
        evidence: 'initial-state'
      }
    ]
  );
});

test('reconstructs Bladesworn Gunsaber unsheathe and sheathe transitions', () => {
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 2,
        elite: 68,
        character: 'Fixture Bladesworn'
      }
    ],
    skills: [{ id: 62_769, name: 'Gunsaber Mode' }],
    events: [
      event({
        time: 1_000,
        target: PLAYER,
        value: 10_000,
        skillId: 62_769,
        buff: 1
      }),
      event({ time: 1_010, target: 4n, stateChange: 11 }),
      event({
        time: 3_000,
        target: PLAYER,
        skillId: 62_769,
        buff: 1,
        buffRemove: 1,
        stateChange: 72
      }),
      event({ time: 3_010, target: 5n, stateChange: 11 })
    ]
  });
  const result = reconstructEvtcRotation(fixture, {
    skills: [
      {
        id: 62_745,
        name: 'Unsheathe Gunsaber',
        type: 'Profession',
        slot: 'Profession_1',
        castTimeMs: 0,
        effects: []
      },
      {
        id: 62_861,
        name: 'Sheathe Gunsaber',
        type: 'Profession',
        slot: 'Profession_1',
        castTimeMs: 0,
        effects: []
      },
      catalog.skills.at(-1)
    ]
  });

  assert.deepEqual(
    result.actions.map((action) => [action.name, action.skillId, action.evidence]),
    [
      ['Unsheathe Gunsaber', 62_745, 'buff-transition'],
      ['Sheathe Gunsaber', 62_861, 'buff-transition']
    ]
  );
});

test('canonicalizes Paragon Breaching Strike and Bloodthirster EVTC IDs', () => {
  const rawIds = [69_297, 69_433, 80_252, 80_263];
  const fixture = log({
    agents: [
      {
        ...log().agents[0],
        profession: 2,
        elite: 74,
        character: 'Fixture Paragon'
      }
    ],
    skills: rawIds.map((id) => ({
      id,
      name: id < 80_000 ? 'Breaching Strike' : 'Bloodthirster'
    })),
    events: rawIds.flatMap((skillId, index) => {
      const time = 1_000 + index * 1_000;

      return [
        event({ time, stateChange: 67, skillId, value: 500 }),
        event({
          time: time + 500,
          stateChange: 68,
          skillId,
          value: 500,
          activation: 5
        })
      ];
    })
  });
  const canonicalCatalog = {
    skills: [
      {
        id: 45_252,
        name: 'Breaching Strike',
        type: 'Profession',
        slot: 'Profession_1',
        castTimeMs: 842,
        effects: []
      },
      {
        id: 80_203,
        name: 'Bloodthirster',
        type: 'Profession',
        slot: 'Profession_1',
        castTimeMs: 440,
        effects: []
      },
      {
        id: 69_297,
        name: 'Breaching Strike',
        type: 'Profession',
        slot: 'Profession_1',
        castTimeMs: 840,
        effects: []
      },
      {
        id: 80_252,
        name: 'Bloodthirster',
        type: 'Profession',
        slot: 'Profession_1',
        castTimeMs: 440,
        effects: []
      }
    ]
  };
  const result = reconstructEvtcRotation(fixture, canonicalCatalog);

  assert.deepEqual(
    result.actions.map((action) => [action.rawSkillId, action.skillId]),
    [
      [69_297, 45_252],
      [69_433, 45_252],
      [80_252, 80_203],
      [80_263, 80_203]
    ]
  );

  const spellbreaker = reconstructEvtcRotation(
    log({
      agents: [
        {
          ...log().agents[0],
          profession: 2,
          elite: 61,
          character: 'Fixture Spellbreaker'
        }
      ],
      skills: [{ id: 69_297, name: 'Breaching Strike' }],
      events: [event({ stateChange: 67, skillId: 69_297 })]
    }),
    canonicalCatalog
  );

  assert.equal(spellbreaker.actions[0].skillId, 45_252);
});

test('supports the legacy single-event activation encoding', () => {
  const fixture = log({
    events: [
      event({
        time: 2_000,
        skillId: 3_000,
        value: 500,
        activation: 3
      })
    ]
  });
  const result = reconstructEvtcRotation(fixture, catalog, {
    includeCombatStart: false
  });

  assert.deepEqual(result.actions[0], {
    timestampMs: 0,
    endTimestampMs: 500,
    durationMs: 500,
    expectedDurationMs: 500,
    rawSkillId: 3_000,
    skillId: 3_000,
    name: 'Blink',
    kind: 'utility',
    evidence: 'legacy-activation',
    status: 'completed',
    supportedByCatalog: true
  });
  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__wait'),
    [{ name: 'Blink', skillId: 3_000 }]
  );
});

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
  assert.deepEqual(
    result.actions.map((action) => action.name),
    ['Dodge', 'Steal', "Assassin's Signet", 'Death Blossom', 'Dagger Strike']
  );
  assert.deepEqual(
    result.actions.find((action) => action.name === 'Death Blossom'),
    {
      timestampMs: 2_000,
      endTimestampMs: 3_040,
      durationMs: 1_040,
      expectedDurationMs: 1_040,
      rawSkillId: 13_106,
      skillId: 13_106,
      name: 'Death Blossom',
      kind: 'weapon-skill',
      evidence: 'animation',
      status: 'completed',
      supportedByCatalog: true
    }
  );
  assert.deepEqual(
    result.rotation.find((command) => command.name === 'Dagger Strike'),
    {
      name: 'Dagger Strike',
      skillId: 13_004,
      interruptMs: 40
    }
  );
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
