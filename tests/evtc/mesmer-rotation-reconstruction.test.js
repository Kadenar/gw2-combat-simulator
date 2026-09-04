import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { simulateMesmer } from '../helpers/mesmer-simulation.js';

const PLAYER = 0x1000n;
const TARGET = 0x2000n;

const GUIDS = Object.freeze({
  rewinder: 'DC1C8A043ADCD24B9458688A792B04BA',
  splitSecond: 'C035166E3E4C414ABE640F47797D9B4A',
  timeSink: 'AB2E22E7EE74DA4C87DA777C62E475EA',
  diversion: '916D8385083F144EBAA5BEEDE21FD47A',
  distortionOrMindWrack: '3D29ABD39CB5BD458C4D50A22FCC0E4B',
  mirageMirror: '1370CDF5F2061445A656A1D77C37A55C',
  mesmerTeleport: 'C34E250B01FF534292EE6AB36D768337',
  bladeturnRequiem: '87B761200637AC48B71469F553BA6F60',
  thousandCuts: 'E4002B7AD7DF024394D0184B47A316E7'
});

function event(overrides = {}) {
  return {
    time: 10_000,
    source: PLAYER,
    target: 0n,
    value: 0,
    buffDamage: 0,
    overstackValue: 0,
    skillId: 0,
    sourceInstance: 7,
    targetInstance: 0,
    sourceMasterInstance: 0,
    targetMasterInstance: 0,
    iff: 0,
    buff: 0,
    result: 0,
    activation: EVTC_ACTIVATION.NONE,
    buffRemove: 0,
    ninety: 0,
    fifty: 0,
    moving: 0,
    stateChange: EVTC_STATE_CHANGE.NONE,
    flanking: 0,
    shields: 0,
    offcycle: 0,
    pad: 0,
    ...overrides
  };
}

function skill(id, name, overrides = {}) {
  return {
    id,
    name,
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    quicknessCastTimeMs: 0,
    effects: [],
    ...overrides
  };
}

function agent(address, profession, character, overrides = {}) {
  return {
    address,
    profession,
    elite: 0,
    toughness: 0,
    concentration: 0,
    healing: 0,
    condition: 0,
    character,
    account: '',
    subgroup: '',
    ...overrides
  };
}

function mesmerLog(elite, skills, events, extraAgents = []) {
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
      agent(PLAYER, 7, 'Fixture Mesmer', {
        elite,
        account: ':Fixture.1234',
        subgroup: '1'
      }),
      agent(TARGET, 16199, 'Standard Kitty Golem'),
      ...extraAgents
    ],
    skills: skills.map(({ id, name }) => ({ id, name })),
    events
  };
}

function guidParts(guid) {
  const bytes = guid.match(/../g);
  const part = (offset) =>
    BigInt(
      `0x${bytes
        .slice(offset, offset + 8)
        .reverse()
        .join('')}`
    );

  return [part(0), part(8)];
}

function guidMapping(guid, contentId) {
  const [source, target] = guidParts(guid);

  return event({
    time: 0,
    source,
    target,
    skillId: contentId,
    sourceInstance: 0,
    stateChange: 46
  });
}

function effect(contentId, time) {
  return event({ time, skillId: contentId, stateChange: 60 });
}

function direct(skillId, time) {
  return event({ time, target: TARGET, value: 100, skillId });
}

function cloneDeath(source, time, sourceInstance = 20) {
  return event({
    time,
    source,
    sourceInstance,
    sourceMasterInstance: 7,
    stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD
  });
}

/** Creates the zero-damage clone self-kill record that identifies which shatter consumed the clone. */
function cloneShatterKill(source, time, skillId, sourceInstance = 20) {
  return event({
    time,
    source,
    target: source,
    skillId,
    sourceInstance,
    targetInstance: sourceInstance,
    sourceMasterInstance: 7,
    targetMasterInstance: 7,
    result: 8
  });
}

function names(result, name) {
  return result.actions.filter((action) => action.name === name);
}

