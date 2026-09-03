import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';

const PLAYER = 0x1000n;

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

function warriorLog(elite, skills, events) {
  return {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260718',
      revision: 1,
      encounterId: 16_199,
      agentCount: 1,
      skillCount: skills.length,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 2,
        elite,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Warrior',
        account: ':Fixture.1234',
        subgroup: '1'
      }
    ],
    skills,
    events
  };
}

function skill(id, name, type, slot, quicknessCastTimeMs, options = {}) {
  return {
    id,
    name,
    type,
    slot,
    castTimeMs: quicknessCastTimeMs,
    quicknessCastTimeMs,
    effects: [],
    ...options
  };
}

function animation(skillId, start, end, options = {}) {
  return [
    event({
      time: start,
      skillId,
      value: end - start,
      stateChange: options.modern ? 67 : 0,
      activation: options.modern ? 0 : 1
    }),
    event({
      time: end,
      skillId,
      value: end - start,
      activation: options.interrupted ? 4 : 3,
      stateChange: options.modern ? 68 : 0
    })
  ];
}

test('places EVTC combat start at the opening Head Butt strike so replay retains its damage', () => {
  const headButtAnimation = animation(30_343, 1_000, 1_765, { modern: true });
  const fixture = warriorLog(
    18,
    [{ id: 30_343, name: 'Head Butt' }],
    [headButtAnimation[0], event({ time: 1_760, stateChange: 1 }), headButtAnimation[1]]
  );
  const reconstruction = reconstructEvtcRotation(fixture, warriorCatalog, { inferInstantCasts: false });
  const simulation = simulateGw2({
    profession: warriorProfession,
    rotation: reconstruction.rotation,
    config: {
      specialization: 'Berserker',
      stats: { power: 2_000, precision: 1_500, ferocity: 500, conditionDamage: 0, expertise: 0 },
      target: { armor: 2_597, health: 1_000_000, conditions: { Vulnerability: 25 }, defiant: true }
    },
    mode: 'sequence'
  });

  assert.deepEqual(reconstruction.rotation, [
    { name: 'Head Butt', skillId: 30_343 },
    { name: '__combat_start', offset: 720 }
  ]);
  assert.ok(
    simulation.resolvedEvents.some(
      (resolved) => resolved.type === 'damage' && resolved.skillName === 'Head Butt' && resolved.damage > 0
    )
  );
});

test('reconstructs Spellbreaker core and specialization precasts', () => {
  const skills = [
    [14_389, 'Healing Signet'],
    [14_404, 'Signet of Might'],
    [14_502, 'Kick'],
    [14_410, 'Signet of Fury'],
    [45_333, 'Winds of Disenchantment'],
    [69_297, 'Breaching Strike'],
    [14_518, 'Crushing Blow']
  ].map(([id, name]) => ({ id, name }));
  const initialBuff = (skillId) =>
    event({
      time: 2_000,
      target: PLAYER,
      skillId,
      value: 10_000,
      buffDamage: 10_000,
      buff: 18,
      stateChange: 18
    });
  const fixture = warriorLog(61, skills, [
    initialBuff(26_980),
    initialBuff(36_781),
    initialBuff(46_853),
    initialBuff(51_664),
    event({ time: 3_000, stateChange: 1 }),
    event({ time: 3_100, skillId: 45_333, value: 1 }),
    event({
      time: 3_300,
      skillId: 69_297,
      value: 800,
      buffDamage: 800,
      activation: 3,
      stateChange: 68
    }),
    ...animation(14_518, 3_400, 3_800, { modern: true })
  ]);
  const catalog = {
    skills: [
      skill(14_389, 'Healing Signet', 'Heal', 'Heal', 833),
      skill(14_404, 'Signet of Might', 'Utility', 'Utility', 333),
      skill(14_502, 'Kick', 'Utility', 'Utility', 500),
      skill(14_410, 'Signet of Fury', 'Utility', 'Utility', 333),
      skill(45_333, 'Winds of Disenchantment', 'Elite', 'Elite', 500, {
        specialization: 'Spellbreaker'
      }),
      skill(69_297, 'Breaching Strike', 'Profession', 'Profession_1', 842, {
        specialization: 'Spellbreaker'
      }),
      skill(14_518, 'Crushing Blow', 'Weapon', 'Weapon_4', 400)
    ]
  };

  const result = reconstructEvtcRotation(fixture, catalog, {
    inferInstantCasts: false
  });

  assert.deepEqual(
    result.actions.slice(0, 7).map((action) => action.name),
    [
      'Healing Signet',
      'Signet of Might',
      'Kick',
      'Signet of Fury',
      'Winds of Disenchantment',
      'Breaching Strike',
      'Crushing Blow'
    ]
  );
  assert.deepEqual(
    result.actions.slice(0, 6).map((action) => action.evidence),
    ['initial-state', 'initial-state', 'initial-state', 'initial-state', 'initial-state', 'animation']
  );
});

