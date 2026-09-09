import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
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

test('preserves standalone autoattack identity and shortened timing with localized report names', () => {
  // Hammer Bolt has no chain; its numeric identity must survive without an English name fallback.
  for (const duration of [560, 480]) {
    const report = reportFixture(
      'Renegade',
      [{ id: 28549, skills: [{ castTime: 1000, duration, timeGained: 560 - duration }] }],
      { s28549: { name: '巨锤飞矢', autoAttack: true } },
      2000
    );
    const result = reconstructDpsReportRotation(report, revenantCatalog);
    const action = result.actions.find((entry) => entry.rawSkillId === 28549);
    assert.ok(action?.supportedByCatalog);
    assert.equal(action.skillId, 28549);
    const command = result.rotation.find((entry) => entry.skillId === 28549);
    assert.ok(command);
    assert.equal(command.name, 'Hammer Bolt');
    assert.equal(command.interruptMs, duration < 560 ? duration : undefined);
  }
});

test('rounds imported legend swap offsets to the nearest 40 ms relative to the preceding cast', () => {
  // Legend swaps can overlap a weapon cast; replay offsets use action ticks while evidence keeps its timestamp.
  for (const [offset, expected] of [
    [219, 200],
    [220, 240],
    [221, 240]
  ]) {
    const report = reportFixture(
      'Renegade',
      [
        { id: 28549, skills: [{ castTime: 101, duration: 560, timeGained: 0 }] },
        { id: 28134, skills: [{ castTime: 101 + offset, duration: 0, timeGained: 0 }] }
      ],
      { s28549: { name: 'Hammer Bolt' }, s28134: { name: 'Legendary Assassin Stance', isInstantCast: true } },
      1000
    );
    const result = reconstructDpsReportRotation(report, revenantCatalog);
    assert.equal(result.rotation.find((command) => command.name === 'Swap Legends')?.offset, expected);
    assert.equal(result.actions.find((action) => action.name === 'Swap Legends')?.timestampMs, 101 + offset);
  }
});

test('preserves cancelled Hammer Bolt inputs and a following 40 ms idle gap', () => {
  // A cancelled attack occupies the cast lane; its separate idle gap must not be lost or counted twice.
  const report = reportFixture(
    'Renegade',
    [
      {
        id: 28549,
        skills: [
          { castTime: 0, duration: 560, timeGained: 0 },
          { castTime: 560, duration: 43, timeGained: -43 },
          { castTime: 643, duration: 560, timeGained: 0 }
        ]
      }
    ],
    { s28549: { name: '巨锤飞矢', autoAttack: true } },
    1500
  );
  const result = reconstructDpsReportRotation(report, revenantCatalog);
  assert.deepEqual(result.rotation, [
    { name: '__combat_start' },
    { name: 'Hammer Bolt', skillId: 28549 },
    { name: 'Hammer Bolt', skillId: 28549, interruptMs: 40 },
    { name: '__wait', waitMs: 40 },
    { name: 'Hammer Bolt', skillId: 28549 }
  ]);
});

test('enhanced Icerazor leaves the overlapping cast lane and following idle gap intact', () => {
  // The enhanced ID proves a zero-duration summon even when the report uses a localized name.
  for (const name of ["Icerazor's Ire", '凛刃怒气']) {
    const report = reportFixture(
      'Renegade',
      [
        { id: 27665, skills: [{ castTime: 0, duration: 600, timeGained: 0 }] },
        { id: 72359, skills: [{ castTime: 520, duration: 0, timeGained: 0 }] },
        { id: 28549, skills: [{ castTime: 640, duration: 560, timeGained: 0 }] }
      ],
      { s27665: { name: 'Field of the Mists' }, s72359: { name }, s28549: { name: 'Hammer Bolt' } },
      1500
    );
    const result = reconstructDpsReportRotation(report, revenantCatalog);
    assert.deepEqual(result.rotation, [
      { name: '__combat_start' },
      { name: 'Field of the Mists', skillId: 27665 },
      { name: "Icerazor's Ire", skillId: 40485, offset: 520 },
      { name: '__wait', waitMs: 40 },
      { name: 'Hammer Bolt', skillId: 28549 }
    ]);
  }
});

test('a weapon swap during Daredevil dodge does not fabricate an interrupted dodge', () => {
  const report = reportFixture(
    'Daredevil',
    [
      { id: 23275, skills: [{ castTime: 0, duration: 800, timeGained: 0 }] },
      { id: -2, skills: [{ castTime: 40, duration: 0, timeGained: 0 }] }
    ],
    { s23275: { name: 'Dodge' }, 's-2': { name: 'Weapon Swap', isSwap: true } },
    1000
  );
  // A swap inside the movement animation must preserve the completed dodge's commit.
  const result = reconstructDpsReportRotation(report, thiefCatalog);
  const dodge = result.rotation.find((command) => command.name === 'Dodge');
  assert.ok(dodge);
  assert.equal(dodge.interruptMs, undefined);
});

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
    [200, 240]
  );
  // Spear's flip skill is a player input and must survive generic report reconstruction.
  assert.equal(reconstruction.rotation.filter((command) => command.name === 'Mental Collapse').length, 1);
  assert.equal(
    reconstruction.actions.every((action) => action.supportedByCatalog),
    true
  );
  assert.deepEqual(simulation.warnings, []);
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

for (const timeGained of [200, -200]) {
  test(`Luminary keeps the pending chain step after a shortened cast with timeGained ${timeGained}`, () => {
    const report = reportFixture(
      'Luminary',
      [
        { id: 90_001, skills: [{ castTime: 0, duration: 200, timeGained }] },
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
}

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

test('preserves the rounded opening cast duration across an offset combat marker', () => {
  const report = reportFixture(
    'Luminary',
    [
      { id: 73_132, skills: [{ castTime: -355, duration: 436, timeGained: 0 }] },
      { id: 72_940, skills: [{ castTime: 81, duration: 440, timeGained: 0 }] }
    ],
    { s73132: { name: 'Symbol of Luminance' }, s72940: { name: 'Helio Rush' } },
    1_000
  );
  const result = reconstructDpsReportRotation(report, guardianCatalog);
  const simulation = simulateGw2({
    profession: guardianProfession,
    rotation: result.rotation,
    config: defaultSimulationConfig({ specialization: 'Luminary', primaryWeapon: 'Spear' })
  });
  const symbol = simulation.steps.find((step) => step.skillId === 73_132);
  const nextCast = simulation.steps.find((step) => step.skillId === 72_940);
  const combatStart = simulation.steps.find((step) => step.skill === 'Combat Start');

  // Combat begins inside the precast; its offset must neither truncate the cast nor release the next input early.
  assert.equal(result.actions.find((action) => action.skillId === 73_132).durationMs, 436);
  assert.equal(symbol.end - symbol.start, 440);
  assert.equal(symbol.interrupted, false);
  assert.equal(combatStart.start - symbol.start, 360);
  assert.equal(nextCast.start, symbol.end);
  assert.ok(
    simulation.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Symbol of Luminance — Initial')
  );
  assert.deepEqual(simulation.warnings, []);
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