test('reconstructs Chronomancer shatters and Continuum transitions', () => {
  const cloneAddresses = [0x3000n, 0x3001n];
  const skills = [
    skill(56930, 'Split Second'),
    skill(56928, 'Rewinder'),
    skill(56873, 'Time Sink'),
    skill(29830, 'Continuum Split'),
    skill(-4, 'Continuum Shift')
  ];
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      guidMapping(GUIDS.rewinder, 102),
      guidMapping(GUIDS.timeSink, 103),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      direct(56925, 11_000),
      direct(56925, 11_100),
      direct(56925, 12_000),
      effect(102, 13_000),
      effect(102, 13_250),
      cloneDeath(cloneAddresses[0], 13_250),
      effect(102, 14_100),
      effect(103, 15_000),
      effect(103, 15_500),
      cloneDeath(cloneAddresses[1], 15_500, 21),
      event({
        time: 16_000,
        target: PLAYER,
        value: 4_500,
        skillId: 30136,
        buff: 1
      }),
      event({
        time: 17_000,
        target: PLAYER,
        value: 500,
        buffDamage: 500,
        skillId: 30136,
        buff: 1,
        buffRemove: 3
      })
    ],
    cloneAddresses.map((address) => agent(address, 0, 'Clone'))
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, 'mesmer:chronomancer');
  assert.equal(names(result, 'Split Second').length, 2);
  assert.equal(names(result, 'Rewinder').length, 2);
  assert.equal(names(result, 'Time Sink').length, 1);
  assert.equal(names(result, 'Continuum Split').length, 1);
  assert.equal(names(result, 'Continuum Shift').length, 1);
});

test('anchors Continuum Split at the recorded cast boundary', () => {
  const skills = [
    skill(73093, 'Mind the Gap', {
      type: 'Weapon',
      slot: 'Weapon_2',
      castTimeMs: 900,
      quicknessCastTimeMs: 600
    }),
    skill(29830, 'Continuum Split')
  ];
  const fixture = mesmerLog(40, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({ skillId: 73093, value: 900, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
    event({
      time: 10_600,
      skillId: 73093,
      value: 600,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
      activation: EVTC_ACTIVATION.CANCEL_FIRE
    }),
    event({ time: 10_600, target: PLAYER, value: 3_000, skillId: 30136, buff: 1 })
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(result.rotation, [
    { name: '__combat_start' },
    { name: 'Mind the Gap', skillId: 73093 },
    { name: 'Continuum Split', skillId: 29830, offset: 600 }
  ]);
});

test('separates a second shatter after three clone detonations', () => {
  const cloneAddresses = [0x3000n, 0x3001n, 0x3002n];
  const skills = [skill(56930, 'Split Second')];
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      effect(101, 11_000),
      effect(101, 11_100),
      cloneDeath(cloneAddresses[0], 11_100),
      effect(101, 11_200),
      cloneDeath(cloneAddresses[1], 11_200, 21),
      effect(101, 11_300),
      cloneDeath(cloneAddresses[2], 11_300, 22),
      effect(101, 11_400)
    ],
    cloneAddresses.map((address) => agent(address, 0, 'Clone'))
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(names(result, 'Split Second').length, 2);
});

test('prefers skill-specific clone killing blows over unrelated lifecycle ends', () => {
  const cloneAddresses = [0x3000n, 0x3001n];
  const skills = [skill(56930, 'Split Second')];
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      effect(101, 11_000),
      effect(101, 11_300),
      cloneShatterKill(cloneAddresses[0], 11_300, 56925),
      cloneDeath(cloneAddresses[0], 11_300),
      effect(101, 11_600),
      cloneDeath(cloneAddresses[1], 11_600, 21)
    ],
    cloneAddresses.map((address) => agent(address, 0, 'Clone'))
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    names(result, 'Split Second').map((action) => action.timestampMs),
    [1_000, 1_600]
  );
});

test('recovers a shatter whose only effect signals coincide with clone lifecycle ends', () => {
  const cloneAddresses = [0x3000n, 0x3001n];
  const skills = [skill(56930, 'Split Second')];
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      effect(101, 11_000),
      cloneDeath(cloneAddresses[0], 11_000),
      effect(101, 11_080),
      cloneDeath(cloneAddresses[1], 11_080, 21),
      effect(101, 11_700)
    ],
    cloneAddresses.map((address) => agent(address, 0, 'Clone'))
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    names(result, 'Split Second').map((action) => action.timestampMs),
    [1_000, 1_700]
  );
});

test('does not collapse rapid Time Sink fallback packets into one shatter', () => {
  const skills = [skill(56873, 'Time Sink')];
  const fixture = mesmerLog(40, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    direct(56873, 11_000),
    direct(56873, 13_000)
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    names(result, 'Time Sink').map((action) => action.timestampMs),
    [1_000, 3_000]
  );
});