test('reconstructs Bladesworn precasts, mechanics, and bundle weapon casts', () => {
  const skills = [
    [62_745, 'Unsheathe Gunsaber'],
    [62_769, 'Gunsaber Mode'],
    [62_797, 'Dragon Slash—Force'],
    [62_803, 'Dragon Trigger'],
    [62_836, 'Positive Flow'],
    [62_861, 'Sheathe Gunsaber'],
    [62_885, 'Break Step'],
    [62_930, 'Blooming Fire'],
    [62_901, 'Tactical Reload'],
    [68_085, 'Overcharged Cartridges'],
    [68_126, 'Tactical Reload'],
    [70_196, 'Relic of Peitha'],
    [76_513, 'Supercharged Cartridges'],
    [14_401, 'Mending'],
    [62_800, "Dragon's Roar"],
    [743, 'Aegis']
  ].map(([id, name]) => ({ id, name }));
  const initialBuff = (skillId) =>
    event({
      time: 1_000,
      target: PLAYER,
      skillId,
      value: 8_000,
      buffDamage: 8_000,
      buff: 18,
      stateChange: 18
    });
  const fixture = warriorLog(68, skills, [
    initialBuff(62_836),
    initialBuff(62_836),
    initialBuff(62_836),
    initialBuff(62_836),
    initialBuff(68_126),
    initialBuff(76_513),
    initialBuff(46_853),
    ...animation(62_800, 523, 1_084, { modern: true }),
    event({ time: 1_000, stateChange: 1 }),
    ...animation(62_803, 1_084, 2_084, { modern: true }),
    event({
      time: 1_085,
      target: PLAYER,
      skillId: 62_769,
      value: 2_147_483_647,
      buff: 1,
      stateChange: 69
    }),
    event({
      time: 1_200,
      target: PLAYER,
      skillId: 62_836,
      value: 8_000,
      buff: 1,
      stateChange: 69
    }),
    event({
      time: 1_201,
      target: PLAYER,
      skillId: 62_836,
      value: 8_000,
      buff: 1,
      stateChange: 69
    }),
    event({
      time: 1_300,
      target: PLAYER,
      skillId: 743,
      value: 2_000,
      buff: 1,
      stateChange: 69
    }),
    event({ time: 1_500, skillId: 70_196, stateChange: 57 }),
    ...animation(62_797, 2_084, 3_084, { modern: true }),
    ...animation(62_930, 3_084, 3_384, {
      modern: true,
      interrupted: true
    }),
    event({
      time: 3_384,
      target: PLAYER,
      skillId: 62_769,
      buff: 1,
      buffRemove: 1,
      stateChange: 72
    })
  ]);
  const bladesworn = { specialization: 'Bladesworn' };
  const catalog = {
    skills: [
      skill(62_745, 'Unsheathe Gunsaber', 'Profession', 'Profession_1', 0, bladesworn),
      skill(62_861, 'Sheathe Gunsaber', 'Profession', 'Profession_1', 0, bladesworn),
      skill(62_885, 'Break Step', 'Bundle', 'Weapon_1', 333, bladesworn),
      skill(68_085, 'Overcharged Cartridges', 'Utility', 'Utility', 600, bladesworn),
      skill(62_967, 'Flow Stabilizer', 'Utility', 'Utility', 0, bladesworn),
      skill(62_901, 'Tactical Reload', 'Elite', 'Elite', 552, bladesworn),
      skill(14_401, 'Mending', 'Heal', 'Heal', 920),
      skill(62_800, "Dragon's Roar", 'Weapon', 'Weapon_5', 560),
      skill(62_803, 'Dragon Trigger', 'Profession', 'Profession_2', 0, bladesworn),
      skill(62_893, 'Triggerguard', 'Bundle', 'Weapon_1', 0, bladesworn),
      skill(62_926, 'Flicker Step', 'Bundle', 'Weapon_1', 0, bladesworn),
      skill(62_797, 'Dragon Slash—Force', 'Bundle', 'Weapon_1', 1_000, bladesworn),
      skill(62_930, 'Blooming Fire', 'Bundle', 'Weapon_1', 600, {
        ...bladesworn,
        effects: [{ type: 'strike', atMs: 600 }]
      })
    ]
  };

  const result = reconstructEvtcRotation(fixture, catalog, {
    inferInstantCasts: false
  });
  const names = result.actions.map((action) => action.name);

  assert.deepEqual(names.slice(0, 10), [
    'Unsheathe Gunsaber',
    'Break Step',
    'Sheathe Gunsaber',
    'Overcharged Cartridges',
    'Flow Stabilizer',
    'Tactical Reload',
    'Mending',
    'Flow Stabilizer',
    'Overcharged Cartridges',
    "Dragon's Roar"
  ]);
  assert.equal(names.filter((name) => name === 'Unsheathe Gunsaber').length, 1);
  assert.equal(names.filter((name) => name === "Dragon's Roar").length, 1);
  assert.equal(result.actions.find((action) => action.name === "Dragon's Roar").evidence, 'animation');
  for (const name of ['Dragon Trigger', 'Triggerguard', 'Flicker Step', 'Dragon Slash—Force', 'Blooming Fire']) {
    assert.equal(names.includes(name), true, name);
  }

  const triggerIndex = result.rotation.findIndex((command) => command.name === 'Dragon Trigger');
  const slashIndex = result.rotation.findIndex((command) => command.name === 'Dragon Slash—Force');
  assert.equal(
    result.rotation.slice(triggerIndex + 1, slashIndex).some((command) => command.name === '__wait'),
    false,
    'Dragon Trigger charge time is handled by Dragon Slash availability'
  );

  assert.equal(result.actions.find((action) => action.name === 'Blooming Fire').status, 'interrupted');
});

