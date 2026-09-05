import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defaultSimulationConfig } from '../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../helpers/mesmer-simulation.js';

const skill = (id, name, extras = {}) => ({ id, name, ...extras });

// These fixtures keep only the cast dependencies needed to prove each
// profession hook without pinning either supplied report's full rotation.
function reportFixture(profession, rotation, skillMap, end = 40_000) {
  return parseDpsReport({
    durationMS: end,
    players: [
      {
        name: `Fixture ${profession}`,
        account: 'Fixture.1234',
        profession,
        rotation
      }
    ],
    phases: [{ start: 0, end, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap
  });
}

test('reconstructs a simulator-valid Virtuoso rotation with timestamped instant casts', () => {
  const report = reportFixture(
    'Virtuoso',
    [
      { id: 73093, skills: [{ castTime: 0, duration: 600, timeGained: 0 }] },
      {
        id: 10212,
        skills: [
          { castTime: 200, duration: 0, timeGained: 0 },
          { castTime: 850, duration: 0, timeGained: 0 }
        ]
      },
      { id: 72957, skills: [{ castTime: 600, duration: 640, timeGained: 0 }] },
      { id: 72946, skills: [{ castTime: 1240, duration: 240, timeGained: 0 }] },
      { id: 62617, skills: [{ castTime: 1480, duration: 640, timeGained: 0 }] },
      { id: 45425, skills: [{ castTime: 2120, duration: 680, timeGained: 0 }] }
    ],
    {
      s73093: { name: 'Mind the Gap' },
      s10212: { name: 'Power Spike', isInstantCast: true, isNotAccurate: true },
      s72957: { name: 'Mental Collapse' },
      s72946: { name: 'Phantasmal Lancer' },
      s62617: { name: 'Bladesong Harmony' },
      s45425: { name: 'Rain of Swords' }
    },
    8000
  );
  const reconstruction = reconstructDpsReportRotation(report, mesmerCatalog, {
    selectedSkillNames: ['Mantra of Pain', 'Rain of Swords']
  });
  const powerSpikes = reconstruction.rotation.filter((command) => command.name === 'Power Spike');
  const simulation = simulateMesmer(
    reconstruction.rotation,
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [],
      selectedSkills: ['Mantra of Pain', 'Rain of Swords'],
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialResource: 5
    })
  );

  assert.equal(reconstruction.parserId, 'mesmer:virtuoso');
  assert.deepEqual(
    powerSpikes.map((command) => command.offset),
    [200, 250]
  );
  // Spear's flip skill is a player input and must survive generic report reconstruction.
  assert.equal(reconstruction.rotation.filter((command) => command.name === 'Mental Collapse').length, 1);
  assert.equal(
    reconstruction.actions.every((action) => action.supportedByCatalog),
    true
  );
  assert.deepEqual(simulation.warnings, []);
});