test('preserves an interrupted Mesmer autoattack so replay can apply its chain state', () => {
  const psystrike = skill(73066, 'Psystrike', {
    type: 'Weapon',
    slot: 'Weapon_1',
    castTimeMs: 900,
    quicknessCastTimeMs: 600,
    effects: [{ type: 'strike', coefficient: 1, hits: 1, name: 'Psystrike', actorType: 'player' }]
  });
  const powerSpike = skill(10212, 'Power Spike', { type: 'Utility', slot: 'Utility_1' });
  const fixture = mesmerLog(
    40,
    [psystrike, powerSpike],
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({ time: 11_000, value: 900, skillId: 73066, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
      event({
        time: 11_200,
        value: 200,
        skillId: 73066,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_CANCEL
      }),
      direct(10212, 12_000)
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [psystrike, powerSpike] });

  assert.equal(names(result, 'Psystrike').length, 1);
  assert.equal(names(result, 'Psystrike')[0].status, 'interrupted');
  assert.equal(result.rotation.find((command) => command.name === 'Psystrike')?.interruptMs, 200);
});

test('matches partial Mesmer handler packets while preserving an unrelated exact autoattack cancellation', () => {
  const spatialSurge = skill(10234, 'Spatial Surge', {
    type: 'Weapon',
    slot: 'Weapon_1',
    castTimeMs: 1020,
    quicknessCastTimeMs: 680,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.4 },
          { atMs: 520, coefficient: 0.4 },
          { atMs: 680, coefficient: 0.4 }
        ],
        name: 'Spatial Surge',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  });
  const fixture = mesmerLog(
    40,
    [spatialSurge],
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({ time: 11_000, value: 1020, skillId: 10234, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
      event({
        time: 11_201,
        value: 201,
        skillId: 10234,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_CANCEL
      }),
      event({ time: 12_000, value: 1020, skillId: 10234, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
      event({
        time: 12_000,
        skillId: 10234,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_CANCEL
      }),
      direct(10234, 12_360),
      direct(10234, 12_520)
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [spatialSurge] });
  const actions = names(result, 'Spatial Surge');
  const commands = result.rotation.filter((command) => command.name === 'Spatial Surge');

  assert.deepEqual(
    actions.map((action) => action.status),
    ['interrupted', 'reduced']
  );
  assert.equal(commands[0].interruptMs, 201);
  assert.equal(commands[1].interruptMs, 520);
});

test('does not commit a Mesmer autoattack from a clone packet with the same skill id', () => {
  const clone = 0x3000n;
  const mindPierce = skill(73095, 'Mind Pierce', {
    type: 'Weapon',
    slot: 'Weapon_1',
    castTimeMs: 840,
    quicknessCastTimeMs: 560,
    effects: [{ type: 'strike', coefficient: 1.5, hits: 1, name: 'Mind Pierce', actorType: 'player' }]
  });
  const powerSpike = skill(10212, 'Power Spike', { type: 'Utility', slot: 'Utility_1' });
  const fixture = mesmerLog(
    40,
    [mindPierce, powerSpike],
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({ time: 11_000, value: 840, skillId: 73095, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
      event({
        time: 11_560,
        value: 560,
        skillId: 73095,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_FIRE
      }),
      event({
        time: 11_560,
        source: clone,
        target: TARGET,
        value: 100,
        skillId: 73095,
        sourceInstance: 8,
        sourceMasterInstance: 7
      }),
      direct(10212, 12_000)
    ],
    [agent(clone, 0, 'Illusionary Spear')]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [mindPierce, powerSpike] });

  assert.equal(names(result, 'Mind Pierce').length, 0);
});

test('recovers a Winds of Chaos cast from an unmatched player bounce pair', () => {
  const winds = skill(10273, 'Winds of Chaos', {
    type: 'Weapon',
    slot: 'Weapon_1',
    quicknessCastTimeMs: 760,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 533, coefficient: 0.3 },
          { atMs: 623, coefficient: 0.3 }
        ],
        name: 'Winds of Chaos',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  });
  const powerSpike = skill(10212, 'Power Spike', { type: 'Utility', slot: 'Utility_1' });
  const fixture = mesmerLog(
    40,
    [winds, powerSpike],
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      direct(10273, 10_533),
      direct(10273, 10_623),
      direct(10212, 12_000)
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [winds, powerSpike] });

  assert.equal(names(result, 'Winds of Chaos').length, 1);
  assert.equal(names(result, 'Winds of Chaos')[0].timestampMs, 0);
});