test('reconstructs Berserker mode, Outrage, composite Rush, and committed autos', () => {
  const skills = [
    [29_502, 'Berserk'],
    [30_343, 'Head Butt'],
    [72_992, "Spearmarshal's Support"],
    [14_356, 'Greatsword Swing'],
    [14_510, 'Bladetrail'],
    [29_852, 'Arc Divider'],
    [14_446, 'Rush'],
    [14_493, 'Rush']
  ].map(([id, name]) => ({ id, name }));
  const fixture = warriorLog(18, skills, [
    event({ time: 1_000, stateChange: 1 }),
    event({
      time: 1_116,
      target: PLAYER,
      skillId: 29_502,
      value: 20_000,
      buff: 1
    }),
    ...animation(72_992, 1_116, 1_600),
    event({ time: 1_916, target: 4n, stateChange: 11 }),
    event({
      time: 2_000,
      source: 0n,
      target: PLAYER,
      skillId: 29_502,
      value: 3_000,
      buff: 1
    }),
    ...animation(30_343, 3_000, 3_800),
    ...animation(14_356, 4_000, 4_399),
    event({ time: 4_399, target: 0x2000n, skillId: 14_356, value: 8_000 }),
    ...animation(14_446, 5_000, 5_200),
    ...animation(14_493, 5_200, 6_000),
    event({
      time: 6_200,
      skillId: 14_510,
      value: 600,
      buffDamage: 750,
      activation: 1
    }),
    event({ time: 6_200, skillId: 14_510, activation: 4 }),
    event({ time: 6_717, target: 0x2000n, skillId: 14_510, value: 20_000 }),
    ...animation(14_356, 6_800, 7_200),
    event({
      time: 8_000,
      skillId: 29_852,
      value: 900,
      buffDamage: 900,
      activation: 1
    }),
    event({ time: 8_000, skillId: 29_852, activation: 4 }),
    event({ time: 8_600, target: 0x2000n, skillId: 29_852, value: 50_000 }),
    ...animation(72_992, 8_700, 9_184)
  ]);
  const berserker = { specialization: 'Berserker' };
  const catalog = {
    skills: [
      skill(30_185, 'Berserk', 'Profession', 'Profession_1', 0, berserker),
      skill(30_258, 'Outrage', 'Utility', 'Utility', 0, berserker),
      skill(30_343, 'Head Butt', 'Elite', 'Elite', 800, berserker),
      skill(72_992, "Spearmarshal's Support", 'Weapon', 'Weapon_5', 484),
      skill(14_356, 'Greatsword Swing', 'Weapon', 'Weapon_1', 400, {
        effects: [{ type: 'strike', atMs: 400 }]
      }),
      skill(14_510, 'Bladetrail', 'Weapon', 'Weapon_4', 560, {
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 517, coefficient: 1.5 },
              { atMs: 1_517, coefficient: 1.5 }
            ]
          }
        ]
      }),
      skill(29_852, 'Arc Divider', 'Profession', 'Profession_1', 680, {
        specialization: 'Berserker',
        effects: [{ type: 'strike', atMs: 600 }]
      }),
      skill(14_446, 'Rush', 'Weapon', 'Weapon_5', 1_000),
      skill(-3, 'Swap Weapons', 'Action', 'Action', 0)
    ]
  };

  const result = reconstructEvtcRotation(fixture, catalog, {
    inferInstantCasts: false
  });
  const names = result.actions.map((action) => action.name);

  assert.deepEqual(names.slice(0, 4), ['Head Butt', 'Outrage', 'Berserk', "Spearmarshal's Support"]);
  assert.equal(names.filter((name) => name === 'Head Butt').length, 2);
  assert.equal(names.filter((name) => name === 'Outrage').length, 2);
  assert.ok(names.indexOf('Outrage', 2) < names.indexOf('Swap Weapons'));
  assert.equal(names.filter((name) => name === 'Rush').length, 1);
  assert.equal(result.actions.find((action) => action.name === 'Rush').durationMs, 1_000);
  assert.equal(result.actions.find((action) => action.name === 'Greatsword Swing').status, 'completed');
  for (const [name, durationMs] of [
    ['Bladetrail', 560],
    ['Arc Divider', 680]
  ]) {
    const action = result.actions.find((candidate) => candidate.name === name);

    assert.equal(action.status, 'completed', name);
    assert.equal(action.durationMs, durationMs, name);
    const commandIndex = result.rotation.findIndex((command) => command.name === name);

    assert.equal(result.rotation[commandIndex]?.name, name);
  }
});

