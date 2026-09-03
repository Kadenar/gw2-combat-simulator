import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '#gw2/integrations/logs/evtc/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

const PLAYER = 0x1000n;
const TARGET = 0x2000n;
const EARTH_ELEMENTAL = 0x3000n;
const FIRE_ELEMENTAL = 0x4000n;
const TOAD_FAMILIAR = 0x5000n;
const AIR_FAMILIAR = 0x6000n;
const FIRE_FOX = 0x7000n;

function event(overrides = {}) {
  return {
    time: 1_000,
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

function animation(skillId, start, duration) {
  return [
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
}

function catalogSkill(id, name, type = 'Profession', extras = {}) {
  return {
    id,
    name,
    type,
    slot: type === 'Elite' ? 'Elite' : 'Profession_1',
    castTimeMs: 0,
    quicknessCastTimeMs: 0,
    effects: [],
    ...extras
  };
}

test('recovers the clipped power Tempest opener and legacy Flame Barrage commands', () => {
  const events = [
    event({
      time: 10_000,
      target: PLAYER,
      skillId: 5575,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({
      time: 10_000,
      source: FIRE_ELEMENTAL,
      target: TARGET,
      value: 100,
      skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
      sourceInstance: 8,
      sourceMasterInstance: 7
    }),
    event({
      time: 10_023,
      target: TARGET,
      value: 100,
      skillId: ID.OVERLOAD_AIR
    }),
    event({
      time: 10_100,
      value: 3_200,
      buffDamage: 4_800,
      skillId: ID.OVERLOAD_AIR,
      activation: EVTC_ACTIVATION.CANCEL_FIRE
    }),
    event({
      time: 12_200,
      source: FIRE_ELEMENTAL,
      value: 3_000,
      buffDamage: 3_040,
      skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
      sourceInstance: 8,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.RESET
    }),
    event({ time: 15_000, target: TARGET, value: 100, skillId: ID.HURL }),
    event({ time: 15_200, target: TARGET, value: 100, skillId: ID.HURL }),
    event({ time: 15_400, target: TARGET, value: 100, skillId: ID.HURL }),
    event({
      time: 20_000,
      source: FIRE_ELEMENTAL,
      value: 2_000,
      skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
      sourceInstance: 8,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.START
    }),
    event({
      time: 23_040,
      source: FIRE_ELEMENTAL,
      value: 3_040,
      buffDamage: 3_040,
      skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
      sourceInstance: 8,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.RESET
    }),
    event({
      time: 30_000,
      value: 940,
      buffDamage: 1_033,
      skillId: ID.OVERLOAD_AIR,
      activation: EVTC_ACTIVATION.START
    }),
    event({
      time: 33_200,
      value: 3_200,
      buffDamage: 4_800,
      skillId: ID.OVERLOAD_AIR,
      activation: EVTC_ACTIVATION.CANCEL_FIRE
    })
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260317',
      revision: 1,
      encounterId: 16199,
      agentCount: 3,
      skillCount: 6,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 48,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Tempest',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      },
      {
        address: FIRE_ELEMENTAL,
        profession: 6524,
        elite: 0xffffffff,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fire Elemental',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5575, name: 'Air Attunement' },
      { id: ID.ROCK_BARRIER, name: 'Rock Barrier' },
      { id: ID.HURL, name: 'Hurl' },
      { id: ID.OVERLOAD_AIR, name: 'Overload Air' },
      { id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, name: 'Flame Barrage' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.AIR_ATTUNEMENT, 'Air Attunement'),
    catalogSkill(ID.ROCK_BARRIER, 'Rock Barrier', 'Weapon', { quicknessCastTimeMs: 760 }),
    catalogSkill(ID.HURL, 'Hurl', 'Weapon'),
    catalogSkill(ID.OVERLOAD_AIR, 'Overload Air', 'Profession', { quicknessCastTimeMs: 3_200 }),
    catalogSkill(ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, 'Flame Barrage', 'Elite', { independentCast: true })
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(result.rotation.slice(0, 4), [
    { name: 'Rock Barrier', skillId: ID.ROCK_BARRIER },
    { name: 'Air Attunement', skillId: ID.AIR_ATTUNEMENT },
    { name: '__wait', waitMs: 5_000 },
    { name: 'Overload Air', skillId: ID.OVERLOAD_AIR }
  ]);
  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Flame Barrage')
      .map(({ timestampMs, evidence }) => ({ timestampMs, evidence })),
    [
      { timestampMs: 8_860, evidence: 'initial-state' },
      { timestampMs: 18_860, evidence: 'legacy-activation' }
    ]
  );
  assert.equal(result.actions.filter((action) => action.name === 'Hurl').length, 1);
  assert.deepEqual(
    result.rotation.find((command) => command.name === '__combat_start'),
    { name: '__combat_start', offset: 3_120 }
  );
  assert.equal(result.combatStartTimestampMs, 8_883);
});

test('uses default Quickness channels when Arc Lightning has no skill-level commit cutoff', () => {
  const arcStart = 2_000;
  const observedPacketOffsets = [440, 680, 960, 1_200, 1_440, 1_720, 1_960, 2_200];
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5575,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({
      time: arcStart,
      value: 1_571,
      buffDamage: 1_821,
      skillId: ID.ARC_LIGHTNING,
      activation: EVTC_ACTIVATION.START
    }),
    ...observedPacketOffsets.map((offset) =>
      event({
        time: arcStart + offset,
        target: TARGET,
        value: 100,
        skillId: ID.ARC_LIGHTNING
      })
    ),
    event({
      time: arcStart + 2_237,
      value: 2_237,
      buffDamage: 3_360,
      skillId: ID.ARC_LIGHTNING,
      activation: EVTC_ACTIVATION.CANCEL_FIRE
    }),
    event({
      time: 6_000,
      value: 1_571,
      buffDamage: 1_821,
      skillId: ID.ARC_LIGHTNING,
      activation: EVTC_ACTIVATION.START
    }),
    event({
      time: 6_161,
      source: TARGET,
      stateChange: EVTC_STATE_CHANGE.CHANGE_DEAD
    })
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260317',
      revision: 1,
      encounterId: 16199,
      agentCount: 2,
      skillCount: 2,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 48,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Tempest',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5575, name: 'Air Attunement' },
      { id: ID.ARC_LIGHTNING, name: 'Arc Lightning' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.AIR_ATTUNEMENT, 'Air Attunement'),
    catalogSkill(ID.ARC_LIGHTNING, 'Arc Lightning', 'Weapon', {
      castTimeMs: 4_080,
      quicknessCastTimeMs: 2_720,
      effects: [
        {
          type: 'strike',
          ticks: [440, 680, 960, 1_200, 1_440, 1_720, 1_960, 2_200, 2_480, 2_720].map((atMs) => ({
            atMs,
            coefficient: 1
          })),
          timingAnchor: 'castStart',
          timingScale: 'cast'
        }
      ]
    })
  ];

  const result = reconstructEvtcRotation(fixture, { skills });
  const arcActions = result.actions.filter((action) => action.name === 'Arc Lightning');
  const arcCommands = result.rotation.filter((command) => command.name === 'Arc Lightning');

  assert.deepEqual(
    arcActions.map(({ durationMs, status }) => ({ durationMs, status })),
    [
      { durationMs: 2_237, status: 'reduced' },
      { durationMs: 161, status: 'reduced' }
    ]
  );
  assert.deepEqual(arcCommands, [
    {
      name: 'Arc Lightning',
      skillId: ID.ARC_LIGHTNING
    },
    {
      name: 'Arc Lightning',
      skillId: ID.ARC_LIGHTNING
    }
  ]);
});

test('omits cancelled Flamestrike autoattacks without a damage packet', () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    ...animation(ID.FLAMESTRIKE, 2_000, 120),
    ...animation(ID.FLAMESTRIKE, 3_000, 600),
    event({
      time: 3_300,
      target: TARGET,
      value: 100,
      skillId: ID.FLAMESTRIKE
    })
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260317',
      revision: 1,
      encounterId: 16199,
      agentCount: 2,
      skillCount: 2,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 48,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Tempest',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5585, name: 'Fire Attunement' },
      { id: ID.FLAMESTRIKE, name: 'Flamestrike' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.FIRE_ATTUNEMENT, 'Fire Attunement'),
    catalogSkill(ID.FLAMESTRIKE, 'Flamestrike', 'Weapon', {
      quicknessCastTimeMs: 600,
      effects: [
        {
          type: 'strike',
          ticks: [{ atMs: 300, coefficient: 1 }],
          timingAnchor: 'castStart'
        }
      ]
    })
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    result.actions
      .filter((action) => action.name === 'Flamestrike')
      .map(({ timestampMs, status }) => ({ timestampMs, status })),
    [{ timestampMs: 0, status: 'completed' }]
  );
  assert.equal(result.rotation.filter((command) => command.name === 'Flamestrike').length, 1);
});

test('reconstructs Catalyst attunements, Glyph of Storms aliases, and Earth Stomp', () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({
      time: 1_400,
      source: EARTH_ELEMENTAL,
      value: 3_520,
      skillId: 2666,
      sourceInstance: 8,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.RESET,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    }),
    event({
      time: 1_500,
      stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT
    }),
    event({
      time: 2_000,
      target: PLAYER,
      skillId: 5575,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    }),
    ...animation(5737, 2_200, 600),
    event({
      time: 3_000,
      target: PLAYER,
      skillId: 5580,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    }),
    ...animation(5736, 3_200, 600),
    event({
      time: 4_000,
      source: EARTH_ELEMENTAL,
      skillId: 2666,
      sourceInstance: 8,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    })
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260715',
      revision: 1,
      encounterId: 16199,
      agentCount: 3,
      skillCount: 7,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 67,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Catalyst',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      },
      {
        address: EARTH_ELEMENTAL,
        profession: 6523,
        elite: 0,
        toughness: 2061,
        concentration: 0,
        healing: 800,
        condition: 35,
        character: 'Earth Elemental',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5585, name: 'Fire Attunement' },
      { id: 5575, name: 'Air Attunement' },
      { id: 5580, name: 'Earth Attunement' },
      { id: 5736, name: 'Firestorm' },
      { id: 5737, name: 'Lightning Storm' },
      { id: 2666, name: 'Stomp' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.FIRE_ATTUNEMENT, 'Fire Attunement'),
    catalogSkill(ID.AIR_ATTUNEMENT, 'Air Attunement'),
    catalogSkill(ID.EARTH_ATTUNEMENT, 'Earth Attunement'),
    catalogSkill(ID.GLYPH_OF_STORMS_FIRE, 'Glyph of Storms (Fire)', 'Utility'),
    catalogSkill(ID.GLYPH_OF_STORMS_AIR, 'Glyph of Storms (Air)', 'Utility'),
    catalogSkill(2666, 'Stomp', 'Elite')
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map((action) => action.name),
    ['Stomp', 'Air Attunement', 'Glyph of Storms (Air)', 'Earth Attunement', 'Glyph of Storms (Fire)', 'Stomp']
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Fire Attunement'),
    false
  );
  assert.deepEqual(
    result.actions.filter((action) => action.name.startsWith('Glyph of Storms')).map((action) => action.rawSkillId),
    [5737, 5736]
  );
  assert.deepEqual(
    result.actions.filter((action) => action.name === 'Stomp'),
    [
      {
        timestampMs: 0,
        endTimestampMs: 0,
        durationMs: 0,
        expectedDurationMs: 0,
        rawSkillId: 2666,
        skillId: 2666,
        name: 'Stomp',
        kind: 'elite',
        evidence: 'animation',
        status: 'instant',
        supportedByCatalog: true
      },
      {
        timestampMs: 6120,
        endTimestampMs: 6120,
        durationMs: 0,
        expectedDurationMs: 0,
        rawSkillId: 2666,
        skillId: 2666,
        name: 'Stomp',
        kind: 'elite',
        evidence: 'animation',
        status: 'instant',
        supportedByCatalog: true
      }
    ]
  );
});

test('recovers an opening spear etching after the configured starting attunement', () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5575,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({
      time: 1_000,
      target: PLAYER,
      value: 6_080,
      buffDamage: 7_000,
      skillId: 72895,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({ time: 1_001, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 1_240,
      value: 1_120,
      buffDamage: 1_120,
      skillId: 5737,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    }),
    ...animation(ID.TWISTER, 1_240, 600),
    ...animation(ID.FULGOR, 1_840, 560),
    ...animation(ID.DERECHO, 2_400, 600),
    ...animation(ID.ETCHING_DERECHO, 4_000, 240)
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260715',
      revision: 1,
      encounterId: 16199,
      agentCount: 2,
      skillCount: 7,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 67,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Catalyst',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5575, name: 'Air Attunement' },
      { id: 72895, name: '72895' },
      { id: 5737, name: 'Lightning Storm' },
      { id: ID.TWISTER, name: 'Twister' },
      { id: ID.FULGOR, name: 'Fulgor' },
      { id: ID.DERECHO, name: 'Derecho' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.AIR_ATTUNEMENT, 'Air Attunement'),
    catalogSkill(ID.ETCHING_DERECHO, 'Etching: Derecho', 'Weapon', {
      slot: 'Weapon_5',
      weapon: 'Spear',
      attunement: 'Air',
      quicknessCastTimeMs: 240
    }),
    catalogSkill(ID.GLYPH_OF_STORMS_AIR, 'Glyph of Storms (Air)', 'Utility', {
      quicknessCastTimeMs: 1_120
    }),
    catalogSkill(ID.TWISTER, 'Twister', 'Weapon', {
      slot: 'Weapon_4',
      weapon: 'Spear',
      attunement: 'Air',
      quicknessCastTimeMs: 600
    }),
    catalogSkill(ID.FULGOR, 'Fulgor', 'Weapon', {
      slot: 'Weapon_2',
      weapon: 'Spear',
      attunement: 'Air',
      quicknessCastTimeMs: 560
    }),
    catalogSkill(ID.DERECHO, 'Derecho', 'Weapon', {
      slot: 'Weapon_5',
      weapon: 'Spear',
      attunement: 'Air',
      quicknessCastTimeMs: 600
    })
  ];
  const reconstruct = (startAttunement) =>
    reconstructEvtcRotation(fixture, { skills }, { professionConfig: { startAttunement } });
  const fromFire = reconstruct('Fire');
  const fromAir = reconstruct('Air');
  const actionNames = (result) => result.actions.map((action) => action.name);

  assert.deepEqual(fromFire.warnings, []);
  assert.deepEqual(actionNames(fromFire), [
    'Air Attunement',
    'Etching: Derecho',
    'Glyph of Storms (Air)',
    'Twister',
    'Fulgor',
    'Derecho',
    'Etching: Derecho'
  ]);
  assert.deepEqual(actionNames(fromAir), [
    'Etching: Derecho',
    'Glyph of Storms (Air)',
    'Twister',
    'Fulgor',
    'Derecho',
    'Etching: Derecho'
  ]);
  assert.equal(fromFire.actions.filter((action) => action.name === 'Etching: Derecho').length, 2);
  assert.deepEqual(
    fromFire.actions.slice(0, 3).map(({ name, timestampMs }) => ({ name, timestampMs })),
    [
      { name: 'Air Attunement', timestampMs: 0 },
      { name: 'Etching: Derecho', timestampMs: 0 },
      { name: 'Glyph of Storms (Air)', timestampMs: 280 }
    ]
  );
});

test('uses the Evoker parser to normalize familiar skills', () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({
      time: 1_400,
      source: FIRE_ELEMENTAL,
      value: 800,
      skillId: 2662,
      sourceInstance: 9,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.RESET,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    }),
    event({
      time: 1_450,
      source: TOAD_FAMILIAR,
      value: 650,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.RESET,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    }),
    event({
      time: 1_500,
      stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT
    }),
    ...animation(77247, 2_000, 640),
    event({
      time: 2_800,
      source: TOAD_FAMILIAR,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    ...animation(76707, 3_000, 360)
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260604',
      revision: 1,
      encounterId: 16199,
      agentCount: 4,
      skillCount: 5,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 80,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Evoker',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      },
      {
        address: FIRE_ELEMENTAL,
        profession: 6524,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fire Elemental',
        account: '',
        subgroup: ''
      },
      {
        address: TOAD_FAMILIAR,
        profession: 27042,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'ch27042-10',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5585, name: 'Fire Attunement' },
      { id: 77247, name: "Toad's Fortitude" },
      { id: 76707, name: 'Seismic Impact' },
      { id: 2662, name: 'Flame Barrage' },
      { id: 76925, name: 'Calcify' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.FIRE_ATTUNEMENT, 'Fire Attunement'),
    catalogSkill(ID.TOADS_FORTITUDE, "Toad's Fortitude", 'Utility'),
    catalogSkill(ID.SEISMIC_IMPACT, 'Seismic Impact'),
    catalogSkill(2662, 'Flame Barrage', 'Elite'),
    catalogSkill(ID.CALCIFY, 'Calcify')
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.equal(result.parserId, 'elementalist:evoker');
  assert.equal(result.player.specializationId, 'evoker');
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.actions.map(({ rawSkillId, skillId, name }) => ({
      rawSkillId,
      skillId,
      name
    })),
    [
      {
        rawSkillId: 2662,
        skillId: 2662,
        name: 'Flame Barrage'
      },
      {
        rawSkillId: 76925,
        skillId: ID.CALCIFY,
        name: 'Calcify'
      },
      {
        rawSkillId: 77247,
        skillId: ID.TOADS_FORTITUDE,
        name: "Toad's Fortitude"
      },
      {
        rawSkillId: 76925,
        skillId: ID.CALCIFY,
        name: 'Calcify'
      },
      {
        rawSkillId: 76707,
        skillId: ID.SEISMIC_IMPACT,
        name: 'Seismic Impact'
      }
    ]
  );
});

test('reconstructs a clipped Evoker scepter/focus opener and instant familiar inputs', () => {
  const events = [
    event({
      time: 3_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    ...animation(ID.FLAMEWALL, 3_000, 560),
    event({
      time: 3_200,
      source: FIRE_FOX,
      value: 500,
      skillId: 76882,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.CANCEL_FIRE
    }),
    event({ time: 3_560, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 4_000,
      source: FIRE_FOX,
      value: 800,
      skillId: 76882,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.START
    }),
    event({
      time: 4_500,
      target: PLAYER,
      value: 4_000,
      skillId: 5677,
      buff: 1
    }),
    ...animation(ID.TRANSMUTE_FIRE, 4_700, 360),
    event({ time: 4_920, target: TARGET, value: 100, skillId: ID.DRAGONS_TOOTH }),
    event({
      time: 5_500,
      source: FIRE_ELEMENTAL,
      value: 3_000,
      skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
      sourceInstance: 9,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.RESET
    }),
    ...animation(ID.DRAGONS_TOOTH, 6_000, 680)
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260416',
      revision: 1,
      encounterId: 16199,
      agentCount: 4,
      skillCount: 7,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 80,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Evoker',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      },
      {
        address: FIRE_ELEMENTAL,
        profession: 6524,
        elite: 0xffffffff,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fire Elemental',
        account: '',
        subgroup: ''
      },
      {
        address: FIRE_FOX,
        profession: 27043,
        elite: 0xffffffff,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fire Fox',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5585, name: 'Fire Attunement' },
      { id: ID.FLAMEWALL, name: 'Flamewall' },
      { id: 76882, name: 'Ignite' },
      { id: 5677, name: 'Fire Aura' },
      { id: ID.FIRE_SHIELD, name: 'Fire Shield' },
      { id: ID.TRANSMUTE_FIRE, name: 'Transmute Fire' },
      { id: ID.DRAGONS_TOOTH, name: "Dragon's Tooth" },
      { id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, name: 'Flame Barrage' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.FIRE_ATTUNEMENT, 'Fire Attunement'),
    catalogSkill(ID.FLAMEWALL, 'Flamewall', 'Weapon', { quicknessCastTimeMs: 560 }),
    catalogSkill(ID.IGNITE, 'Ignite', 'Profession', { independentCast: true }),
    catalogSkill(ID.FIRE_SHIELD, 'Fire Shield', 'Weapon', { independentCast: true }),
    catalogSkill(ID.TRANSMUTE_FIRE, 'Transmute Fire', 'Weapon', { quicknessCastTimeMs: 360 }),
    catalogSkill(ID.DRAGONS_TOOTH, "Dragon's Tooth", 'Weapon', {
      quicknessCastTimeMs: 680,
      effects: [
        {
          type: 'strike',
          ticks: [{ atMs: 2_600, coefficient: 1 }],
          timingAnchor: 'castStart',
          timingScale: 'cast'
        }
      ]
    }),
    catalogSkill(ID.FLAME_BARRAGE_ELEMENTAL_COMMAND, 'Flame Barrage', 'Elite', { independentCast: true })
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    result.actions
      .filter((action) => ["Dragon's Tooth", 'Flame Barrage', 'Ignite', 'Fire Shield'].includes(action.name))
      .map(({ name, timestampMs, evidence }) => ({ name, timestampMs, evidence })),
    [
      { name: "Dragon's Tooth", timestampMs: 0, evidence: 'effect' },
      { name: 'Flame Barrage', timestampMs: 180, evidence: 'legacy-activation' },
      { name: 'Ignite', timestampMs: 380, evidence: 'legacy-activation' },
      { name: 'Ignite', timestampMs: 1_680, evidence: 'legacy-activation' },
      { name: 'Fire Shield', timestampMs: 2_180, evidence: 'buff-transition' },
      { name: "Dragon's Tooth", timestampMs: 3_680, evidence: 'animation' }
    ]
  );
  assert.ok(
    result.rotation.findIndex((command) => command.name === 'Fire Shield') <
      result.rotation.findIndex((command) => command.name === 'Transmute Fire')
  );
});

test('reconstructs Air Evoker instant inputs from their owned animation and self-buffs', () => {
  const events = [
    event({ time: 2_000, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 2_100,
      source: AIR_FAMILIAR,
      target: TARGET,
      value: 800,
      skillId: 76803,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({
      time: 2_200,
      target: PLAYER,
      value: 10_000,
      skillId: 76507,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    }),
    event({
      time: 2_300,
      target: PLAYER,
      value: 5_000,
      skillId: 73071,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    })
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260507',
      revision: 1,
      encounterId: 16199,
      agentCount: 2,
      skillCount: 3,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 80,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Evoker',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 76803, name: 'Zap' },
      { id: 76507, name: 'Arcane Echo' },
      { id: 73071, name: 'Energize' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.ZAP, 'Zap'),
    catalogSkill(ID.ARCANE_ECHO, 'Arcane Echo', 'Utility'),
    catalogSkill(ID.ENERGIZE, 'Energize', 'Weapon', {
      slot: 'Weapon_3',
      weapon: 'Spear',
      attunement: 'Air'
    })
  ];

  const result = reconstructEvtcRotation(fixture, { skills }, { professionConfig: { evokerElement: 'Air' } });

  assert.deepEqual(
    result.actions.map(({ name, timestampMs, evidence }) => ({ name, timestampMs, evidence })),
    [
      { name: 'Zap', timestampMs: 100, evidence: 'animation' },
      { name: 'Arcane Echo', timestampMs: 200, evidence: 'buff-transition' },
      { name: 'Energize', timestampMs: 300, evidence: 'buff-transition' }
    ]
  );
});

test('keeps committed Calcify inputs when Seismic Impact cancels the familiar animation', () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({ time: 1_900, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 2_000,
      source: TOAD_FAMILIAR,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({
      time: 2_202,
      target: TARGET,
      value: 100,
      skillId: 76925
    }),
    event({
      time: 2_758,
      source: TOAD_FAMILIAR,
      value: 758,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.CANCEL_CANCEL,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    }),
    event({
      time: 2_758,
      source: TOAD_FAMILIAR,
      skillId: 76681,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    ...animation(76707, 2_758, 360),
    event({
      time: 4_000,
      source: TOAD_FAMILIAR,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({
      time: 4_100,
      source: TOAD_FAMILIAR,
      value: 100,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.CANCEL_CANCEL,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    })
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260816',
      revision: 1,
      encounterId: 16199,
      agentCount: 3,
      skillCount: 5,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 80,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Evoker',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      },
      {
        address: TOAD_FAMILIAR,
        profession: 27042,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'ch27042-10',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5585, name: 'Fire Attunement' },
      { id: 76681, name: 'Seismic Impact' },
      { id: 76707, name: 'Seismic Impact' },
      { id: 76925, name: 'Calcify' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.FIRE_ATTUNEMENT, 'Fire Attunement'),
    catalogSkill(ID.CALCIFY, 'Calcify'),
    catalogSkill(ID.SEISMIC_IMPACT, 'Seismic Impact')
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    result.actions.map(({ rawSkillId, skillId, name, status }) => ({ rawSkillId, skillId, name, status })),
    [
      {
        rawSkillId: 76925,
        skillId: ID.CALCIFY,
        name: 'Calcify',
        status: 'instant'
      },
      {
        rawSkillId: 76707,
        skillId: ID.SEISMIC_IMPACT,
        name: 'Seismic Impact',
        status: 'completed'
      }
    ]
  );
  assert.equal(
    result.actions.some((action) => action.rawSkillId === 76681),
    false
  );
  assert.equal(result.actions.find((action) => action.name === 'Calcify')?.timestampMs, 100);
});

test('delays queued Calcify only when an active slot 2-5 weapon cast supplies its missing charges', () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({ time: 1_900, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    ...animation(ID.SAND_SQUALL, 1_900, 300),
    event({
      time: 2_000,
      source: TOAD_FAMILIAR,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_START
    }),
    event({ time: 2_202, target: TARGET, value: 100, skillId: 76925 }),
    event({
      time: 2_800,
      source: TOAD_FAMILIAR,
      value: 800,
      skillId: 76925,
      sourceInstance: 10,
      sourceMasterInstance: 7,
      activation: EVTC_ACTIVATION.CANCEL_FIRE,
      stateChange: EVTC_STATE_CHANGE.ANIMATION_STOP
    })
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260816',
      revision: 1,
      encounterId: 16199,
      agentCount: 3,
      skillCount: 3,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 80,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Evoker',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      },
      {
        address: TOAD_FAMILIAR,
        profession: 27042,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'ch27042-10',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5585, name: 'Fire Attunement' },
      { id: ID.SAND_SQUALL, name: 'Sand Squall' },
      { id: 76925, name: 'Calcify' }
    ],
    events
  };
  const reconstruct = (initialEvokerCharges, slot = 'Weapon_4') =>
    reconstructEvtcRotation(
      fixture,
      {
        skills: [
          catalogSkill(ID.FIRE_ATTUNEMENT, 'Fire Attunement'),
          catalogSkill(ID.SAND_SQUALL, 'Sand Squall', 'Weapon', {
            slot,
            attunement: 'Earth',
            quicknessCastTimeMs: 300
          }),
          catalogSkill(ID.CALCIFY, 'Calcify')
        ]
      },
      {
        professionConfig: {
          evokerElement: 'Earth',
          initialEvokerCharges,
          initialEvokerEmpowered: 0
        }
      }
    );

  assert.equal(reconstruct(4).actions.find((action) => action.name === 'Calcify')?.timestampMs, 300);
  assert.equal(reconstruct(6).actions.find((action) => action.name === 'Calcify')?.timestampMs, 100);
  assert.equal(reconstruct(5, 'Weapon_1').actions.find((action) => action.name === 'Calcify')?.timestampMs, 100);
});

test('orders an outgoing-attunement weapon cast before a simultaneous attunement transition', () => {
  const events = [
    event({
      time: 1_000,
      target: PLAYER,
      skillId: 5585,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_INITIAL
    }),
    event({ time: 1_500, stateChange: EVTC_STATE_CHANGE.ENTER_COMBAT }),
    event({
      time: 2_000,
      target: PLAYER,
      skillId: 5575,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    }),
    event({
      time: 3_000,
      target: PLAYER,
      skillId: 5580,
      buff: 1,
      stateChange: EVTC_STATE_CHANGE.BUFF_APPLY
    }),
    ...animation(30795, 3_000, 440)
  ];
  const fixture = {
    header: {
      magic: 'EVTC',
      arcdpsBuild: '20260816',
      revision: 1,
      encounterId: 16199,
      agentCount: 2,
      skillCount: 4,
      eventCount: events.length
    },
    agents: [
      {
        address: PLAYER,
        profession: 6,
        elite: 80,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Fixture Evoker',
        account: ':Fixture.1234',
        subgroup: '1'
      },
      {
        address: TARGET,
        profession: 16199,
        elite: 0,
        toughness: 0,
        concentration: 0,
        healing: 0,
        condition: 0,
        character: 'Standard Kitty Golem',
        account: '',
        subgroup: ''
      }
    ],
    skills: [
      { id: 5585, name: 'Fire Attunement' },
      { id: 5575, name: 'Air Attunement' },
      { id: 5580, name: 'Earth Attunement' },
      { id: 30795, name: 'Lightning Orb' }
    ],
    events
  };
  const skills = [
    catalogSkill(ID.FIRE_ATTUNEMENT, 'Fire Attunement'),
    catalogSkill(ID.AIR_ATTUNEMENT, 'Air Attunement'),
    catalogSkill(ID.EARTH_ATTUNEMENT, 'Earth Attunement'),
    catalogSkill(30795, 'Lightning Orb', 'Weapon', {
      slot: 'Weapon_5',
      attunement: 'Air',
      quicknessCastTimeMs: 440
    })
  ];

  const result = reconstructEvtcRotation(fixture, { skills });

  assert.deepEqual(
    result.actions.map(({ name, timestampMs }) => ({ name, timestampMs })),
    [
      { name: 'Air Attunement', timestampMs: 500 },
      { name: 'Lightning Orb', timestampMs: 1_500 },
      { name: 'Earth Attunement', timestampMs: 1_501 }
    ]
  );
});
