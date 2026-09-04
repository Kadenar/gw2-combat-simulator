import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event, log } from '../helpers/evtc-fixture.js';

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

describe('Galeshot rotation reconstruction', () => {
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

  test('packs opening bundle and pet actions around combat start', () => {
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(result.rotation.slice(0, 5), [
      { name: 'Barrage', skillId: 12_469 },
      { name: 'Summon Cyclone Bow', skillId: 76_787, offset: 0 },
      { name: 'Poisonous Cloud', skillId: 12_675, offset: 120 },
      { name: '__combat_start', offset: 520 },
      { name: 'Bluster', skillId: 77_319 }
    ]);
  });

  test('reconstructs bundle, pet, and weapon transitions', () => {
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
  });

  test('distinguishes Path of Scars ranges from packet timing', () => {
    assert.deepEqual(
      result.actions.filter((action) => action.rawSkillId === 12_638).map((action) => [action.name, action.skillId]),
      [
        ['Path of Scars (Max Range)', -1_001],
        ['Path of Scars', 12_638]
      ]
    );
  });

  test('recovers player-owned pet skills from their evidence', () => {
    assert.deepEqual(
      result.actions
        .filter((action) => ['Poisonous Cloud', 'Narcotic Spores'].includes(action.name))
        .map((action) => [action.name, action.evidence]),
      [
        ['Poisonous Cloud', 'initial-state'],
        ['Narcotic Spores', 'animation']
      ]
    );
  });

  test('normalizes legacy Bluster activation timing', () => {
    const bluster = result.actions.find((action) => action.name === 'Bluster');

    assert.deepEqual(
      [bluster.timestampMs, bluster.durationMs, bluster.evidence, bluster.status],
      [600, 680, 'legacy-activation', 'completed']
    );
  });
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
  assert.equal(
    result.actions.some((action) => action.name === 'Swap Legends'),
    true
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
  assert.equal(
    result.actions.some((action) => action.name === 'Twin Moon Sweep'),
    true
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Cosmic Wisdom'),
    true
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Swap Legends'),
    true
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

  const action = result.actions.find((candidate) => candidate.name === 'Blink');

  assert.equal(action?.durationMs, 500);
  assert.equal(action?.evidence, 'legacy-activation');
  assert.equal(action?.status, 'completed');
});