test('reconstructs condition Berserker opening state and BUFF_CHANGE Outrage casts', () => {
  const skills = [
    [29_502, 'Berserk'],
    [30_189, 'Blood Reckoning'],
    [30_343, 'Head Butt'],
    [31_708, 'Flames of War']
  ].map(([id, name]) => ({ id, name }));
  const fixture = warriorLog(18, skills, [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 31_708,
      value: 4_000,
      buffDamage: 5_000,
      buff: 18,
      stateChange: 18
    }),
    event({ time: 2_000, stateChange: 1 }),
    event({
      time: 2_500,
      target: PLAYER,
      skillId: 29_502,
      value: 20_000,
      buff: 1,
      stateChange: 69
    }),
    ...animation(30_189, 3_000, 3_280, { modern: true }),
    event({
      time: 3_240,
      source: 0n,
      target: PLAYER,
      skillId: 29_502,
      value: 3_000,
      buff: 1,
      stateChange: 70
    }),
    ...animation(23_285, 3_300, 3_380, { modern: true }),
    event({
      time: 4_000,
      source: 0n,
      target: PLAYER,
      skillId: 29_502,
      value: 3_000,
      buff: 1,
      stateChange: 70
    }),
    ...animation(30_343, 5_000, 5_800, { modern: true }),
    event({
      time: 5_800,
      source: 0n,
      target: PLAYER,
      skillId: 29_502,
      value: 3_000,
      buff: 1,
      stateChange: 70
    }),
    event({
      time: 5_876,
      source: 0n,
      target: PLAYER,
      skillId: 29_502,
      value: 3_000,
      buff: 1,
      stateChange: 70
    })
  ]);
  const berserker = { specialization: 'Berserker' };
  const rage = { ...berserker, categories: ['Rage'] };
  const catalog = {
    skills: [
      skill(30_185, 'Berserk', 'Profession', 'Profession_1', 0, berserker),
      skill(30_258, 'Outrage', 'Utility', 'Utility', 0, rage),
      skill(30_189, 'Blood Reckoning', 'Heal', 'Heal', 280, rage),
      skill(30_343, 'Head Butt', 'Elite', 'Elite', 800, rage),
      skill(29_940, 'Flames of War', 'Weapon', 'Weapon_5', 520),
      skill(-3, 'Swap Weapons', 'Action', 'Action', 0)
    ]
  };

  const result = reconstructEvtcRotation(fixture, catalog, {
    inferInstantCasts: false,
    selectedSkillNames: ['Blood Reckoning', 'Outrage', 'Head Butt']
  });

  assert.deepEqual(
    result.actions.map((action) => action.name),
    [
      'Flames of War',
      'Swap Weapons',
      'Head Butt',
      'Outrage',
      'Berserk',
      'Blood Reckoning',
      'Outrage',
      'Head Butt',
      'Outrage'
    ]
  );
  assert.deepEqual(
    result.actions.slice(0, 4).map((action) => action.evidence),
    ['initial-state', 'initial-state', 'initial-state', 'initial-state']
  );
  assert.equal(
    result.actions.some((action) => action.rawSkillId === 23_285),
    false
  );
  assert.deepEqual(result.warnings, []);
});