test('recovers a Mesmer phantasm precast whose animation start predates combat', () => {
  const swordsman = skill(10174, 'Phantasmal Swordsman', {
    type: 'Weapon',
    slot: 'Weapon_5',
    castTimeMs: 1300,
    quicknessCastTimeMs: 867,
    phantasm: true,
    effects: [{ type: 'strike', coefficient: 1, hits: 1, actorType: 'player' }]
  });
  const powerSpike = skill(10212, 'Power Spike', { type: 'Utility', slot: 'Utility_1' });
  const fixture = mesmerLog(
    40,
    [swordsman, powerSpike],
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      direct(10174, 10_634),
      event({
        time: 10_750,
        value: 867,
        skillId: 10174,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_FIRE
      }),
      event({ time: 12_000, value: 800, skillId: 10212, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
      event({
        time: 12_800,
        value: 800,
        skillId: 10212,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_FIRE
      })
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [swordsman, powerSpike] });

  assert.equal(names(result, 'Phantasmal Swordsman').length, 1);
  assert.equal(names(result, 'Phantasmal Swordsman')[0].timestampMs, 0);
});

test('prefers clipped phantasm timing over duplicate initial summon state', () => {
  const swordsmanPhantasm = 0x3000n;
  const disenchanterPhantasm = 0x3001n;
  const disenchanter = skill(10267, 'Phantasmal Disenchanter', {
    type: 'Utility',
    slot: 'Utility_1',
    castTimeMs: 1140,
    quicknessCastTimeMs: 760,
    phantasm: true
  });
  const swordsman = skill(10174, 'Phantasmal Swordsman', {
    type: 'Weapon',
    slot: 'Weapon_5',
    castTimeMs: 1300,
    quicknessCastTimeMs: 867,
    phantasm: true,
    effects: [{ type: 'strike', coefficient: 1, hits: 1, actorType: 'player' }]
  });
  const powerSpike = skill(10212, 'Power Spike', { type: 'Utility', slot: 'Utility_1' });
  const fixture = mesmerLog(
    40,
    [swordsman, powerSpike],
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        source: swordsmanPhantasm,
        target: swordsmanPhantasm,
        sourceInstance: 8,
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
      }),
      event({
        source: disenchanterPhantasm,
        target: disenchanterPhantasm,
        sourceInstance: 9,
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
      }),
      direct(10174, 10_634),
      event({
        time: 10_750,
        value: 867,
        skillId: 10174,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_FIRE
      }),
      event({ time: 12_000, value: 800, skillId: 10212, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
      event({
        time: 12_800,
        value: 800,
        skillId: 10212,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_FIRE
      })
    ],
    [
      agent(swordsmanPhantasm, 6487, 'Illusionary Swordsman'),
      agent(disenchanterPhantasm, 6621, 'Illusionary Disenchanter')
    ]
  );

  const result = reconstructEvtcRotation(fixture, { skills: [disenchanter, swordsman, powerSpike] });
  const initialDisenchanter = names(result, 'Phantasmal Disenchanter')[0];
  const clippedSwordsman = names(result, 'Phantasmal Swordsman')[0];

  assert.equal(names(result, 'Phantasmal Swordsman').length, 1);
  assert.equal(clippedSwordsman.evidence, 'animation');
  assert.equal(initialDisenchanter.endTimestampMs, clippedSwordsman.timestampMs);
});

test('uses clone lifecycle ends to preserve rapid Chronomancer shatters across Continuum Split', () => {
  const cloneAddresses = Array.from({ length: 4 }, (_, index) => 0x3000n + BigInt(index));
  const skills = [
    skill(56930, 'Split Second'),
    skill(56928, 'Rewinder'),
    skill(56873, 'Time Sink'),
    skill(29830, 'Continuum Split'),
    skill(-4, 'Continuum Shift')
  ];
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      guidMapping(GUIDS.rewinder, 102),
      guidMapping(GUIDS.timeSink, 103),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({ time: 10_500, target: PLAYER, value: 3_000, skillId: 30136, buff: 1 }),
      effect(101, 11_000),
      effect(101, 11_080),
      cloneDeath(cloneAddresses[0], 11_080),
      effect(101, 11_200),
      cloneDeath(cloneAddresses[1], 11_200, 21),
      effect(101, 11_600),
      effect(102, 11_700),
      effect(103, 11_800),
      effect(102, 12_200),
      cloneDeath(cloneAddresses[2], 12_200, 22),
      effect(103, 12_800),
      cloneDeath(cloneAddresses[3], 12_800, 23),
      event({ time: 13_000, value: 1_000, skillId: 30136, buff: 1, buffRemove: 3 }),
      effect(101, 13_100),
      effect(102, 13_200),
      effect(103, 13_300)
    ],
    cloneAddresses.map((address) => agent(address, 0, 'Clone'))
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    names(result, 'Split Second').map((action) => action.timestampMs),
    [1_000, 1_600, 3_100]
  );
  assert.equal(names(result, 'Rewinder').length, 2);
  assert.deepEqual(
    names(result, 'Time Sink').map((action) => action.timestampMs),
    [1_800, 3_300]
  );
  assert.equal(names(result, 'Continuum Split').length, 1);
  assert.equal(names(result, 'Continuum Shift').length, 1);

  const replay = simulateMesmer(result.rotation, {
    specialization: 'Chronomancer',
    selectedTraitIds: [TRAIT.SHATTER_STORM],
    initialResource: 3
  });
  const replayedSplits = replay.steps.filter((step) => step.skill === 'Split Second');

  assert.deepEqual(
    replayedSplits.map((step) => step.start),
    [1_040, 1_640, 3_200]
  );
  assert.ok(replayedSplits.every((step) => !step.invalid));
});

