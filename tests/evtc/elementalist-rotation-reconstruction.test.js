import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '../../js/evtc-analyzer/rotation/index.js';
import { EVTC_ACTIVATION, EVTC_STATE_CHANGE } from '../../js/evtc-analyzer/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../js/professions/elementalist/data/ids.js';

const PLAYER = 0x1000n;
const TARGET = 0x2000n;
const EARTH_ELEMENTAL = 0x3000n;
const FIRE_ELEMENTAL = 0x4000n;
const TOAD_FAMILIAR = 0x5000n;

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
    implemented: true,
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
    { name: '__combat_start', offset: 3_123 }
  );
  assert.equal(result.combatStartTimestampMs, 8_883);
});

test('infers partial Arc Lightning channels from EVTC packet boundaries', () => {
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
          ticks: [660, 1_020, 1_440, 1_800, 2_160, 2_580, 2_940, 3_300, 3_720, 4_080].map((atMs) => ({
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
      skillId: ID.ARC_LIGHTNING,
      interruptMs: 2_237
    },
    {
      name: 'Arc Lightning',
      skillId: ID.ARC_LIGHTNING,
      interruptMs: 161
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