test('imports committed Fan of Fire EVTC durations on the nearest 40 ms action tick', () => {
  const fanOfFire = skill(14_519, 'Fan of Fire', 'Weapon', 'Weapon_2', 560, {
    specialization: 'Berserker',
    interruptCommitMs: 240,
    retainsCastLockoutAfterInterrupt: true
  });
  const fixture = warriorLog(
    18,
    [{ id: 14_519, name: 'Fan of Fire' }],
    [
      event({ time: 1_000, stateChange: 1 }),
      ...animation(14_519, 2_000, 2_240, { modern: true }),
      ...animation(14_519, 3_000, 3_246, { modern: true }),
      ...animation(14_519, 4_000, 4_238, { modern: true })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [fanOfFire] }, { inferInstantCasts: false });

  assert.deepEqual(
    result.actions.map((action) => action.durationMs),
    [240, 246, 238]
  );
  assert.deepEqual(
    result.rotation.filter((command) => command.name === 'Fan of Fire'),
    [
      { name: 'Fan of Fire', skillId: 14_519, interruptMs: 240 },
      { name: 'Fan of Fire', skillId: 14_519, interruptMs: 240 },
      { name: 'Fan of Fire', skillId: 14_519, interruptMs: 240 }
    ]
  );
});

test('replays Rend as one full cast without waiting after its second hit animation', () => {
  const rend = skill(80_247, 'Rend', 'Weapon', 'Weapon_3', 960, {
    interruptCommitMs: 0,
    effects: [
      {
        type: 'strike',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  });
  const gash = skill(14_365, 'Gash', 'Weapon', 'Weapon_1', 520);
  const fixture = warriorLog(
    18,
    [
      { id: 80_247, name: 'Rend' },
      { id: 80_224, name: 'Rend' },
      { id: 14_365, name: 'Gash' }
    ],
    [
      event({ time: 1_000, stateChange: 1 }),
      ...animation(80_247, 2_000, 2_440, { modern: true }),
      ...animation(80_224, 2_440, 2_880, { modern: true }),
      ...animation(14_365, 2_960, 3_480, { modern: true })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [rend, gash] }, { inferInstantCasts: false });
  const rendIndex = result.rotation.findIndex((command) => command.name === 'Rend');

  assert.deepEqual(result.rotation[rendIndex], { name: 'Rend', skillId: 80_247 });
  assert.equal(result.rotation[rendIndex + 1]?.name, 'Gash');
});

test('preserves Warrior weapon stows and cancelled autoattack inputs', () => {
  const severArtery = skill(14_364, 'Sever Artery', 'Weapon', 'Weapon_1', 480, {
    effects: [{ type: 'strike', atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }]
  });
  const weaponStow = {
    id: -6,
    name: 'Weapon Stow',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 80,
    unaffectedByQuickness: true,
    interruptCommitMs: 0,
    effects: []
  };
  const fixture = warriorLog(
    18,
    [
      { id: 14_364, name: 'Sever Artery' },
      { id: 23_285, name: 'Weapon Stow' }
    ],
    [
      event({ time: 1_000, stateChange: 1 }),
      ...animation(14_364, 2_000, 2_040, { modern: true, interrupted: true }),
      event({ time: 2_040, skillId: 23_285, value: 80, stateChange: 67 }),
      event({ time: 2_120, skillId: 23_285, value: 80, activation: 6, stateChange: 68 }),
      ...animation(14_364, 2_120, 2_600, { modern: true })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [severArtery, weaponStow] }, { inferInstantCasts: false });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.rotation.filter((command) => command.name !== '__combat_start'),
    [
      { name: '__wait', waitMs: 1000 },
      { name: 'Sever Artery', skillId: 14_364, interruptMs: 40 },
      { name: 'Weapon Stow', skillId: -6 },
      { name: 'Sever Artery', skillId: 14_364 }
    ]
  );
  assert.deepEqual(
    result.rotation.filter((command) => command.name === '__wait').map((command) => command.waitMs),
    [1000]
  );
});