test('recovers omitted Virtuoso opener casts from single-target packet totals', () => {
  const report = parseDpsReport({
    targets: [{}],
    players: [
      {
        name: 'Fixture Virtuoso',
        profession: 'Virtuoso',
        targetDamageDist: [
          [
            [
              { id: 62_607, connectedHits: 8 },
              { id: 24_755, connectedHits: 10 },
              { id: 62_597, connectedHits: 5 }
            ]
          ]
        ],
        rotation: [
          { id: 10_174, skills: [{ castTime: 0, duration: 850, timeGained: 0 }] },
          { id: 62_510, skills: [{ castTime: 884, duration: 400, timeGained: 34 }] },
          { id: 62_560, skills: [{ castTime: 1284, duration: 450, timeGained: 0 }] }
        ]
      }
    ],
    phases: [{ start: 0, end: 5000, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap: {
      s10174: { name: 'Phantasmal Swordsman' },
      s62510: { name: 'Flying Cutter', autoAttack: true },
      s62560: { name: 'Bladecall' },
      s62607: { name: 'Unstable Bladestorm' },
      s24755: { name: 'Thousand Cuts', isInstantCast: true },
      s62597: { name: 'Bladeturn Requiem', isInstantCast: true }
    }
  });
  const result = reconstructDpsReportRotation(report, mesmerCatalog);
  const recovered = result.actions.filter((action) => action.inferred).map((action) => action.name);

  assert.deepEqual(recovered, ['Unstable Bladestorm', 'Thousand Cuts', 'Bladeturn Requiem']);
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Unstable Bladestorm.*Thousand Cuts.*Bladeturn Requiem/);
});

test('recovers a Troubadour opener without promoting short Harp casts to their commit point', () => {
  const report = parseDpsReport({
    targets: [{}],
    players: [
      {
        name: 'Fixture Troubadour',
        profession: 'Troubadour',
        targetDamageDist: [[[{ id: 62_607, connectedHits: 8 }]]],
        rotation: [
          { id: 10_174, skills: [{ castTime: 0, duration: 800, timeGained: 0 }] },
          {
            id: 76_960,
            skills: [
              { castTime: 880, duration: 434, timeGained: 883 },
              { castTime: 3_000, duration: 434, timeGained: -1 }
            ]
          },
          { id: 62_560, skills: [{ castTime: 1393, duration: 440, timeGained: 0 }] },
          {
            id: 29_578,
            skills: [
              { castTime: 20_000, duration: 640, timeGained: 0 },
              { castTime: 50_000, duration: 640, timeGained: 0 }
            ]
          },
          { id: 23_285, skills: [{ castTime: 60_000, duration: 0, timeGained: 0 }] }
        ]
      }
    ],
    phases: [{ start: 0, end: 70_000, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap: {
      s10174: { name: 'Phantasmal Swordsman' },
      s76960: { name: 'Harmonious Harp' },
      s62560: { name: 'Bladecall' },
      s29578: { name: 'Mimic' },
      s23285: { name: 'Weapon Stow' },
      s62607: { name: 'Unstable Bladestorm' }
    }
  });
  const result = reconstructDpsReportRotation(report, mesmerCatalog, { selectedSkillNames: ['Mimic'] });

  assert.deepEqual(
    result.actions.filter((action) => action.inferred).map((action) => action.name),
    ['Mimic', 'Unstable Bladestorm']
  );
  // Both report statuses preserve the observed duration below Harp's declared commit.
  assert.deepEqual(
    result.rotation
      .filter((command) => command.name === 'Harmonious Harp')
      .map((command) => command.interruptMs ?? null),
    [440, 440]
  );
  const swordsmanIndex = result.rotation.findIndex((command) => command.name === 'Phantasmal Swordsman');
  assert.equal(result.rotation[swordsmanIndex + 1]?.name, 'Harmonious Harp');
  assert.equal(result.rotation[swordsmanIndex + 2]?.name, 'Bladecall');
  assert.equal(
    result.actions.some((action) => action.name === 'Weapon Stow'),
    false
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Mimic.*Unstable Bladestorm/);
});

test('recovers an opening Harbinger Shroud and removes canceled autoattacks', () => {
  const report = reportFixture(
    'Harbinger',
    [
      { id: 62539, skills: [{ castTime: -800, duration: 840, timeGained: 0 }] },
      { id: 62540, skills: [{ castTime: 40, duration: 0, timeGained: 0 }] },
      { id: 62517, skills: [{ castTime: 80, duration: 120, timeGained: -120 }] },
      { id: 62513, skills: [{ castTime: 200, duration: 840, timeGained: 0 }] },
      { id: 62567, skills: [{ castTime: 10_000, duration: 0, timeGained: 0 }] }
    ],
    {
      s62539: { name: 'Voracious Arc' },
      s62540: { name: 'Exit Harbinger Shroud', isInstantCast: true },
      s62517: { name: 'Vicious Shot', autoAttack: true },
      s62513: { name: 'Weeping Shots' },
      s62567: { name: 'Harbinger Shroud', isInstantCast: true }
    }
  );
  const catalog = {
    skills: [
      skill(62539, 'Voracious Arc', { castTimeMs: 840, shroud: 'harbinger' }),
      skill(62540, 'Exit Harbinger Shroud', { castTimeMs: 0, handlerId: 'necromancer.shroud' }),
      skill(62517, 'Vicious Shot', { type: 'weapon', slot: 'weapon_1', castTimeMs: 600 }),
      skill(62513, 'Weeping Shots', { type: 'weapon', slot: 'weapon_2', castTimeMs: 840 }),
      skill(62567, 'Harbinger Shroud', { castTimeMs: 0, handlerId: 'necromancer.shroud' })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  const openingShroud = result.actions.find((action) => action.name === 'Harbinger Shroud' && action.inferred);

  assert.equal(openingShroud?.timestampMs, 0);
  assert.equal(
    result.actions.some((action) => action.name === 'Vicious Shot'),
    false
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Harbinger Shroud/);
  assert.doesNotMatch(result.warnings.join('\n'), /Interrupted cast/);
});

test('preserves shortened Blood Is Power inputs while the scheduler owns their retained aftercast', () => {
  const report = reportFixture(
    'Harbinger',
    [{ id: 10_544, skills: [{ castTime: 0, duration: 600, timeGained: -280 }] }],
    { s10544: { name: 'Blood Is Power' } }
  );
  const catalog = {
    skills: [
      skill(10_544, 'Blood Is Power', {
        type: 'utility',
        quicknessCastTimeMs: 880,
        retainsCastLockoutAfterInterrupt: true
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);
  const action = result.actions.find((candidate) => candidate.name === 'Blood Is Power');
  const command = result.rotation.find((candidate) => candidate.name === 'Blood Is Power');

  assert.equal(action?.durationMs, 600);
  assert.equal(action?.status, 'interrupted');
  assert.equal(command?.skillId, 10_544);
  assert.equal(command?.interruptMs, 600);
  assert.match(result.warnings.join('\n'), /Interrupted cast/);
});

test('recovers Dragonhunter opening precasts from packet evidence and removes failed autos', () => {
  const report = parseDpsReport({
    durationMS: 10_000,
    targets: [{}],
    players: [
      {
        name: 'Fixture Dragonhunter',
        account: 'Fixture.1234',
        profession: 'Dragonhunter',
        targetDamageDist: [
          [
            [
              { id: 46_469, connectedHits: 8 },
              { id: 30_364, connectedHits: 20 }
            ]
          ]
        ],
        rotation: [
          { id: 29_887, skills: [{ castTime: -267, duration: 533, timeGained: 0 }] },
          { id: 30_364, skills: [{ castTime: 1_000, duration: 440, timeGained: 0 }] },
          { id: 9_168, skills: [{ castTime: 2_000, duration: 600, timeGained: 0 }] },
          { id: 9_137, skills: [{ castTime: 3_000, duration: 33, timeGained: -567 }] }
        ]
      }
    ],
    phases: [{ start: 0, end: 10_000, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap: {
      s29887: { name: 'Spear of Justice' },
      s30364: { name: 'Procession of Blades' },
      s9168: { name: 'Sword of Justice' },
      s9137: { name: 'Strike', autoAttack: true }
    }
  });
  const result = reconstructDpsReportRotation(report, guardianCatalog, {
    selectedSkillNames: ['Procession of Blades', 'Sword of Justice']
  });

  assert.equal(result.actions.find((action) => action.name === 'Sword of Justice')?.inferred, true);
  assert.equal(result.actions.find((action) => action.name === 'Procession of Blades')?.inferred, true);
  assert.equal(
    result.actions.some((action) => action.name === 'Strike'),
    false
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Sword of Justice.*Procession of Blades/);
});

test('collapses Rend animation rows into one Warrior cast', () => {
  const report = reportFixture(
    'Berserker',
    [
      { id: 80_247, skills: [{ castTime: 100, duration: 480, timeGained: 80 }] },
      { id: 80_224, skills: [{ castTime: 580, duration: 480, timeGained: 0 }] }
    ],
    {
      s80247: { name: 'Rend' },
      s80224: { name: 'Rend' }
    },
    2_000
  );
  const catalog = {
    skills: [skill(80_247, 'Rend', { type: 'weapon', slot: 'weapon_3', quicknessCastTimeMs: 960 })]
  };

  const result = reconstructDpsReportRotation(report, catalog);
  const rend = result.actions.find((action) => action.name === 'Rend');

  assert.equal(rend?.rawSkillId, 80_247);
  assert.equal(rend?.durationMs, 960);
  assert.equal(result.rotation.filter((command) => command.name === 'Rend').length, 1);
});

test('reconstructs Antiquary artifact setup, Guitar, and packet-proven Cannon outcomes', () => {
  const report = parseDpsReport({
    targets: [{}],
    players: [
      {
        name: 'Fixture Antiquary',
        profession: 'Antiquary',
        firstAware: -100,
        targetDamageDist: [
          [
            [
              {
                id: 76_725,
                connectedHits: 8
              }
            ]
          ]
        ],
        rotation: [
          {
            id: 76_725,
            skills: [
              { castTime: 0, duration: 520, timeGained: 0 },
              { castTime: 3_000, duration: 520, timeGained: 0 },
              { castTime: 15_000, duration: 520, timeGained: 0 }
            ]
          },
          { id: 77_277, skills: [{ castTime: 600, duration: 600, timeGained: 0 }] },
          { id: 76_582, skills: [{ castTime: 5_000, duration: 1_400, timeGained: 600 }] },
          { id: 76_596, skills: [{ castTime: 6_400, duration: 500, timeGained: 0 }] },
          { id: 77_397, skills: [{ castTime: 10_000, duration: 200, timeGained: 0 }] }
        ]
      }
    ],
    phases: [{ start: 0, end: 20_000, name: 'Full Fight', phaseType: 'Encounter' }],
    skillMap: {
      s76582: { name: 'Metal Legion Guitar (Rockout)' },
      s76596: { name: 'Metal Legion Guitar (Smash)' },
      s76725: { name: 'Stone Summit Cannon' },
      s77277: { name: 'Mistburn Mortar' },
      s77397: { name: 'Skritt Swipe' }
    }
  });
  const result = reconstructDpsReportRotation(report, thiefCatalog);

  assert.deepEqual(
    result.rotation
      .filter((command) => command.name === 'Stone Summit Cannon')
      .map((command) => command.doubleEdgeOutcome),
    ['success', 'backfire', 'backfire', 'success']
  );
  assert.equal(result.actions.filter((action) => action.name === 'Metal Legion Guitar').length, 1);
  assert.equal(
    result.actions.some((action) => action.rawSkillId === 76_596),
    false
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Skritt Swipe' && action.inferred),
    true
  );
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('recovers report-omitted Antiquary Caltrops, Needles, and Chak Shield from minimal evidence', () => {
  const phases = [
    { start: 0, end: 40_000, name: 'Full Fight', phaseType: 'Encounter' },
    { start: 0, end: 10_000, name: '100% - 75%', phaseType: 'SubPhase', encounterPhase: 0 },
    { start: 10_000, end: 20_000, name: '75% - 50%', phaseType: 'SubPhase', encounterPhase: 0 },
    { start: 20_000, end: 30_000, name: '50% - 25%', phaseType: 'SubPhase', encounterPhase: 0 },
    { start: 30_000, end: 40_000, name: '25% - 0%', phaseType: 'SubPhase', encounterPhase: 0 }
  ];
  const phaseDamage = [
    [
      { id: 56_897, connectedHits: 15 },
      { id: 76_816, connectedHits: 12 }
    ],
    [{ id: 76_816, connectedHits: 2 }],
    [{ id: 76_816, connectedHits: 4 }],
    [{ id: 76_816, connectedHits: 1 }],
    [{ id: 76_816, connectedHits: 5 }]
  ];
  const report = parseDpsReport({
    targets: [{}],
    players: [
      {
        name: 'Fixture Antiquary',
        profession: 'Antiquary',
        firstAware: -500,
        targetDamageDist: [phaseDamage],
        rotation: [
          { id: 72_927, skills: [{ castTime: 0, duration: 360, timeGained: 0 }] },
          { id: 77_277, skills: [{ castTime: 500, duration: 600, timeGained: 0 }] },
          { id: 13_026, skills: [{ castTime: 1_000, duration: 600, timeGained: 0 }] },
          { id: 56_898, skills: [{ castTime: 5_000, duration: 0, timeGained: 0 }] },
          { id: 77_397, skills: [{ castTime: 18_000, duration: 200, timeGained: 0 }] },
          { id: 13_028, skills: [{ castTime: 20_000, duration: 920, timeGained: 0 }] },
          { id: 13_026, skills: [{ castTime: 25_000, duration: 600, timeGained: 0 }] }
        ]
      }
    ],
    phases,
    skillMap: {
      s13026: { name: 'Prepare Thousand Needles' },
      s13028: { name: 'Caltrops' },
      s56898: { name: 'Thousand Needles', isInstantCast: true },
      s72927: { name: 'Distracting Throw' },
      s76816: { name: 'Chak Shield', isInstantCast: true },
      s77277: { name: 'Mistburn Mortar' },
      s77397: { name: 'Skritt Swipe' }
    }
  });
  const result = reconstructDpsReportRotation(report, thiefCatalog, {
    selectedSkillNames: ['Caltrops', 'Prepare Thousand Needles'],
    professionConfig: { boons: { alacrity: true }, selectedTraitIds: [2_431] }
  });
  const inferred = result.actions.filter((action) => action.inferred);

  assert.equal(inferred.filter((action) => action.name === 'Caltrops').length, 1);
  assert.equal(inferred.filter((action) => action.name === 'Prepare Thousand Needles').length, 1);
  assert.equal(inferred.filter((action) => action.name === 'Thousand Needles').length, 2);
  assert.deepEqual(
    inferred.filter((action) => action.name === 'Chak Shield').map((action) => action.timestampMs),
    [39_900, 60_900]
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Caltrops.*Thousand Needles.*Chak Shield/);
});

test('orders simultaneous dps.report instant casts before cast-time skills', () => {
  const report = reportFixture(
    'Berserker',
    [
      { id: 30_343, skills: [{ castTime: -765, duration: 800, timeGained: 0 }] },
      { id: 14_504, skills: [{ castTime: 77, duration: 680, timeGained: 0 }] },
      { id: 30_258, skills: [{ castTime: 77, duration: 0, timeGained: 0 }] }
    ],
    {
      s30343: { name: 'Head Butt' },
      s14504: { name: 'Pin Down' },
      s30258: { name: 'Outrage', isInstantCast: true }
    },
    1_000
  );
  const catalog = {
    skills: [
      skill(30_343, 'Head Butt', {
        type: 'elite',
        quicknessCastTimeMs: 800,
        selfStunMs: 1_000,
        effects: [{ type: 'strike', atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }]
      }),
      skill(14_504, 'Pin Down', { type: 'weapon', quicknessCastTimeMs: 680 }),
      skill(30_258, 'Outrage', { type: 'utility', castTimeMs: 0, stunbreak: true })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.deepEqual(
    result.actions.map((action) => action.name),
    ['Head Butt', 'Outrage', 'Pin Down']
  );
  assert.deepEqual(
    result.rotation.map((command) => command.name),
    ['Head Butt', '__combat_start', '__wait', 'Outrage', 'Pin Down']
  );
  assert.deepEqual(result.rotation[1], { name: '__combat_start', offset: 720 });
  assert.equal(result.combatStartTimestampMs, 720);
  const simulation = simulateGw2({
    profession: warriorProfession,
    rotation: result.rotation.slice(0, 2),
    config: defaultSimulationConfig({ specialization: 'Berserker' })
  });
  assert.ok(
    simulation.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Head Butt' && event.damage > 0
    )
  );
});

test('does not add waits for retained cast lockout already modeled by the skill', () => {
  const report = reportFixture(
    'Berserker',
    [
      { id: 14_519, skills: [{ castTime: 0, duration: 318, timeGained: 242 }] },
      { id: 14_365, skills: [{ castTime: 560, duration: 520, timeGained: 0 }] }
    ],
    {
      s14519: { name: 'Fan of Fire' },
      s14365: { name: 'Gash' }
    },
    1_200
  );
  const catalog = {
    skills: [
      skill(14_519, 'Fan of Fire', {
        type: 'weapon',
        quicknessCastTimeMs: 560,
        interruptCommitMs: 240,
        retainsCastLockoutAfterInterrupt: true
      }),
      skill(14_365, 'Gash', { type: 'weapon', quicknessCastTimeMs: 520 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.deepEqual(
    result.rotation.map((command) => command.name),
    ['__combat_start', 'Fan of Fire', 'Gash']
  );
  assert.deepEqual(result.rotation[1], { name: 'Fan of Fire', skillId: 14_519, interruptMs: 320 });
});

test('rounds EI cast durations without extending cancellations to nearby commit points', () => {
  const report = reportFixture(
    'Berserker',
    [
      { id: 14_519, skills: [{ castTime: 0, duration: 318, timeGained: 212 }] },
      { id: 14_365, skills: [{ castTime: 400, duration: 403, timeGained: 134 }] },
      { id: 14_519, skills: [{ castTime: 900, duration: 199, timeGained: 321 }] },
      { id: 14_519, skills: [{ castTime: 1_400, duration: 238, timeGained: 282 }] }
    ],
    {
      s14519: { name: 'Fan of Fire' },
      s14365: { name: 'Gash' }
    },
    2_000
  );
  const catalog = {
    skills: [
      skill(14_519, 'Fan of Fire', {
        type: 'weapon',
        quicknessCastTimeMs: 560,
        interruptCommitMs: 240,
        retainsCastLockoutAfterInterrupt: true
      }),
      skill(14_365, 'Gash', { type: 'weapon', quicknessCastTimeMs: 520 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);
  const fanCommands = result.rotation.filter((command) => command.name === 'Fan of Fire');
  const gash = result.rotation.find((command) => command.name === 'Gash');

  assert.equal(fanCommands[0].interruptMs, 320);
  assert.equal(fanCommands[1].interruptMs, 200);
  assert.equal(fanCommands[2].interruptMs, 240);
  assert.equal(gash.interruptMs, 400);
});

test('coalesces Willbender composite casts and recovers an opening Jurisdiction', () => {
  const report = reportFixture(
    'Willbender',
    [
      { id: 71818, skills: [{ castTime: -160, duration: 320, timeGained: 0 }] },
      { id: 62668, skills: [{ castTime: 160, duration: 40, timeGained: 440 }] },
      { id: 62624, skills: [{ castTime: 200, duration: 440, timeGained: 0 }] },
      { id: 9090, skills: [{ castTime: 640, duration: 320, timeGained: 0 }] },
      { id: 71817, skills: [{ castTime: 960, duration: 480, timeGained: 320 }] },
      { id: 71818, skills: [{ castTime: 1440, duration: 320, timeGained: 0 }] },
      { id: 72031, skills: [{ castTime: 1760, duration: 399, timeGained: 201 }] }
    ],
    {
      s71818: { name: 'Fire Jurisdiction (Level 1)' },
      s62668: { name: 'Rushing Justice' },
      s62624: { name: 'Rushing Justice (Hit)' },
      s9090: { name: 'Symbol of Punishment' },
      s71817: { name: 'Jurisdiction' },
      s72031: { name: 'Through the Heart', autoAttack: true }
    },
    5000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);

  assert.equal(result.actions.find((action) => action.name === 'Jurisdiction' && action.inferred)?.timestampMs, 0);
  assert.equal(result.rotation.find((command) => command.name === '__combat_start')?.offset, 640);
  assert.equal(result.actions.filter((action) => action.name === 'Rushing Justice').length, 1);
  assert.equal(
    result.actions.every((action) => action.supportedByCatalog),
    true
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Jurisdiction/);
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('Luminary does not advance an autoattack chain after a reduced cast below commit', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 90_001, skills: [{ castTime: 0, duration: 200, timeGained: 200 }] },
      { id: 90_002, skills: [{ castTime: 200, duration: 400, timeGained: 0 }] }
    ],
    { s90001: { name: 'Chain Root' }, s90002: { name: 'Chain Follow-up' } }
  );
  const catalog = {
    skills: [
      skill(90_001, 'Chain Root', {
        slot: 'Weapon_1',
        quicknessCastTimeMs: 400,
        chainRoot: 90_001,
        nextChainId: 90_002
      }),
      skill(90_002, 'Chain Follow-up', {
        slot: 'Weapon_1',
        quicknessCastTimeMs: 400,
        chainRoot: 90_001
      })
    ]
  };
  const result = reconstructDpsReportRotation(report, catalog);

  assert.deepEqual(result.rotation, [
    { name: '__combat_start' },
    { name: 'Chain Root', skillId: 90_001, interruptMs: 200 },
    { name: 'Chain Root', skillId: 90_001 }
  ]);
});

test('recovers alacrity Luminary opening state and retains only physical weapon swaps', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 76687, skills: [{ castTime: -681, duration: 996, timeGained: 0 }] },
      {
        id: -2,
        skills: [
          { castTime: 315, duration: 0, timeGained: 0 },
          { castTime: 1_716, duration: 0, timeGained: 0 },
          { castTime: 2_676, duration: 0, timeGained: 0 },
          { castTime: 3_236, duration: 0, timeGained: 0 }
        ]
      },
      { id: 76708, skills: [{ castTime: 315, duration: 500, timeGained: 60 }] },
      { id: 78837, skills: [{ castTime: 355, duration: 0, timeGained: 0 }] },
      { id: 76813, skills: [{ castTime: 395, duration: 0, timeGained: 0 }] },
      { id: 78604, skills: [{ castTime: 435, duration: 0, timeGained: 0 }] },
      { id: 76924, skills: [{ castTime: 875, duration: 840, timeGained: 0 }] },
      { id: 77339, skills: [{ castTime: 1_715, duration: 480, timeGained: 0 }] },
      { id: 76910, skills: [{ castTime: 2_195, duration: 480, timeGained: 0 }] },
      { id: 76616, skills: [{ castTime: 2_675, duration: 0, timeGained: 0 }] },
      { id: 72978, skills: [{ castTime: 2_676, duration: 560, timeGained: 0 }] },
      { id: 9146, skills: [{ castTime: 3_236, duration: 280, timeGained: 0 }] },
      { id: 76730, skills: [{ castTime: 5_000, duration: 0, timeGained: 0 }] },
      { id: 77073, skills: [{ castTime: 10_000, duration: 0, timeGained: 0 }] },
      { id: 78358, skills: [{ castTime: 30_000, duration: 0, timeGained: 0 }] }
    ],
    {
      s76687: { name: 'Daring Advance' },
      's-2': { name: 'Weapon Swap', isSwap: true },
      s76708: { name: 'Luminous Staff' },
      s78837: { name: 'Radiant Justice', isInstantCast: true },
      s76813: { name: 'Effulgent Stance', isInstantCast: true },
      s78604: { name: 'Radiant Resolve', isInstantCast: true },
      s76924: { name: 'Gleaming Blade' },
      s77339: { name: 'Dazzling Hammer' },
      s76910: { name: 'Shining Spin' },
      s76616: { name: 'Exit Radiant Forge', isInstantCast: true },
      s72978: { name: 'Gleaming Disc' },
      s9146: { name: 'Symbol of Resolution' },
      s76730: { name: 'Effulgent Stance (Damage)', isInstantCast: true },
      s77073: { name: 'Enter Radiant Forge', isInstantCast: true },
      s78358: { name: 'Radiant Courage', isInstantCast: true }
    }
  );
  const catalog = {
    skills: [
      skill(76687, 'Daring Advance', {
        castTimeMs: 1_000,
        effects: [{ type: 'strike', ticks: [{ atMs: 680 }], timingAnchor: 'castStart', timingScale: 'fixed' }]
      }),
      skill(76708, 'Luminous Staff', { quicknessCastTimeMs: 560, radiantForgeSkill: true }),
      skill(78837, 'Radiant Justice', { castTimeMs: 0 }),
      skill(76813, 'Effulgent Stance', { castTimeMs: 0 }),
      skill(78604, 'Radiant Resolve', { castTimeMs: 0 }),
      skill(76924, 'Gleaming Blade', { quicknessCastTimeMs: 840, radiantForgeSkill: true }),
      skill(77339, 'Dazzling Hammer', { quicknessCastTimeMs: 480, radiantForgeSkill: true }),
      skill(76910, 'Shining Spin', { quicknessCastTimeMs: 480, radiantForgeSkill: true }),
      skill(76616, 'Exit Radiant Forge', { castTimeMs: 0, handlerId: 'guardian.radiant-forge' }),
      skill(72978, 'Gleaming Disc', { type: 'weapon', weapon: 'Spear', quicknessCastTimeMs: 560 }),
      skill(9146, 'Symbol of Resolution', { type: 'weapon', weapon: 'Greatsword', castTimeMs: 280 }),
      skill(77073, 'Enter Radiant Forge', { castTimeMs: 0, handlerId: 'guardian.radiant-forge' }),
      skill(78358, 'Radiant Courage', { castTimeMs: 0, cooldown: 45 }),
      skill(-3, 'Swap Weapons', { castTimeMs: 0 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.equal(
    result.rotation.some((command) => command.name === 'Radiant Courage'),
    true
  );
  assert.equal(
    result.rotation.some((command) => command.name === 'Enter Radiant Forge'),
    true
  );
  assert.equal(result.rotation.find((command) => command.name === '__combat_start')?.offset, 680);
  assert.equal(result.rotation.filter((command) => command.name === 'Swap Weapons').length, 1);
  assert.equal(
    result.actions.some((action) => action.rawSkillId === 76730),
    false
  );
  assert.equal(result.rotation.find((command) => command.name === 'Luminous Staff').interruptMs, 520);
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Radiant Courage.*Enter Radiant Forge/);
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('aligns dps.report combat start with an opening Symbol of Luminance packet', () => {
  const report = reportFixture(
    'Luminary',
    [{ id: 73_132, skills: [{ castTime: -361, duration: 444, timeGained: 0 }] }],
    { s73132: { name: 'Symbol of Luminance' } },
    1_000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);

  assert.deepEqual(result.rotation, [
    { name: 'Symbol of Luminance', skillId: 73_132 },
    { name: '__combat_start', offset: 360 }
  ]);
  const simulation = simulateGw2({
    profession: guardianProfession,
    rotation: result.rotation,
    config: defaultSimulationConfig({ specialization: 'Luminary', primaryWeapon: 'Spear' })
  });

  assert.ok(
    simulation.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Symbol of Luminance — Initial')
  );
});

test('keeps near-nominal Glaring Burst report casts at their 600 ms runtime', () => {
  const report = reportFixture(
    'Luminary',
    [{ id: 76_950, skills: [{ castTime: 0, duration: 600, timeGained: 0 }] }],
    { s76950: { name: 'Glaring Burst', autoAttack: true } },
    1_000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);
  const glaringBurst = result.rotation.find((command) => command.name === 'Glaring Burst');

  assert.equal('interruptMs' in glaringBurst, false);
});

test('accepts committed Symbol of Resolution report casts through its normal runtime', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 9_146, skills: [{ castTime: 0, duration: 240, timeGained: 0 }] },
      { id: 9_146, skills: [{ castTime: 240, duration: 280, timeGained: 0 }] },
      { id: 9_146, skills: [{ castTime: 520, duration: 320, timeGained: 0 }] }
    ],
    { s9146: { name: 'Symbol of Resolution' } },
    1_000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);
  const symbols = result.rotation.filter((command) => command.name === 'Symbol of Resolution');

  // Committed early casts retain their observed action ticks; the full cast uses catalog timing.
  assert.deepEqual(
    symbols.map((command) => command.interruptMs ?? null),
    [240, 280, null]
  );
});

test('reconstructs every observed Helio Rush action-lane duration', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 72_940, skills: [{ castTime: 0, duration: 278, timeGained: 162 }] },
      { id: 72_940, skills: [{ castTime: 280, duration: 321, timeGained: 119 }] },
      { id: 72_940, skills: [{ castTime: 600, duration: 398, timeGained: 42 }] },
      { id: 72_940, skills: [{ castTime: 1_000, duration: 438, timeGained: 2 }] }
    ],
    { s72940: { name: 'Helio Rush' } },
    2_000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);
  const helioCommands = result.rotation.filter((command) => command.name === 'Helio Rush');

  // EI measurements snap to GW2's 40 ms action ticks; 440 ms is ordinary completion.
  assert.deepEqual(
    helioCommands.map((command) => command.interruptMs ?? null),
    [280, 320, 400, null]
  );
});

test('uses an overlapping weapon swap as the Helio Rush cancel boundary', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 72_940, skills: [{ castTime: 0, duration: 399, timeGained: 1_001 }] },
      { id: -2, skills: [{ castTime: 321, duration: 0, timeGained: 0 }] },
      { id: 9_146, skills: [{ castTime: 322, duration: 280, timeGained: 0 }] }
    ],
    {
      s72940: { name: 'Helio Rush' },
      's-2': { name: 'Weapon Swap', isSwap: true },
      s9146: { name: 'Symbol of Resolution' }
    },
    1_000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);

  assert.deepEqual(
    result.rotation.find((command) => command.name === 'Helio Rush'),
    {
      name: 'Helio Rush',
      skillId: 72_940,
      interruptMs: 320
    }
  );
});

test('uses Forge entry as a cancel boundary only for weapon skills', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 72_940, skills: [{ castTime: 0, duration: 435, timeGained: 985 }] },
      {
        id: 77_073,
        skills: [
          { castTime: 316, duration: 0, timeGained: 0 },
          { castTime: 1_500, duration: 0, timeGained: 0 }
        ]
      },
      {
        id: 77_339,
        skills: [
          { castTime: 435, duration: 480, timeGained: 0 },
          { castTime: 1_600, duration: 480, timeGained: 0 }
        ]
      },
      { id: 9_168, skills: [{ castTime: 1_000, duration: 600, timeGained: 0 }] }
    ],
    {
      s72940: { name: 'Helio Rush' },
      s77073: { name: 'Enter Radiant Forge', isInstantCast: true },
      s77339: { name: 'Dazzling Hammer' },
      s9168: { name: 'Sword of Justice' }
    },
    3_000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);
  const helioIndex = result.rotation.findIndex((command) => command.name === 'Helio Rush');
  const sword = result.rotation.find((command) => command.name === 'Sword of Justice');

  assert.deepEqual(result.rotation.slice(helioIndex, helioIndex + 4), [
    { name: 'Helio Rush', skillId: 72_940, interruptMs: 320 },
    { name: 'Enter Radiant Forge', skillId: 77_073 },
    { name: '__wait', waitMs: 120 },
    { name: 'Dazzling Hammer', skillId: 77_339 }
  ]);
  assert.equal('interruptMs' in sword, false);
});

test('preserves observed Daybreaking Slash ticks between commit and full cast', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 73_055, skills: [{ castTime: 0, duration: 402, timeGained: 158 }] },
      { id: 73_055, skills: [{ castTime: 400, duration: 478, timeGained: 82 }] },
      { id: 73_055, skills: [{ castTime: 880, duration: 518, timeGained: 42 }] },
      { id: 73_055, skills: [{ castTime: 1_400, duration: 558, timeGained: 0 }] }
    ],
    { s73055: { name: 'Daybreaking Slash' } },
    2_000
  );

  const result = reconstructDpsReportRotation(report, guardianCatalog);
  const commands = result.rotation.filter((command) => command.name === 'Daybreaking Slash');

  assert.deepEqual(
    commands.map((command) => command.interruptMs ?? null),
    [400, 480, 520, null]
  );
});

