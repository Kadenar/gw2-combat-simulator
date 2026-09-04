import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event, log } from '../helpers/evtc-fixture.js';

describe('Ritualist initial-state reconstruction', () => {
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

  test('recovers one opening cast for each player-owned minion type', () => {
    assert.deepEqual(
      result.actions.filter((action) => action.evidence === 'initial-state').map((action) => action.name),
      ['Summon Blood Fiend', 'Summon Flesh Golem', 'Summon Bone Minions']
    );
  });

  test('aligns the opening shroud sequence to combat start', () => {
    assert.deepEqual(result.rotation.slice(3, 6), [
      { name: "Ritualist's Shroud", skillId: 77_238 },
      { name: 'Anguish', skillId: 76_864 },
      { name: '__combat_start', offset: 360 }
    ]);
  });

  test('reconstructs shroud entry and exit from buff transitions', () => {
    assert.deepEqual(
      result.actions.filter((action) => action.evidence === 'buff-transition').map((action) => action.name),
      ["Ritualist's Shroud", "Exit Ritualist's Shroud"]
    );
  });
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

describe('Reaper shroud and opening precast reconstruction', () => {
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

  test('recovers truncated opening minion and weapon precasts', () => {
    assert.deepEqual(
      result.actions.slice(0, 3).map((action) => action.name),
      ['Summon Flesh Golem', 'Grasping Darkness', 'Nightfall']
    );
    assert.deepEqual(
      result.rotation.find((action) => action.name === 'Grasping Darkness'),
      {
        name: 'Grasping Darkness',
        skillId: 29_740
      }
    );
  });

  test('reconstructs shroud transitions without duplicating the late exit', () => {
    assert.deepEqual(
      result.actions.filter((action) => action.name.includes("Reaper's Shroud")).map((action) => action.name),
      ["Reaper's Shroud", "Exit Reaper's Shroud", "Reaper's Shroud"]
    );
  });

  test('preserves weapon swaps between shroud cycles', () => {
    assert.equal(result.actions.filter((action) => action.name === 'Swap Weapons').length, 1);
  });
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
