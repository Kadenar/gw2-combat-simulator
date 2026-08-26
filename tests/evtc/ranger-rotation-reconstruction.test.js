import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '../../js/log-analyzer/evtc/rotation/index.js';

const PLAYER = 0x1000n;
const PET = 0x2000n;
const TARGET = 0x3000n;

function event(overrides = {}) {
  return {
    time: 1000,
    source: PLAYER,
    target: 0n,
    value: 0,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 0,
    sourceInstance: 23,
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

function agent(overrides = {}) {
  return {
    address: PLAYER,
    profession: 4,
    elite: 5,
    toughness: 0,
    concentration: 0,
    healing: 0,
    condition: 0,
    character: 'Fixture Ranger',
    account: ':Fixture.1234',
    subgroup: '1',
    ...overrides
  };
}

function log(elite, skills, events, extraAgents = []) {
  return {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260815',
      revision: 1,
      encounterId: 16199,
      agentCount: 2 + extraAgents.length,
      skillCount: skills.length,
      eventCount: events.length
    },
    agents: [
      agent({ elite }),
      agent({
        address: TARGET,
        profession: 16199,
        elite: 0xffffffff,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      }),
      ...extraAgents
    ],
    skills,
    events
  };
}

function skill(id, name, extras = {}) {
  return {
    id,
    name,
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    effects: [],
    implemented: true,
    ...extras
  };
}

test('reconstructs core Ranger Sharpening Stone applications', () => {
  const skills = [skill(12536, 'Sharpening Stone', { type: 'Utility', slot: 'Utility' })];
  const fixture = log(
    0,
    [{ id: 12536, name: 'Sharpening Stone' }],
    [
      event({
        time: 1000,
        target: PLAYER,
        skillId: 12536,
        value: 28000,
        buffDamage: 30000,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1000, target: 1n, stateChange: 1 }),
      event({
        time: 4000,
        target: PLAYER,
        skillId: 12536,
        value: 30000,
        buff: 1
      }),
      event({
        time: 7000,
        target: PLAYER,
        skillId: 12536,
        value: 30000,
        buff: 1
      }),
      event({ time: 8000, source: TARGET, stateChange: 4 })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, 'ranger:core');
  assert.equal(result.actions.filter((action) => action.name === 'Sharpening Stone').length, 2);
});

test('reconstructs core Ranger Sic Em and composite Overbearing Smash', () => {
  const skills = [
    skill(12633, '"Sic \'Em!"', { type: 'Utility', slot: 'Utility' }),
    skill(69262, 'Overbearing Smash', {
      type: 'Weapon',
      slot: 'Weapon_4',
      castTimeMs: 960
    }),
    skill(9001, 'Pet Pulse', {
      petSkill: true,
      petAutonomousSkill: true
    })
  ];
  const fixture = log(
    0,
    [
      { id: 33902, name: '"Sic \'Em!"' },
      { id: 69262, name: 'Overbearing Smash' },
      { id: 63201, name: 'Overbearing Smash' },
      { id: 9001, name: 'Pet Pulse' }
    ],
    [
      event({ time: 1000, target: 1n, stateChange: 1 }),
      event({
        time: 1100,
        source: PET,
        target: TARGET,
        skillId: 9001,
        value: 100,
        sourceInstance: 24,
        sourceMasterInstance: 23
      }),
      event({
        time: 2000,
        target: TARGET,
        skillId: 69262,
        value: 400,
        buffDamage: 440,
        stateChange: 67
      }),
      event({
        time: 2240,
        skillId: 69262,
        value: 240,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 2240,
        target: TARGET,
        skillId: 63201,
        value: 780,
        buffDamage: 940,
        stateChange: 67
      }),
      event({
        time: 2960,
        skillId: 63201,
        value: 720,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 3500,
        source: TARGET,
        target: PET,
        skillId: 33902,
        value: 10000,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 4000, source: TARGET, stateChange: 4 })
    ],
    [
      agent({
        address: PET,
        profession: 12345,
        elite: 0xffffffff,
        character: 'Juvenile Tiger',
        account: '',
        subgroup: ''
      })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills }, { selectedSkillNames: ['Sic Em!'] });

  assert.equal(result.parserId, 'ranger:core');
  assert.equal(result.actions.filter((action) => action.name === '"Sic \'Em!"').length, 1);
  const smash = result.actions.filter((action) => action.name === 'Overbearing Smash');

  assert.equal(smash.length, 1);
  assert.equal(smash[0].durationMs, 960);
});

test('reconstructs Druid Avatar cycles, hidden Seeds, and Avatar weapon transitions', () => {
  const skills = [
    skill(31869, 'Celestial Avatar'),
    skill(31411, 'Release Celestial Avatar'),
    skill(31503, 'Natural Convergence', {
      type: 'Bundle',
      slot: 'Weapon_5',
      castTimeMs: 900
    }),
    skill(31406, 'Seed of Life', {
      type: 'Bundle',
      slot: 'Weapon_2'
    }),
    skill(12496, "Viper's Nest", { type: 'Utility', slot: 'Utility' }),
    skill(-3, 'Swap Weapons', { type: 'Action', slot: 'Action' }),
    skill(-5, 'Dodge', { type: 'Action', slot: 'Action' })
  ];
  const fixture = log(
    5,
    [
      { id: 31508, name: 'Celestial Avatar' },
      { id: 31503, name: 'Natural Convergence' },
      { id: 12496, name: "Viper's Nest" },
      { id: 30673, name: 'Light on Your Feet' }
    ],
    [
      event({
        time: 1000,
        source: 0n,
        target: PLAYER,
        skillId: 31508,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1000, target: 1n, stateChange: 1 }),
      event({ time: 1000, target: 2n, stateChange: 11 }),
      event({
        time: 1100,
        target: TARGET,
        skillId: 12496,
        value: 100
      }),
      event({
        time: 1500,
        skillId: 31503,
        value: 600,
        buffDamage: 900,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 2000,
        skillId: 31508,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({ time: 2000, target: 3n, stateChange: 11 }),
      event({
        time: 2300,
        target: PLAYER,
        skillId: 30673,
        value: 6000,
        buff: 1
      }),
      event({ time: 2500, target: 4n, stateChange: 11 }),
      event({ time: 3000, source: TARGET, stateChange: 4 })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const names = result.actions.map((action) => action.name);

  assert.equal(names.filter((name) => name === 'Celestial Avatar').length, 1);
  assert.equal(names.filter((name) => name === 'Release Celestial Avatar').length, 1);
  assert.equal(names.filter((name) => name === 'Seed of Life').length, 2);
  assert.equal(names.filter((name) => name === "Viper's Nest").length, 1);
  assert.equal(names.filter((name) => name === 'Dodge').length, 1);
  assert.equal(names.filter((name) => name === 'Swap Weapons').length, 1);
});

test('reconstructs Untamed state changes, unleashed pet commands, and composite Smash', () => {
  const skills = [
    skill(63147, 'Unleash Ranger'),
    skill(63344, 'Unleash Pet'),
    skill(63094, 'Enveloping Haze', {
      unleashedPetSkill: true,
      independentCast: true
    }),
    skill(63209, 'Venomous Outburst', {
      unleashedPetSkill: true,
      independentCast: true
    }),
    skill(63258, 'Rending Vines', {
      unleashedPetSkill: true,
      independentCast: true
    }),
    skill(63157, 'Exploding Spores', { type: 'Utility', slot: 'Utility' }),
    skill(63197, 'Unleashed Overbearing Smash', {
      type: 'Weapon',
      slot: 'Weapon_4',
      castTimeMs: 900
    })
  ];
  const fixture = log(
    72,
    [
      { id: 63317, name: 'Unleash Ranger' },
      { id: 63136, name: 'Enveloping Haze' },
      { id: 63082, name: 'Venomous Outburst' },
      { id: 63296, name: 'Rending Vines' },
      { id: 63157, name: 'Exploding Spores' },
      { id: 63197, name: 'Unleashed Overbearing Smash' },
      { id: 63224, name: 'Unleashed Overbearing Smash' },
      { id: 719, name: 'Swiftness' },
      { id: 33902, name: '"Sic \'Em!"' }
    ],
    [
      event({
        time: 1000,
        target: PLAYER,
        skillId: 719,
        value: 5000,
        buff: 18,
        stateChange: 18
      }),
      event({
        time: 1000,
        source: TARGET,
        target: PET,
        skillId: 33902,
        value: 10000,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1000, target: 1n, stateChange: 1 }),
      event({
        time: 1100,
        target: PLAYER,
        skillId: 63317,
        value: 1000,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 1150, target: TARGET, skillId: 63157, value: 100 }),
      event({
        time: 1160,
        source: PET,
        target: TARGET,
        skillId: 63136,
        value: 100,
        sourceInstance: 24,
        sourceMasterInstance: 23
      }),
      event({
        time: 1170,
        source: PET,
        target: TARGET,
        skillId: 63082,
        value: 100,
        sourceInstance: 24,
        sourceMasterInstance: 23
      }),
      event({
        time: 1180,
        source: PET,
        target: TARGET,
        skillId: 63296,
        value: 100,
        sourceInstance: 24,
        sourceMasterInstance: 23
      }),
      event({
        time: 2000,
        target: TARGET,
        skillId: 63197,
        value: 400,
        buffDamage: 440,
        stateChange: 67
      }),
      event({
        time: 2250,
        skillId: 63197,
        value: 250,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 2250,
        target: TARGET,
        skillId: 63224,
        value: 780,
        buffDamage: 940,
        stateChange: 67
      }),
      event({
        time: 2280,
        skillId: 63224,
        value: 30,
        activation: 4,
        stateChange: 68
      }),
      event({
        time: 2500,
        target: PLAYER,
        skillId: 63317,
        buff: 1,
        buffRemove: 1,
        stateChange: 71
      }),
      event({
        time: 62000,
        source: TARGET,
        target: PET,
        skillId: 33902,
        value: 10000,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 65000, source: TARGET, stateChange: 4 })
    ],
    [
      agent({
        address: PET,
        profession: 12345,
        elite: 0xffffffff,
        character: 'Juvenile Tiger',
        account: '',
        subgroup: ''
      })
    ]
  );

  const result = reconstructEvtcRotation(
    fixture,
    { skills },
    {
      selectedSkillNames: ['Strength of the Pack!', 'We Heal As One!', 'Sic Em!']
    }
  );
  const names = result.actions.map((action) => action.name);

  assert.equal(names.filter((name) => name === 'Unleash Ranger').length, 1);
  assert.equal(names.filter((name) => name === 'Unleash Pet').length, 1);
  assert.deepEqual(
    names.filter((name) => ['Enveloping Haze', 'Venomous Outburst', 'Rending Vines'].includes(name)),
    ['Enveloping Haze', 'Venomous Outburst', 'Rending Vines']
  );
  assert.equal(names.filter((name) => name === 'Exploding Spores').length, 1);
  const smash = result.actions.filter((action) => action.name === 'Unleashed Overbearing Smash');

  assert.equal(smash.length, 1);
  assert.equal(smash[0].status, 'interrupted');
  assert.equal(smash[0].durationMs, 280);
  assert.equal(names.filter((name) => name === '"Strength of the Pack!"').length, 1);
  assert.equal(names.filter((name) => name === '"We Heal As One!"').length, 1);
  assert.equal(names.filter((name) => name === '"Sic \'Em!"').length, 2);
});

test('reconstructs Soulbeast precasts, commands, composite Smash, and shared Path ranges', () => {
  const skills = [
    skill(42944, 'Beastmode'),
    skill(43014, 'Leave Beastmode'),
    skill(45717, 'One Wolf Pack', {
      type: 'Elite',
      slot: 'Elite',
      castTimeMs: 360
    }),
    skill(12492, 'Frost Trap', {
      type: 'Utility',
      slot: 'Utility',
      castTimeMs: 480
    }),
    skill(12633, '"Sic \'Em!"', { type: 'Utility', slot: 'Utility' }),
    skill(69262, 'Overbearing Smash', {
      type: 'Weapon',
      slot: 'Weapon_4',
      castTimeMs: 960
    }),
    skill(40729, 'Worldly Impact', {
      type: 'Profession',
      slot: 'Profession_3',
      castTimeMs: 680
    }),
    skill(12638, 'Path of Scars', {
      type: 'Weapon',
      slot: 'Weapon_4',
      castTimeMs: 440
    }),
    skill(-1001, 'Path of Scars (Max Range)', {
      type: 'Weapon',
      slot: 'Weapon_4',
      castTimeMs: 440
    })
  ];
  const fixture = log(
    55,
    [
      { id: 42014, name: 'Beastmode Buff' },
      { id: 44139, name: 'One Wolf Pack' },
      { id: 45717, name: 'One Wolf Pack' },
      { id: 12492, name: 'Frost Trap' },
      { id: 33902, name: '"Sic \'Em!"' },
      { id: 69262, name: 'Overbearing Smash' },
      { id: 63201, name: 'Overbearing Smash' },
      { id: 40729, name: 'Worldly Impact' },
      { id: 12638, name: 'Path of Scars' }
    ],
    [
      event({
        time: 1000,
        target: PLAYER,
        skillId: 42014,
        buff: 18,
        stateChange: 18
      }),
      event({
        time: 1000,
        target: PLAYER,
        skillId: 44139,
        value: 5000,
        buff: 18,
        stateChange: 18
      }),
      event({ time: 1001, target: 1n, stateChange: 1 }),
      event({
        time: 1001,
        skillId: 69262,
        value: 240,
        buffDamage: 359,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 1001,
        target: TARGET,
        skillId: 63201,
        value: 780,
        buffDamage: 940,
        stateChange: 67
      }),
      event({ time: 1040, target: TARGET, skillId: 12492, value: 7000 }),
      event({
        time: 1079,
        skillId: 63201,
        value: 78,
        buffDamage: 120,
        activation: 4,
        stateChange: 68
      }),
      event({
        time: 1079,
        target: TARGET,
        skillId: 40729,
        value: 760,
        buffDamage: 960,
        stateChange: 67
      }),
      event({
        time: 1759,
        skillId: 40729,
        value: 680,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 1883,
        source: TARGET,
        target: PLAYER,
        skillId: 33902,
        value: 10000,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 2000,
        target: TARGET,
        skillId: 12638,
        value: 480,
        buffDamage: 600,
        stateChange: 67
      }),
      event({ time: 2400, target: TARGET, skillId: 12638, value: 1000 }),
      event({
        time: 2440,
        skillId: 12638,
        value: 440,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 3600, target: TARGET, skillId: 12638, value: 1000 }),
      event({
        time: 5000,
        target: TARGET,
        skillId: 12638,
        value: 480,
        buffDamage: 600,
        stateChange: 67
      }),
      event({ time: 5400, target: TARGET, skillId: 12638, value: 1000 }),
      event({
        time: 5440,
        skillId: 12638,
        value: 440,
        activation: 3,
        stateChange: 68
      }),
      event({ time: 5800, target: TARGET, skillId: 12638, value: 1000 }),
      event({
        time: 6500,
        target: TARGET,
        skillId: 69262,
        value: 400,
        buffDamage: 440,
        stateChange: 67
      }),
      event({
        time: 6740,
        skillId: 69262,
        value: 240,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 6740,
        target: TARGET,
        skillId: 63201,
        value: 780,
        buffDamage: 940,
        stateChange: 67
      }),
      event({
        time: 7460,
        skillId: 63201,
        value: 720,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 7600,
        skillId: 45717,
        value: 300,
        buffDamage: 520,
        stateChange: 67
      }),
      event({
        time: 7960,
        skillId: 45717,
        value: 360,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 8100,
        skillId: 12492,
        value: 500,
        buffDamage: 850,
        stateChange: 67
      }),
      event({
        time: 8580,
        skillId: 12492,
        value: 480,
        activation: 3,
        stateChange: 68
      }),
      event({
        time: 8600,
        source: TARGET,
        target: PLAYER,
        skillId: 33902,
        value: 10000,
        buff: 1,
        stateChange: 69
      }),
      event({
        time: 9000,
        target: PLAYER,
        skillId: 42014,
        value: 1000,
        buff: 1,
        buffRemove: 3,
        stateChange: 71
      }),
      event({
        time: 9500,
        target: PLAYER,
        skillId: 42014,
        value: 1000,
        buff: 1,
        stateChange: 69
      }),
      event({ time: 10000, source: TARGET, stateChange: 4 })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const names = result.actions.map((action) => action.name);

  assert.equal(result.parserId, 'ranger:soulbeast');
  assert.deepEqual(names.slice(0, 3), ['One Wolf Pack', 'Frost Trap', 'Overbearing Smash']);
  assert.equal(names.filter((name) => name === 'One Wolf Pack').length, 2);
  assert.equal(names.filter((name) => name === 'Frost Trap').length, 2);
  assert.equal(names.filter((name) => name === '"Sic \'Em!"').length, 2);
  assert.equal(names.filter((name) => name === 'Path of Scars (Max Range)').length, 1);
  assert.equal(names.filter((name) => name === 'Path of Scars').length, 1);
  const smash = result.actions.filter((action) => action.name === 'Overbearing Smash');

  assert.equal(smash.length, 2);
  assert.equal(smash[0].status, 'interrupted');
  assert.equal(smash[0].durationMs, 318);
  assert.equal(smash[1].durationMs, 960);
  assert.equal(names.filter((name) => name === 'Leave Beastmode').length, 1);
  assert.equal(names.filter((name) => name === 'Beastmode').length, 1);
});