test('preserves a shatter cast when a clone detonates at the same timestamp', () => {
  const cloneAddresses = [0x3100n, 0x3101n, 0x3102n];
  const skills = [skill(56930, 'Split Second')];
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      effect(101, 11_000),
      effect(101, 11_000),
      event({
        time: 11_000,
        source: cloneAddresses[0],
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.EXIT_COMBAT
      }),
      event({
        time: 11_000,
        source: cloneAddresses[0],
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD
      }),
      effect(101, 11_050),
      event({
        time: 11_050,
        source: cloneAddresses[1],
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD
      }),
      effect(101, 11_200),
      event({
        time: 11_200,
        source: cloneAddresses[2],
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD
      }),
      effect(101, 11_600)
    ],
    cloneAddresses.map((address) => agent(address, 0, 'Clone'))
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    names(result, 'Split Second').map((action) => action.timestampMs),
    [1_000, 1_600]
  );
});

test('recovers a Chronomancer Mirror Images use suppressed at clone cap', () => {
  const cloneAddresses = Array.from({ length: 6 }, (_, index) => 0x3000n + BigInt(index));
  const skills = [skill(10202, 'Mirror Images'), skill(10192, 'Distortion'), skill(56930, 'Split Second')];
  const clonePair = (time, offset) =>
    cloneAddresses.slice(offset, offset + 2).map((source, index) =>
      event({
        time,
        source,
        sourceInstance: offset + index + 10,
        sourceMasterInstance: 7
      })
    );
  const fixture = mesmerLog(
    40,
    skills,
    [
      guidMapping(GUIDS.splitSecond, 101),
      guidMapping(GUIDS.distortionOrMindWrack, 102),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      ...clonePair(11_000, 0),
      ...clonePair(31_000, 2),
      effect(102, 50_500),
      event({
        time: 50_500,
        target: PLAYER,
        value: 1_000,
        skillId: 10243,
        buff: 1
      }),
      effect(101, 51_000),
      ...clonePair(71_000, 4)
    ],
    cloneAddresses.map((address) => agent(address, 8111, 'Illusionary Warlock'))
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const mirrors = names(result, 'Mirror Images');

  assert.equal(mirrors.length, 4);
  assert.ok(
    mirrors.some(
      (action) => action.evidence === 'resource-inference' && action.timestampMs > 40_000 && action.timestampMs < 50_000
    )
  );
});

test('reconstructs Mirage cloak sources and shatters without packet spam', () => {
  const skills = [
    skill(-1, 'Dodge / Mirage Cloak', { type: 'Action', slot: 'Action' }),
    skill(-2, 'Pick Up Mirage Mirror', {
      type: 'Action',
      slot: 'Action'
    }),
    skill(10190, 'Cry of Frustration'),
    skill(10191, 'Mind Wrack'),
    skill(10192, 'Distortion'),
    skill(10287, 'Diversion')
  ];
  const fixture = mesmerLog(59, skills, [
    guidMapping(GUIDS.diversion, 201),
    guidMapping(GUIDS.mirageMirror, 202),
    guidMapping(GUIDS.distortionOrMindWrack, 203),
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      target: PLAYER,
      value: 800,
      skillId: 40408,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({
      time: 11_000,
      target: PLAYER,
      value: 800,
      skillId: 40408,
      buff: 1
    }),
    effect(202, 12_000),
    event({
      time: 12_000,
      target: PLAYER,
      value: 800,
      skillId: 40408,
      buff: 1
    }),
    direct(44677, 12_500),
    event({
      time: 12_500,
      target: PLAYER,
      value: 800,
      skillId: 40408,
      buff: 1
    }),
    event({
      time: 13_000,
      target: PLAYER,
      value: 1_000,
      skillId: 40408,
      buff: 1
    }),
    direct(10191, 14_000),
    direct(10191, 14_100),
    direct(10191, 16_000),
    direct(10190, 17_000),
    direct(10190, 17_200),
    effect(201, 17_500),
    effect(201, 19_000),
    effect(203, 20_000),
    event({
      time: 20_000,
      target: PLAYER,
      value: 1_000,
      skillId: 10243,
      buff: 1
    })
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, 'mesmer:mirage');
  assert.equal(names(result, 'Dodge / Mirage Cloak').length, 2);
  assert.equal(names(result, 'Pick Up Mirage Mirror').length, 2);
  assert.equal(names(result, 'Mind Wrack').length, 2);
  assert.equal(names(result, 'Cry of Frustration').length, 1);
  assert.equal(names(result, 'Diversion').length, 1);
  assert.equal(names(result, 'Distortion').length, 1);
});

test('ignores Blurred Inscriptions distortion buffs without a shatter effect', () => {
  const skills = [skill(10192, 'Distortion'), skill(10234, 'Signet of Midnight')];
  const fixture = mesmerLog(0, skills, [
    guidMapping(GUIDS.distortionOrMindWrack, 203),
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    // Signet use under Blurred Inscriptions grants the Distortion buff but emits no shatter effect.
    event({ time: 12_000, target: PLAYER, value: 1_000, skillId: 10243, buff: 1 }),
    // A real Distortion shatter pairs the buff gain with the shared shatter effect.
    effect(203, 20_000),
    event({ time: 20_000, target: PLAYER, value: 1_000, skillId: 10243, buff: 1 })
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const distortions = names(result, 'Distortion');

  assert.equal(distortions.length, 1);
  // Timestamps are relative to the 10_000 ms EnterCombat, so the surviving cast is the paired shatter at 20_000 ms,
  // not the signet-granted buff at 12_000 ms.
  assert.equal(distortions[0].timestampMs, 10_000);
});

test('does not mistake a Phase Retreat clone pair for Mirror Images', () => {
  const cloneOne = 0x3100n;
  const cloneTwo = 0x3101n;
  const skills = [skill(10310, 'Phase Retreat'), skill(10202, 'Mirror Images')];
  const fixture = mesmerLog(
    59,
    skills,
    [
      guidMapping(GUIDS.mesmerTeleport, 201),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        time: 12_000,
        source: cloneOne,
        sourceInstance: 8,
        sourceMasterInstance: 7
      }),
      event({
        time: 12_000,
        source: cloneTwo,
        sourceInstance: 9,
        sourceMasterInstance: 7
      }),
      effect(201, 12_000)
    ],
    [agent(cloneOne, 8111, 'Illusionary Warlock'), agent(cloneTwo, 8111, 'Illusionary Warlock')]
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(names(result, 'Phase Retreat').length, 1);
  assert.equal(names(result, 'Mirror Images').length, 0);
});

test('does not reconstruct Chaos Armor from a phantasm leap inside a Chronomancer well', () => {
  const skills = [
    skill(30525, 'Well of Calamity', {
      type: 'Utility',
      slot: 'Utility',
      quicknessCastTimeMs: 800
    }),
    skill(72946, 'Phantasmal Lancer', {
      type: 'Weapon',
      slot: 'Weapon_4',
      quicknessCastTimeMs: 500
    }),
    skill(10331, 'Chaos Armor', {
      type: 'Weapon',
      slot: 'Weapon_4'
    })
  ];
  const fixture = mesmerLog(40, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({ skillId: 30525, value: 800, activation: EVTC_ACTIVATION.START }),
    event({ time: 10_800, skillId: 30525, value: 800, activation: EVTC_ACTIVATION.CANCEL_FIRE }),
    event({ time: 13_500, skillId: 72946, value: 800, activation: EVTC_ACTIVATION.START }),
    event({ time: 14_300, skillId: 72946, value: 800, activation: EVTC_ACTIVATION.CANCEL_FIRE }),
    // The aura packet can land after the field expires when the leap began inside it.
    event({ time: 14_300, target: PLAYER, value: 5_000, skillId: 10332, buff: 1 })
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(names(result, 'Phantasmal Lancer').length, 1);
  assert.equal(names(result, 'Chaos Armor').length, 0);
});

test('places delayed Mirage Chaos Armor evidence before the weapon swap', () => {
  const skills = [
    skill(10169, 'Chaos Storm', {
      type: 'Weapon',
      slot: 'Weapon_5',
      castTimeMs: 720,
      quicknessCastTimeMs: 480
    }),
    skill(10331, 'Chaos Armor', {
      type: 'Weapon',
      slot: 'Weapon_4'
    })
  ];
  const fixture = mesmerLog(59, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      skillId: 10169,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({
      time: 10_480,
      value: 480,
      skillId: 10169,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    }),
    event({
      time: 10_560,
      target: 4n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP
    }),
    event({
      time: 11_300,
      target: PLAYER,
      value: 5_000,
      skillId: 10332,
      buff: 1
    })
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const chaosArmor = names(result, 'Chaos Armor')[0];
  const weaponSwap = names(result, 'Swap Weapons')[0];

  assert.ok(chaosArmor.timestampMs < weaponSwap.timestampMs);
});

test('keeps Mirage Chaos Armor initial state and later Staff-side casts distinct', () => {
  const skills = [
    skill(10169, 'Chaos Storm', {
      type: 'Weapon',
      slot: 'Weapon_5',
      castTimeMs: 720,
      quicknessCastTimeMs: 480
    }),
    skill(10331, 'Chaos Armor', {
      type: 'Weapon',
      slot: 'Weapon_4'
    })
  ];
  const fixture = mesmerLog(59, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      target: PLAYER,
      value: 5_000,
      buffDamage: 5_000,
      skillId: 10332,
      buff: 18,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({
      time: 10_100,
      skillId: 10169,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({
      time: 10_580,
      value: 480,
      skillId: 10169,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    }),
    event({
      time: 10_660,
      target: 4n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP
    }),
    event({
      time: 11_100,
      target: PLAYER,
      value: 5_000,
      skillId: 10332,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    }),
    event({
      time: 24_000,
      target: 5n,
      stateChange: EVTC_STATE_CHANGE.WEAPON_SWAP
    }),
    event({
      time: 24_320,
      target: PLAYER,
      value: 5_000,
      skillId: 10332,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    })
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const chaosArmors = names(result, 'Chaos Armor');

  assert.equal(chaosArmors.length, 2);
  assert.equal(chaosArmors[0].evidence, 'initial-state');
  assert.equal(chaosArmors[0].timestampMs, 0);
  assert.equal(chaosArmors[1].timestampMs, 14_320);
});

test('keeps a zero-duration phantasm cast when damage and a spawn commit it', () => {
  const phantasm = 0x3200n;
  const skills = [
    skill(10221, 'Phantasmal Berserker', {
      type: 'Weapon',
      slot: 'Weapon_4',
      castTimeMs: 840,
      quicknessCastTimeMs: 560,
      phantasm: true
    })
  ];
  const fixture = mesmerLog(
    40,
    skills,
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        time: 11_000,
        value: 840,
        skillId: 10221,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_START
      }),
      event({
        time: 11_000,
        skillId: 10221,
        activation: EVTC_ACTIVATION.CANCEL_CANCEL,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
      }),
      direct(10221, 11_560),
      event({
        time: 11_560,
        source: phantasm,
        stateChange: 6
      })
    ],
    [agent(phantasm, 6535, 'Illusionary Berserker')]
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const berserker = names(result, 'Phantasmal Berserker')[0];
  const command = result.rotation.find((entry) => entry.name === 'Phantasmal Berserker');

  assert.equal(berserker.status, 'completed');
  assert.equal(command.interruptMs, undefined);
});

test('reconstructs Virtuoso effects, opening ticks, and initial phantasms', () => {
  const phantasm = 0x3000n;
  const skills = [
    skill(62597, 'Bladeturn Requiem'),
    skill(24755, 'Thousand Cuts'),
    skill(68273, 'Bladesong Distortion'),
    skill(62607, 'Unstable Bladestorm', {
      type: 'Weapon',
      slot: 'Weapon_3',
      castTimeMs: 500,
      quicknessCastTimeMs: 500
    }),
    skill(10175, 'Phantasmal Duelist', {
      type: 'Weapon',
      slot: 'Weapon_4',
      castTimeMs: 750,
      quicknessCastTimeMs: 750
    })
  ];
  const fixture = mesmerLog(
    66,
    skills,
    [
      guidMapping(GUIDS.bladeturnRequiem, 301),
      guidMapping(GUIDS.thousandCuts, 302),
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({
        source: phantasm,
        target: phantasm,
        sourceInstance: 8,
        sourceMasterInstance: 7,
        stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
      }),
      event({ time: 10_100, skillId: 62607, stateChange: 57 }),
      event({ time: 10_200, skillId: 62607, stateChange: 57 }),
      direct(62597, 10_500),
      effect(301, 13_000),
      direct(62597, 13_100),
      direct(24755, 14_500),
      effect(302, 17_000),
      direct(24755, 17_100),
      event({
        time: 19_000,
        target: PLAYER,
        value: 1_000,
        skillId: 10243,
        buff: 1
      })
    ],
    [agent(phantasm, 5758, 'Illusionary Duelist')]
  );

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, 'mesmer:virtuoso');
  assert.equal(names(result, 'Bladeturn Requiem').length, 2);
  assert.equal(names(result, 'Thousand Cuts').length, 2);
  assert.equal(names(result, 'Bladesong Distortion').length, 1);
  assert.equal(names(result, 'Unstable Bladestorm').length, 1);
  assert.equal(names(result, 'Phantasmal Duelist').length, 1);
  assert.equal(names(result, 'Phantasmal Duelist')[0].evidence, 'initial-state');
});

test('resolves the historical Virtuoso Bladecall ID', () => {
  const skills = [
    skill(69311, 'Bladecall', {
      type: 'Weapon',
      slot: 'Weapon_2',
      castTimeMs: 500,
      quicknessCastTimeMs: 500
    })
  ];
  const fixture = mesmerLog(66, skills, [
    event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 11_000,
      skillId: 62560,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({
      time: 11_500,
      value: 500,
      skillId: 62560,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    })
  ]);

  const result = reconstructEvtcRotation(fixture, { skills });
  const bladecalls = names(result, 'Bladecall');

  assert.equal(bladecalls.length, 1);
  assert.equal(bladecalls[0].skillId, 69311);
  assert.equal(bladecalls[0].supportedByCatalog, true);
});

test('recovers the ordered Troubadour precast chain and committed short Harp cast', () => {
  const phantasm = 0x3000n;
  const skills = [
    skill(29578, 'Mimic', {
      type: 'Utility',
      slot: 'Utility_1',
      castTimeMs: 600,
      quicknessCastTimeMs: 600
    }),
    skill(62607, 'Unstable Bladestorm', {
      type: 'Weapon',
      slot: 'Weapon_3',
      castTimeMs: 660,
      quicknessCastTimeMs: 440,
      effects: [
        {
          type: 'strike',
          ticks: [{ atMs: 1160, coefficient: 0.25 }],
          actorType: 'player',
          timingAnchor: 'castStart',
          timingScale: 'fixed'
        }
      ]
    }),
    skill(10174, 'Phantasmal Swordsman', {
      type: 'Weapon',
      slot: 'Weapon_5',
      castTimeMs: 1300,
      quicknessCastTimeMs: 884,
      phantasm: true
    }),
    skill(76960, 'Harmonious Harp', {
      quicknessCastTimeMs: 2000,
      interruptCommitMs: 400
    }),
    skill(23285, 'Weapon Stow', { type: 'Action', slot: 'Action' })
  ];
  const animation = (skillId, start, duration) => [
    event({
      time: start,
      skillId,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({
      time: start + duration,
      value: duration,
      skillId,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    })
  ];
  const fixture = mesmerLog(
    73,
    skills,
    [
      event({ stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
      event({ source: phantasm, sourceMasterInstance: 7, stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL }),
      event({ skillId: 62607, stateChange: 57 }),
      direct(10174, 10_033),
      event({
        time: 10_150,
        value: 884,
        skillId: 10174,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_FIRE
      }),
      event({ time: 11_000, value: 3000, skillId: 76960, stateChange: EVTC_STATE_CHANGE.ANIMATION_START }),
      event({
        time: 11_434,
        value: 434,
        skillId: 76960,
        stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP,
        activation: EVTC_ACTIVATION.CANCEL_FIRE
      }),
      ...animation(29578, 30_000, 600),
      ...animation(23285, 40_000, 0),
      ...animation(29578, 65_000, 600)
    ],
    [agent(phantasm, 6487, 'Illusionary Swordsman')]
  );

  const result = reconstructEvtcRotation(fixture, { skills });
  const opening = result.actions.filter((action) =>
    ['Mimic', 'Unstable Bladestorm', 'Phantasmal Swordsman'].includes(action.name)
  );

  assert.equal(result.parserId, 'mesmer:troubadour');
  assert.deepEqual(
    opening.slice(0, 3).map((action) => action.name),
    ['Mimic', 'Unstable Bladestorm', 'Phantasmal Swordsman']
  );
  assert.equal(names(result, 'Mimic').length, 3);
  assert.equal(names(result, 'Mimic')[0].evidence, 'initial-state');
  assert.equal(names(result, 'Phantasmal Swordsman')[0].evidence, 'animation');
  assert.equal(result.rotation.find((command) => command.name === 'Harmonious Harp')?.interruptMs, 440);
  assert.equal(names(result, 'Weapon Stow').length, 0);
});