test('recovers Renegade warband precasts and normalizes legend and enhanced summon signals', () => {
  const report = reportFixture(
    'Renegade',
    [
      { id: 28357, skills: [{ castTime: -440, duration: 600, timeGained: 0 }] },
      {
        id: 28494,
        skills: [
          { castTime: 160, duration: 0, timeGained: 0 },
          { castTime: 21_324, duration: 0, timeGained: 0 }
        ]
      },
      {
        id: 41858,
        skills: [
          { castTime: 11_200, duration: 0, timeGained: 0 },
          { castTime: 30_000, duration: 0, timeGained: 0 }
        ]
      },
      {
        id: 40485,
        skills: [
          { castTime: 19_602, duration: 520, timeGained: 0 },
          { castTime: 30_500, duration: 520, timeGained: 0 }
        ]
      },
      {
        id: 72363,
        skills: [
          { castTime: 20_680, duration: 0, timeGained: 0 },
          { castTime: 31_200, duration: 0, timeGained: 0 }
        ]
      },
      { id: 40497, skills: [{ castTime: 31_400, duration: 480, timeGained: 0 }] }
    ],
    {
      s28357: { name: 'Searing Fissure' },
      s28494: { name: 'Legendary Demon Stance', isInstantCast: true },
      s41858: { name: 'Legendary Renegade Stance', isInstantCast: true },
      s40485: { name: "Icerazor's Ire" },
      s72363: { name: "Razorclaw's Rage", isInstantCast: true, isNotAccurate: true },
      s40497: { name: 'Shattershot', autoAttack: true }
    }
  );
  const catalog = {
    skills: [
      skill(28357, 'Searing Fissure', { type: 'weapon', weapon: 'Mace', quicknessCastTimeMs: 600 }),
      skill(28494, 'Legendary Demon Stance', { castTimeMs: 0 }),
      skill(41858, 'Legendary Renegade Stance', { castTimeMs: 0 }),
      skill(-4, 'Swap Legends', { castTimeMs: 0, handlerId: 'revenant.legend-swap' }),
      skill(40485, "Icerazor's Ire", { castTimeMs: 520 }),
      skill(42949, "Razorclaw's Rage", { castTimeMs: 500 }),
      skill(72363, "Razorclaw's Rage", { castTimeMs: 0 }),
      skill(40497, 'Shattershot', { type: 'weapon', weapon: 'Shortbow', slot: 'weapon_1', castTimeMs: 480 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.equal(
    result.rotation.some((command) => command.name === "Icerazor's Ire"),
    true
  );
  assert.equal(result.rotation.find((command) => command.name === "Razorclaw's Rage")?.offset, 400);
  assert.equal(result.rotation.find((command) => command.name === '__combat_start')?.offset, 40);
  assert.equal(
    result.rotation.some((command) => /^Legendary .+ Stance$/.test(command.name)),
    false
  );
  assert.equal(
    result.actions.filter((action) => action.rawSkillId === 72363).every((action) => action.skillId === 42949),
    true
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Icerazor's Ire.*Razorclaw's Rage/);
});

test('normalizes Renegade warband variants and ignores generated Spear mine signals', () => {
  const report = reportFixture(
    'Renegade',
    [
      { id: 28287, skills: [{ castTime: 0, duration: 440, timeGained: 0 }] },
      { id: 72938, skills: [{ castTime: 440, duration: 520, timeGained: 0 }] },
      { id: -39, skills: [{ castTime: 440, duration: 0, timeGained: 0 }] },
      { id: 73149, skills: [{ castTime: 960, duration: 0, timeGained: 0 }] },
      { id: 72366, skills: [{ castTime: 800, duration: 0, timeGained: 0 }] },
      { id: 73139, skills: [{ castTime: 1000, duration: 480, timeGained: 0 }] },
      { id: 26693, skills: [{ castTime: 1500, duration: 0, timeGained: 0 }] },
      { id: 41858, skills: [{ castTime: 1600, duration: 0, timeGained: 0 }] }
    ],
    {
      s28287: { name: 'Embrace the Darkness' },
      s72938: { name: 'Abyssal Blitz' },
      's-39': { name: 'Blitz Mines (Drop)', isInstantCast: true, isNotAccurate: true },
      s73149: { name: 'Blitz Mines (Detonation)', isInstantCast: true, isNotAccurate: true },
      s72366: { name: "Darkrazor's Daring", isInstantCast: true, isNotAccurate: true },
      s73139: { name: 'Abyssal Strike', autoAttack: true },
      s26693: { name: 'Resist the Darkness', isInstantCast: true },
      s41858: { name: 'Legendary Renegade Stance', isInstantCast: true }
    }
  );
  const catalog = {
    skills: [
      skill(28287, 'Embrace the Darkness', { castTimeMs: 440 }),
      skill(72938, 'Abyssal Blitz', { type: 'weapon', weapon: 'Spear', castTimeMs: 520 }),
      skill(73015, 'Abyssal Strike', {
        type: 'weapon',
        weapon: 'Spear',
        slot: 'weapon_1',
        castTimeMs: 480
      }),
      skill(73149, 'Blitz Mines', { type: 'weapon', weapon: 'Spear', castTimeMs: 0 }),
      skill(41220, "Darkrazor's Daring", { castTimeMs: 500 }),
      skill(72366, "Darkrazor's Daring", { castTimeMs: 0, simulatorExcluded: true }),
      skill(26693, 'Resist the Darkness', { castTimeMs: 0, handlerId: 'revenant.upkeep-release' }),
      skill(41858, 'Legendary Renegade Stance', { castTimeMs: 0 }),
      skill(-4, 'Swap Legends', { castTimeMs: 0, handlerId: 'revenant.legend-swap' })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.equal(result.actions.find((action) => action.rawSkillId === 72366)?.skillId, 41220);
  assert.equal(result.actions.find((action) => action.rawSkillId === 73139)?.skillId, 73015);
  assert.equal(
    result.actions.some((action) => [-39, 73149].includes(action.rawSkillId)),
    false
  );
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('normalizes power Renegade legend cycles, composite casts, and Greatsword autoattacks', () => {
  const report = reportFixture(
    'Renegade',
    [
      { id: 62929, skills: [{ castTime: -840, duration: 840, timeGained: 0 }] },
      { id: 28134, skills: [{ castTime: 0, duration: 0, timeGained: 0 }] },
      { id: 41858, skills: [{ castTime: 10_000, duration: 0, timeGained: 0 }] },
      { id: 40485, skills: [{ castTime: 10_500, duration: 520, timeGained: 0 }] },
      { id: 62895, skills: [{ castTime: 11_020, duration: 40, timeGained: 460 }] },
      { id: 62713, skills: [{ castTime: 11_060, duration: 400, timeGained: 0 }] },
      { id: 62913, skills: [{ castTime: 11_460, duration: 400, timeGained: 188 }] },
      { id: 28382, skills: [{ castTime: 20_000, duration: 0, timeGained: 0 }] },
      { id: 28134, skills: [{ castTime: 20_000, duration: 0, timeGained: 0 }] },
      { id: 27074, skills: [{ castTime: 20_100, duration: 360, timeGained: 120 }] },
      { id: 28625, skills: [{ castTime: 20_460, duration: 360, timeGained: 0 }] }
    ],
    {
      s62929: { name: "Eternity's Requiem" },
      s28134: { name: 'Legendary Assassin Stance', isInstantCast: true },
      s41858: { name: 'Legendary Renegade Stance', isInstantCast: true },
      s40485: { name: "Icerazor's Ire" },
      s62895: { name: "Phantom's Onslaught" },
      s62713: { name: "Phantom's Onslaught (Hit)" },
      s62913: { name: 'Mist Swing', autoAttack: true },
      s28382: { name: 'Relinquish Power', isInstantCast: true },
      s27074: { name: 'Deathstrike' },
      s28625: { name: 'Deathstrike' }
    },
    25_000
  );
  const catalog = {
    skills: [
      skill(-4, 'Swap Legends', { castTimeMs: 0, handlerId: 'revenant.legend-swap' }),
      skill(62929, "Eternity's Requiem", { type: 'weapon', weapon: 'Greatsword', quicknessCastTimeMs: 840 }),
      skill(28134, 'Legendary Assassin Stance', { castTimeMs: 0 }),
      skill(41858, 'Legendary Renegade Stance', { castTimeMs: 0 }),
      skill(40485, "Icerazor's Ire", { quicknessCastTimeMs: 520 }),
      skill(41220, "Darkrazor's Daring", { castTimeMs: 500 }),
      skill(62895, "Phantom's Onslaught", { type: 'weapon', weapon: 'Greatsword', quicknessCastTimeMs: 440 }),
      skill(62713, "Phantom's Onslaught", { type: 'weapon', weapon: 'Greatsword', quicknessCastTimeMs: 440 }),
      skill(62913, 'Mist Swing', {
        type: 'weapon',
        weapon: 'Greatsword',
        slot: 'weapon_1',
        chainRoot: 62913,
        nextChainId: 62688,
        castTimeMs: 400
      }),
      skill(28382, 'Relinquish Power', { castTimeMs: 0, handlerId: 'revenant.upkeep-release' }),
      skill(27074, 'Deathstrike', { type: 'weapon', weapon: 'Sword', quicknessCastTimeMs: 720 }),
      skill(28625, 'Deathstrike', { type: 'weapon', weapon: 'Sword', quicknessCastTimeMs: 720 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog, {
    professionConfig: {
      specializations: [{ name: 'Invocation', traits: '2-1-2' }],
      weapons: ['Greatsword', ''],
      startingLegend: 'LegendaryRenegade'
    }
  });

  assert.equal(
    result.actions.some((action) => action.name === "Icerazor's Ire" && action.inferred),
    true
  );
  assert.equal(
    result.actions.some((action) => action.name === "Darkrazor's Daring" && action.inferred),
    true
  );
  assert.equal(
    result.rotation.some((command) => command.name === '__wait' && command.waitMs === 520),
    true
  );
  assert.deepEqual(
    result.actions
      .filter((action) => ["Phantom's Onslaught", 'Deathstrike'].includes(action.name))
      .map((action) => [action.name, action.durationMs]),
    [
      ["Phantom's Onslaught", 440],
      ['Deathstrike', 720]
    ]
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Mist Swing'),
    true
  );
  assert.equal(
    result.actions.some((action) => action.name === 'Relinquish Power'),
    false
  );
});

test('recovers Herald facet and Shortbow precasts without importing automatic legend calls', () => {
  const report = reportFixture(
    'Herald',
    [
      { id: 41829, skills: [{ castTime: -440, duration: 440, timeGained: 0 }] },
      { id: 27162, skills: [{ castTime: 0, duration: 480, timeGained: 0 }] },
      { id: 28113, skills: [{ castTime: 480, duration: 840, timeGained: 0 }] },
      { id: 28494, skills: [{ castTime: 680, duration: 0, timeGained: 0 }] },
      { id: 46856, skills: [{ castTime: 682, duration: 0, timeGained: 0 }] },
      { id: 28287, skills: [{ castTime: 1_320, duration: 440, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 1_760, duration: 0, timeGained: 0 }] },
      { id: 27066, skills: [{ castTime: 2_000, duration: 360, timeGained: 0 }] },
      { id: 28409, skills: [{ castTime: 2_360, duration: 560, timeGained: 0 }] },
      { id: 26730, skills: [{ castTime: 2_920, duration: 360, timeGained: 0 }] },
      { id: 26666, skills: [{ castTime: 3_280, duration: 520, timeGained: 0 }] },
      { id: 28085, skills: [{ castTime: 11_000, duration: 0, timeGained: 0 }] },
      { id: 46857, skills: [{ castTime: 11_000, duration: 0, timeGained: 0 }] },
      { id: 27014, skills: [{ castTime: 11_100, duration: 0, timeGained: 0 }] },
      { id: 27162, skills: [{ castTime: 11_200, duration: 480, timeGained: 0 }] },
      { id: 26644, skills: [{ castTime: 11_300, duration: 0, timeGained: 0 }] },
      { id: 28113, skills: [{ castTime: 11_680, duration: 840, timeGained: 0 }] },
      { id: 43993, skills: [{ castTime: 13_000, duration: 400, timeGained: 0 }] },
      { id: 41829, skills: [{ castTime: 13_400, duration: 440, timeGained: 0 }] }
    ],
    {
      s41829: { name: 'Sevenshot' },
      s27162: { name: 'Elemental Blast' },
      s28113: { name: 'Burst of Strength' },
      s28494: { name: 'Legendary Demon Stance', isInstantCast: true },
      s46856: { name: 'Call of the Demon', isInstantCast: true, isNotAccurate: true },
      s28287: { name: 'Embrace the Darkness' },
      's-2': { name: 'Weapon Swap', isSwap: true },
      s27066: { name: 'Misery Swipe', autoAttack: true },
      s28409: { name: 'Temporal Rift' },
      s26730: { name: 'Anguish Swipe', autoAttack: true },
      s26666: { name: 'Manifest Toxin', autoAttack: true },
      s28085: { name: 'Legendary Dragon Stance', isInstantCast: true },
      s46857: { name: 'Call of the Dragon', isInstantCast: true, isNotAccurate: true },
      s27014: { name: 'Facet of Elements', isInstantCast: true },
      s26644: { name: 'Facet of Strength', isInstantCast: true },
      s43993: { name: 'Spiritcrush' }
    }
  );
  const catalog = {
    skills: [
      skill(41829, 'Sevenshot', { type: 'weapon', weapon: 'Shortbow', quicknessCastTimeMs: 440 }),
      skill(27014, 'Facet of Elements', { castTimeMs: 0, handlerId: 'revenant.upkeep' }),
      skill(27162, 'Elemental Blast', { quicknessCastTimeMs: 480, handlerId: 'revenant.facet-consume' }),
      skill(26644, 'Facet of Strength', { castTimeMs: 0, handlerId: 'revenant.upkeep' }),
      skill(28113, 'Burst of Strength', { quicknessCastTimeMs: 840, handlerId: 'revenant.facet-consume' }),
      skill(28287, 'Embrace the Darkness', { quicknessCastTimeMs: 440, handlerId: 'revenant.upkeep' }),
      skill(27066, 'Misery Swipe', {
        type: 'weapon',
        weapon: 'Mace',
        slot: 'weapon_1',
        chainRoot: 27066,
        nextChainId: 26730,
        quicknessCastTimeMs: 360
      }),
      skill(26730, 'Anguish Swipe', {
        type: 'weapon',
        weapon: 'Mace',
        slot: 'weapon_1',
        chainRoot: 27066,
        nextChainId: 26666,
        quicknessCastTimeMs: 360
      }),
      skill(26666, 'Manifest Toxin', {
        type: 'weapon',
        weapon: 'Mace',
        slot: 'weapon_1',
        chainRoot: 27066,
        quicknessCastTimeMs: 520
      }),
      skill(28409, 'Temporal Rift', { type: 'weapon', weapon: 'Axe', quicknessCastTimeMs: 560 }),
      skill(43993, 'Spiritcrush', { type: 'weapon', weapon: 'Shortbow', castTimeMs: 400 }),
      skill(-3, 'Swap Weapons', { castTimeMs: 0 }),
      skill(-4, 'Swap Legends', { castTimeMs: 0, handlerId: 'revenant.legend-swap' })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  for (const name of ['Facet of Elements', 'Facet of Strength', 'Spiritcrush']) {
    assert.equal(
      result.rotation.some((command) => command.name === name),
      true
    );
  }

  assert.equal(
    result.actions.some((action) => /^Call of the /.test(action.name)),
    false
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Facet of Elements.*Facet of Strength.*Spiritcrush/);
});

test('normalizes Power Herald split weapon animations and automatic upkeep releases', () => {
  const report = reportFixture(
    'Herald',
    [
      { id: 27074, skills: [{ castTime: 1_000, duration: 360, timeGained: 0 }] },
      { id: 28625, skills: [{ castTime: 1_360, duration: 360, timeGained: 0 }] },
      { id: 28382, skills: [{ castTime: 2_000, duration: 0, timeGained: 0 }] },
      { id: 28085, skills: [{ castTime: 2_001, duration: 0, timeGained: 0 }] },
      { id: 62895, skills: [{ castTime: 3_000, duration: 40, timeGained: 0 }] },
      { id: 62713, skills: [{ castTime: 3_040, duration: 400, timeGained: 0 }] }
    ],
    {
      s27074: { name: 'Deathstrike' },
      s28625: { name: 'Deathstrike' },
      s28382: { name: 'Relinquish Power', isInstantCast: true },
      s28085: { name: 'Legendary Dragon Stance', isInstantCast: true },
      s62895: { name: "Phantom's Onslaught" },
      s62713: { name: "Phantom's Onslaught (Hit)" }
    }
  );
  const catalog = {
    skills: [
      skill(27074, 'Deathstrike', { type: 'weapon', weapon: 'Sword', quicknessCastTimeMs: 720 }),
      skill(28625, 'Deathstrike', { type: 'weapon', weapon: 'Sword', castTimeMs: 0 }),
      skill(28382, 'Relinquish Power', { castTimeMs: 0, handlerId: 'revenant.upkeep-release' }),
      skill(-4, 'Swap Legends', { castTimeMs: 0, handlerId: 'revenant.legend-swap' }),
      skill(62895, "Phantom's Onslaught", {
        type: 'weapon',
        weapon: 'Greatsword',
        quicknessCastTimeMs: 440
      }),
      skill(62713, "Phantom's Onslaught", {
        type: 'weapon',
        weapon: 'Greatsword',
        quicknessCastTimeMs: 440
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  assert.equal(result.actions.find((action) => action.name === 'Deathstrike')?.durationMs, 720);
  assert.equal(result.actions.find((action) => action.name === "Phantom's Onslaught")?.durationMs, 440);
  assert.equal(
    result.actions.some((action) => action.name === 'Relinquish Power'),
    false
  );
});

test('recovers evidence-backed Conduit state and collapses composite animations into player inputs', () => {
  const report = reportFixture(
    'Conduit',
    [
      { id: 27074, skills: [{ castTime: -37, duration: 358, timeGained: 0 }] },
      { id: 28625, skills: [{ castTime: 321, duration: 359, timeGained: 0 }] },
      { id: 28382, skills: [{ castTime: 2_042, duration: 0, timeGained: 0 }] },
      { id: 76610, skills: [{ castTime: 2_043, duration: 0, timeGained: 0 }] },
      { id: 76968, skills: [{ castTime: 2_200, duration: 920, timeGained: 0 }] },
      { id: 77141, skills: [{ castTime: 3_120, duration: 320, timeGained: 0 }] },
      { id: 77116, skills: [{ castTime: 3_120, duration: 0, timeGained: 0 }] },
      { id: 77047, skills: [{ castTime: 3_440, duration: 240, timeGained: 0 }] },
      { id: 76818, skills: [{ castTime: 3_680, duration: 0, timeGained: 0 }] },
      { id: 29057, skills: [{ castTime: 4_000, duration: 360, timeGained: 0 }] },
      { id: 29256, skills: [{ castTime: 4_360, duration: 560, timeGained: 0 }] },
      { id: 77047, skills: [{ castTime: 4_920, duration: 240, timeGained: 0 }] },
      { id: 29057, skills: [{ castTime: 5_160, duration: 360, timeGained: 0 }] },
      { id: 29256, skills: [{ castTime: 5_520, duration: 560, timeGained: 0 }] },
      { id: 28964, skills: [{ castTime: 6_080, duration: 480, timeGained: 0 }] },
      { id: 28134, skills: [{ castTime: 8_000, duration: 0, timeGained: 0 }] },
      { id: 27107, skills: [{ castTime: 8_100, duration: 0, timeGained: 0 }] },
      { id: 62929, skills: [{ castTime: 14_000, duration: 850, timeGained: 0 }] },
      { id: 77371, skills: [{ castTime: 14_560, duration: 0, timeGained: 0 }] },
      { id: 62895, skills: [{ castTime: 15_000, duration: 44, timeGained: 0 }] },
      { id: 62713, skills: [{ castTime: 15_044, duration: 394, timeGained: 0 }] }
    ],
    {
      s27074: { name: 'Deathstrike' },
      s28625: { name: 'Deathstrike' },
      s28382: { name: 'Relinquish Power', isInstantCast: true },
      s76610: { name: 'Legendary Entity Stance', isInstantCast: true },
      s76968: { name: 'Twin Moon Sweep' },
      s77141: { name: 'Beguiling Haze' },
      s77116: { name: 'Form of the Dervish (Attack - Elite)', isInstantCast: true },
      s77047: { name: 'Beguiling Haze' },
      s76818: { name: 'Form of the Dervish (Attack)', isInstantCast: true },
      s29057: { name: 'Preparation Thrust', autoAttack: true },
      s29256: { name: 'Brutal Blade', autoAttack: true },
      s28964: { name: 'Rift Slash', autoAttack: true },
      s28134: { name: 'Legendary Assassin Stance', isInstantCast: true },
      s27107: { name: 'Impossible Odds', isInstantCast: true },
      s62929: { name: "Eternity's Requiem" },
      s77371: { name: 'Cosmic Wisdom', isInstantCast: true },
      s62895: { name: "Phantom's Onslaught" },
      s62713: { name: "Phantom's Onslaught (Hit)" }
    }
  );
  const catalog = {
    skills: [
      skill(-3, 'Swap Weapons', { castTimeMs: 0 }),
      skill(-4, 'Swap Legends', { castTimeMs: 0, handlerId: 'revenant.legend-swap' }),
      skill(27107, 'Impossible Odds', { castTimeMs: 0, handlerId: 'revenant.upkeep' }),
      skill(62929, "Eternity's Requiem", { type: 'weapon', weapon: 'Greatsword', quicknessCastTimeMs: 850 }),
      skill(77371, 'Cosmic Wisdom', { castTimeMs: 0 }),
      skill(27074, 'Deathstrike', { type: 'weapon', weapon: 'Sword', quicknessCastTimeMs: 720 }),
      skill(28625, 'Deathstrike', { type: 'weapon', weapon: 'Sword', castTimeMs: 0 }),
      skill(28382, 'Relinquish Power', { castTimeMs: 0, handlerId: 'revenant.upkeep-release' }),
      skill(76968, 'Twin Moon Sweep', { quicknessCastTimeMs: 920 }),
      skill(77141, 'Beguiling Haze', { castTimeMs: 250 }),
      skill(77116, 'Form of the Dervish (Attack - Elite)', { castTimeMs: 0 }),
      skill(76818, 'Form of the Dervish (Attack)', { castTimeMs: 0 }),
      skill(29057, 'Preparation Thrust', {
        type: 'weapon',
        weapon: 'Sword',
        slot: 'weapon_1',
        chainRoot: 29057,
        nextChainId: 29256,
        quicknessCastTimeMs: 360
      }),
      skill(29256, 'Brutal Blade', {
        type: 'weapon',
        weapon: 'Sword',
        slot: 'weapon_1',
        chainRoot: 29057,
        nextChainId: 28964,
        quicknessCastTimeMs: 560
      }),
      skill(28964, 'Rift Slash', {
        type: 'weapon',
        weapon: 'Sword',
        slot: 'weapon_1',
        chainRoot: 29057,
        quicknessCastTimeMs: 480
      }),
      skill(62895, "Phantom's Onslaught", {
        type: 'weapon',
        weapon: 'Greatsword',
        quicknessCastTimeMs: 438
      }),
      skill(62713, "Phantom's Onslaught", {
        type: 'weapon',
        weapon: 'Greatsword',
        quicknessCastTimeMs: 438
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog, {
    professionConfig: {
      selectedLegends: ['LegendaryAssassin', 'LegendaryEntity'],
      startingLegend: 'LegendaryEntity'
    }
  });

  assert.equal(
    result.rotation.some((command) => command.name === 'Swap Legends'),
    true
  );
  assert.equal(
    result.rotation.some((command) => command.name === 'Impossible Odds'),
    true
  );
  assert.equal(result.rotation.find((command) => command.name === '__combat_start')?.offset, 37);
  assert.equal(result.actions.filter((action) => action.name === 'Deathstrike').length, 1);
  assert.equal(result.actions.filter((action) => action.name === "Phantom's Onslaught").length, 1);
  assert.equal(
    result.actions.some((action) => [28382, 76818, 77116, 77141].includes(action.rawSkillId)),
    false
  );
  assert.match(result.warnings.join('\n'), /Recovered setup:.*Swap Legends.*Impossible Odds/);
  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});

test('recovers Conduit opening state from dependencies without assuming one benchmark opener', () => {
  const report = reportFixture(
    'Conduit',
    [
      { id: 29057, skills: [{ castTime: 1_337, duration: 360, timeGained: 0 }] },
      { id: 28382, skills: [{ castTime: 4_996, duration: 0, timeGained: 0 }] },
      { id: 76610, skills: [{ castTime: 5_000, duration: 0, timeGained: 0 }] }
    ],
    {
      s29057: { name: 'Preparation Thrust', autoAttack: true },
      s28382: { name: 'Relinquish Power', isInstantCast: true },
      s76610: { name: 'Legendary Entity Stance', isInstantCast: true }
    }
  );
  const catalog = {
    skills: [
      skill(-4, 'Swap Legends', { castTimeMs: 0, cooldown: 10, handlerId: 'revenant.legend-swap' }),
      skill(27107, 'Impossible Odds', { castTimeMs: 0, handlerId: 'revenant.upkeep' }),
      skill(28382, 'Relinquish Power', { castTimeMs: 0, handlerId: 'revenant.upkeep-release' }),
      skill(29057, 'Preparation Thrust', {
        type: 'weapon',
        weapon: 'Sword',
        slot: 'weapon_1',
        chainRoot: 29057,
        quicknessCastTimeMs: 360
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog, {
    professionConfig: {
      selectedLegends: ['LegendaryAssassin', 'LegendaryEntity'],
      startingLegend: 'LegendaryEntity'
    }
  });

  assert.equal(result.rotation.filter((command) => command.name === 'Swap Legends').length, 2);
  assert.equal(
    result.rotation.some((command) => command.name === 'Impossible Odds'),
    true
  );
  assert.equal(
    result.rotation.some((command) => ["Eternity's Requiem", 'Cosmic Wisdom', 'Swap Weapons'].includes(command.name)),
    false
  );

  const assassinStart = reconstructDpsReportRotation(report, catalog, {
    professionConfig: {
      selectedLegends: ['LegendaryAssassin', 'LegendaryEntity'],
      startingLegend: 'LegendaryAssassin'
    }
  });

  assert.equal(assassinStart.rotation.filter((command) => command.name === 'Swap Legends').length, 1);
  assert.equal(
    assassinStart.rotation.some((command) => command.name === 'Impossible Odds'),
    true
  );
});

test('maps Conduit Cosmic Wisdom variants and split Mace animations to player inputs', () => {
  const report = reportFixture(
    'Conduit',
    [
      { id: 78191, skills: [{ castTime: 0, duration: 440, timeGained: 0 }] },
      { id: 78587, skills: [{ castTime: 440, duration: 440, timeGained: 0 }] },
      { id: 78203, skills: [{ castTime: 880, duration: 800, timeGained: 0 }] },
      { id: 78351, skills: [{ castTime: 1680, duration: 920, timeGained: 0 }] },
      { id: 28029, skills: [{ castTime: 2600, duration: 320, timeGained: 0 }] },
      { id: 26923, skills: [{ castTime: 2920, duration: 640, timeGained: 0 }] }
    ],
    {
      s78191: { name: 'Embrace the Darkness (Cosmic Wisdom)' },
      s78587: { name: 'Banish Enchantment (Cosmic Wisdom)' },
      s78203: { name: 'Call to Anguish (Cosmic Wisdom)' },
      s78351: { name: 'Unyielding Impact (Cosmic Wisdom)' },
      s28029: { name: 'Frigid Blitz' },
      s26923: { name: 'Frigid Blitz' }
    }
  );
  const catalog = {
    skills: [
      skill(28287, 'Embrace the Darkness', { type: 'elite', quicknessCastTimeMs: 440 }),
      skill(27505, 'Banish Enchantment', { type: 'utility', quicknessCastTimeMs: 440 }),
      skill(27917, 'Call to Anguish', { type: 'utility', quicknessCastTimeMs: 800 }),
      skill(76503, 'Unyielding Impact', { type: 'utility', quicknessCastTimeMs: 920 }),
      skill(28029, 'Frigid Blitz', { type: 'weapon', quicknessCastTimeMs: 960 })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);

  for (const [name, skillId] of [
    ['Embrace the Darkness', 28287],
    ['Banish Enchantment', 27505],
    ['Call to Anguish', 27917],
    ['Unyielding Impact', 76503],
    ['Frigid Blitz', 28029]
  ]) {
    assert.equal(result.actions.find((action) => action.name === name)?.skillId, skillId);
  }

  assert.doesNotMatch(result.warnings.join('\n'), /Needs review/);
});
