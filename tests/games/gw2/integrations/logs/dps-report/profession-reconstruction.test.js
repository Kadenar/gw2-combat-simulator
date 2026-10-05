import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDpsReport } from '#gw2/integrations/logs/dps-report/parser.js';
import { reconstructDpsReportRotation } from '#gw2/integrations/logs/dps-report/rotation/index.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/profession.js';
import { MESMER_TRAIT_IDS as MESMER_TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { warriorCatalog } from '#gw2/professions/warrior/profession.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

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

test('Mirage cloak sources import once without spending endurance or applying Dune Cloak twice', () => {
  // A minimal shatter proves both the resource contract and the cooldown effect of a single cloak application.
  const report = reportFixture(
    'Mirage',
    [
      { id: -17, skills: [{ castTime: 0, duration: 0 }] },
      { id: 10191, skills: [{ castTime: 0, duration: 0 }] }
    ],
    { 's-17': { name: 'Mirage Cloak' }, s10191: { name: 'Mind Wrack' } }
  );
  const imported = reconstructDpsReportRotation(report, mesmerCatalog);
  const config = { specialization: 'Mirage', initialResource: 3, selectedTraitIds: [MESMER_TRAIT.DUNE_CLOAK] };
  const actual = simulateMesmer(imported.rotation, config);
  const expected = simulateMesmer(['__combat_start', 'Mind Wrack'], config);
  assert.deepEqual(actual.warnings, []);
  assert.equal(actual.planningState.profession.endurance.value, 100);
  assert.equal(actual.planningState.profession.availableAmbush.source, 'Dune Cloak');
  assert.deepEqual(actual.planningState.cooldowns, expected.planningState.cooldowns);
  assert.ok(imported.sourceActions.some((action) => action.rawSkillId === -17));
});

test('Mirage source matching uses numeric identity and the strict server window for every represented provider', () => {
  // Report group order and localized names must not turn a represented source into another input.
  for (const sourceId of [10190, 10191, 49068, -63, 10192, 10287, 43064, 45046]) {
    for (const offset of [-10, -9, 0, 9, 10]) {
      const report = reportFixture(
        'Mirage',
        [
          { id: -17, skills: [{ castTime: 100, duration: 0 }] },
          { id: sourceId, skills: [{ castTime: 100 + offset, duration: 0 }] }
        ],
        { 's-17': { name: 'Localized cloak' }, [`s${sourceId}`]: { name: 'Localized source' } }
      );
      const imported = reconstructDpsReportRotation(report, mesmerCatalog);
      assert.equal(
        imported.actions.some((action) => action.rawSkillId === -17),
        Math.abs(offset) === 10
      );
      assert.ok(imported.sourceActions.some((action) => action.rawSkillId === -17));
    }
  }
});

test('Guardian sword animation segments import as one activation without merging an unpaired follow-up', () => {
  // Weaponmaster and Willbender imports share the same composite; missing opener evidence stays unmodified.
  for (const profession of ['Guardian', 'Willbender']) {
    const report = reportFixture(
      profession,
      [
        { id: 62525, skills: [{ castTime: 100, duration: 300, timeGained: 0 }] },
        {
          id: 62656,
          skills: [
            { castTime: 400, duration: 500, timeGained: 0 },
            { castTime: 10000, duration: 500, timeGained: 0 }
          ]
        }
      ],
      {
        s62525: { name: "Executioner's Calling" },
        s62656: { name: "Executioner's Calling (Dual Strike)" }
      }
    );
    const result = reconstructDpsReportRotation(report, guardianCatalog);
    assert.deepEqual(
      result.actions.map((action) => action.rawSkillId),
      [62525, 62656]
    );
  }
});

test('Firebrand bundle transitions preserve ongoing casts and real weapon swaps', () => {
  // Tome entry and stow signal bar changes, not animation cancellation or a weapon cooldown.
  const report = reportFixture(
    'Firebrand',
    [
      { id: 40624, skills: [{ castTime: 0, duration: 800 }] },
      { id: 44364, skills: [{ castTime: 300, duration: 0 }] },
      { id: 42898, skills: [{ castTime: 800, duration: 880 }] },
      { id: 41380, skills: [{ castTime: 1100, duration: 0 }] },
      { id: -2, skills: [301, 1101, 2000].map((castTime) => ({ castTime, duration: 0 })) }
    ],
    {
      s40624: { name: 'Symbol of Vengeance' },
      s44364: { name: 'Tome of Justice' },
      s42898: { name: 'Epilogue: Ashes of the Just' },
      s41380: { name: 'Stow Tome' },
      's-2': { name: 'Weapon Swap', isSwap: true }
    }
  );
  const result = reconstructDpsReportRotation(report, guardianCatalog);
  assert.deepEqual(
    result.actions.filter((a) => a.kind === 'weapon-swap').map((a) => a.timestampMs),
    [2000]
  );
  assert.ok(result.sourceActions.some((a) => a.rawSkillId === -2 && a.startMs === 301));
  const sim = simulateGw2({
    profession: guardianProfession,
    rotation: result.rotation,
    config: {
      ...defaultSimulationConfig(),
      specialization: 'Firebrand',
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch'
    }
  });
  assert.deepEqual(sim.warnings, []);
  assert.equal(sim.planningState.profession.activeTome, '');
});

for (const [profession, catalog, entryId, exitId] of [
  ['Necromancer', necromancerCatalog, 10574, 10585],
  ['Reaper', necromancerCatalog, 30792, 30961],
  ['Harbinger', necromancerCatalog, 62567, 62540],
  ['Ritualist', necromancerCatalog, 77238, 76933],
  ['Specter', thiefCatalog, 63155, 63251]
]) {
  test(`${profession} shroud transitions survive swap metadata without importing duplicate bar changes`, () => {
    // Shroud changes emit a swap row one millisecond later; only the independent weapon swap is player input.
    const report = reportFixture(
      profession,
      [
        { id: -2, skills: [879, 2399, 15318].map((castTime) => ({ castTime, duration: 0 })) },
        { id: entryId, skills: [{ castTime: 2398, duration: 0 }] },
        { id: exitId, skills: [{ castTime: 15317, duration: 0 }] }
      ],
      {
        's-2': { name: 'Weapon Swap', isSwap: true },
        [`s${entryId}`]: { name: catalog.skillsById.get(entryId).name, isSwap: true },
        [`s${exitId}`]: { name: catalog.skillsById.get(exitId).name, isSwap: true }
      }
    );

    const result = reconstructDpsReportRotation(report, catalog);

    assert.deepEqual(
      result.actions.filter((action) => action.kind === 'weapon-swap').map((action) => action.timestampMs),
      [879]
    );
    assert.deepEqual(
      result.actions.filter((action) => action.name.includes('Shroud')).map((action) => action.timestampMs),
      [2398, 15317]
    );
    assert.ok(result.rotation.some((command) => command.skillId === entryId));
    assert.ok(result.rotation.some((command) => command.skillId === exitId));
  });
}

// Only cancelled autoattacks adjacent to the closed shroud bar are duplicate exit signals.
test('Reaper import removes cancelled exit autoattacks while retaining independent cast evidence', () => {
  for (const [offset, timeGained, retained] of [
    [2, -120, false],
    [6, -120, true],
    [2, 0, true]
  ]) {
    const report = reportFixture(
      'Reaper',
      [
        { id: 30792, skills: [{ castTime: 0, duration: 0 }] },
        { id: 30961, skills: [{ castTime: 1000, duration: 0 }] },
        { id: 29442, skills: [{ castTime: 1000 + offset, duration: 120, timeGained }] },
        { id: 73007, skills: [{ castTime: 1200, duration: 840 }] }
      ],
      {
        s30792: { name: "Reaper's Shroud", isSwap: true },
        s30961: { name: "Exit Reaper's Shroud", isSwap: true },
        s29442: { name: 'Life Rend' },
        s73007: { name: 'Extirpate' }
      }
    );
    const result = reconstructDpsReportRotation(report, necromancerCatalog);
    assert.equal(
      result.actions.some((action) => action.rawSkillId === 29442),
      retained
    );
    assert.ok(result.sourceActions.some((action) => action.rawSkillId === 29442));
    if (!retained) assert.ok(result.rotation.some((command) => command.type === 'wait' && command.durationMs === 200));
  }
});

test('Bladesworn Gunsaber transitions omit EI swaps and Dragon Trigger charge waits', () => {
  // Gunsaber bar changes are represented by their own inputs, while Dragon Slash owns its charge delay in simulation.
  const report = reportFixture(
    'Bladesworn',
    [
      { id: 62745, skills: [{ castTime: 0, duration: 0 }] },
      { id: 62803, skills: [{ castTime: 1, duration: 2480 }] },
      { id: 62797, skills: [{ castTime: 2481, duration: 1040 }] },
      { id: 62861, skills: [{ castTime: 3521, duration: 0 }] },
      { id: -2, skills: [1, 3522, 5000].map((castTime) => ({ castTime, duration: 0 })) }
    ],
    {
      s62745: { name: 'Unsheathe Gunsaber' },
      s62803: { name: 'Dragon Trigger' },
      s62797: { name: 'Dragon Slash—Force' },
      s62861: { name: 'Sheathe Gunsaber' },
      's-2': { name: 'Weapon Swap', isSwap: true }
    }
  );

  const result = reconstructDpsReportRotation(report, warriorCatalog);

  assert.equal(
    result.rotation.some((command) => command.skillId === 62745),
    false
  );
  assert.deepEqual(
    result.actions.filter((action) => action.kind === 'weapon-swap').map((action) => action.timestampMs),
    [5000]
  );
  const triggerIndex = result.rotation.findIndex((command) => command.skillId === 62803);
  assert.equal(result.rotation[triggerIndex + 1].releaseAtCharges, 10);
  assert.equal(result.rotation[triggerIndex + 1].skillId, warriorCatalog.skillsByName.get('Dragon Slash—Force').id);
});

test('Firebrand resolves complete Solace charge bursts while preserving ambiguous sparse casts', () => {
  const report = reportFixture(
    'Firebrand',
    [{ id: -20, skills: [100, 1100, 2100, 25000, 26000].map((castTime) => ({ castTime, duration: 0 })) }],
    { 's-20': { name: 'Restoring Reprieve or Rejunevating Respite', isInstantCast: true } }
  );
  const result = reconstructDpsReportRotation(report, guardianCatalog);
  assert.deepEqual(
    result.actions.map((action) => action.skillId),
    [41475, 41475, 42960, 41475, -20]
  );
  assert.ok(result.actions.every((action) => action.rawSkillId === -20));
  assert.ok(result.sourceActions.every((action) => action.rawSkillId === -20));
});

test('Firebrand does not infer final Solace charges across possible recharge or conflicting casts', () => {
  for (const [castTimes, expected] of [
    [
      [100, 1100, 9000],
      [41475, 41475, 41475]
    ],
    [
      [100, 1100, 2100, 3100],
      [-20, -20, -20, -20]
    ]
  ]) {
    const report = reportFixture(
      'Firebrand',
      [{ id: -20, skills: castTimes.map((castTime) => ({ castTime, duration: 0 })) }],
      { 's-20': { name: 'Restoring Reprieve or Rejunevating Respite', isInstantCast: true } }
    );
    const result = reconstructDpsReportRotation(report, guardianCatalog);
    assert.deepEqual(
      result.actions.map((action) => action.skillId),
      expected
    );
  }
});

test('Firebrand accounts for sequential recovery before identifying a sparse mantra charge', () => {
  // Continuous Alacrity restores the third sequential charge between the final and normal activation cases.
  for (const [lastCast, expected] of [
    [23000, 42960],
    [25000, 41475],
    [31000, 41475]
  ]) {
    const report = reportFixture(
      'Firebrand',
      [{ id: -20, skills: [100, 2100, 9100, 18100, lastCast].map((castTime) => ({ castTime, duration: 0 })) }],
      { 's-20': { name: 'Restoring Reprieve or Rejunevating Respite', isInstantCast: true } }
    );
    const result = reconstructDpsReportRotation(report, guardianCatalog);
    assert.equal(result.actions.at(-1).skillId, expected);
    assert.ok(result.sourceActions.every((action) => action.rawSkillId === -20));
  }
});

test('Firebrand assumes continuous Alacrity for recovery regardless of source boon coverage', () => {
  // Missing or interrupted source Alacrity does not change the simulation import's recharge assumption.
  for (const states of [
    undefined,
    [
      [0, 0],
      [0, 1]
    ],
    [[500, 1]],
    [
      [0, 1],
      [5000, 0],
      [6000, 1]
    ],
    [
      [0, 1],
      [5000, 0]
    ]
  ]) {
    const report = reportFixture(
      'Firebrand',
      [{ id: -20, skills: [100, 2100, 9100, 18100, 25000].map((castTime) => ({ castTime, duration: 0 })) }],
      { 's-20': { name: 'Restoring Reprieve or Rejunevating Respite', isInstantCast: true } }
    );
    report.players[0].buffUptimes = [{ id: 30328, states, buffData: [{ uptime: 100 }] }];
    const result = reconstructDpsReportRotation(report, guardianCatalog);
    assert.equal(result.actions.at(-1).skillId, 41475);
    assert.equal(result.actions.at(-1).rawSkillId, -20);
  }
});

test('Firebrand resolves Potence bursts independently of sparse Solace recovery', () => {
  // Potence empties its pool while Solace preserves charges and recharges between uses.
  const report = reportFixture(
    'Firebrand',
    [
      { id: -22, skills: [100, 1100, 2100, 19100, 20100, 21100].map((castTime) => ({ castTime, duration: 0 })) },
      { id: -20, skills: [100, 9100, 18100, 29100, 38100].map((castTime) => ({ castTime, duration: 0 })) }
    ],
    {
      's-22': { name: 'Potent Haste or Overwhelming Celerity', isInstantCast: true },
      's-20': { name: 'Restoring Reprieve or Rejunevating Respite', isInstantCast: true }
    }
  );
  const result = reconstructDpsReportRotation(report, guardianCatalog);
  assert.deepEqual(
    result.actions.filter((action) => action.rawSkillId === -22).map((action) => action.skillId),
    [42983, 42983, 41988, 42983, 42983, 41988]
  );
  assert.ok(result.actions.filter((action) => action.rawSkillId === -20).every((action) => action.skillId === 41475));
  assert.ok(result.sourceActions.every((action) => [-20, -22].includes(action.rawSkillId)));
});

test('Firebrand retains an explicitly identified Solace charge instead of contradicting it', () => {
  const report = reportFixture(
    'Firebrand',
    [
      { id: 42960, skills: [{ castTime: 100, duration: 0 }] },
      { id: -20, skills: [1100, 2100].map((castTime) => ({ castTime, duration: 0 })) }
    ],
    {
      s42960: { name: 'Rejuvenating Respite', isInstantCast: true },
      's-20': { name: 'Restoring Reprieve or Rejunevating Respite', isInstantCast: true }
    }
  );
  const result = reconstructDpsReportRotation(report, guardianCatalog);
  assert.deepEqual(
    result.actions.map((action) => action.skillId),
    [42960, -20, -20]
  );
});

test('Guardian Jurisdiction charge and release consume one activation without inventing an absent charge', () => {
  const report = reportFixture(
    'Guardian',
    [
      { id: 71817, skills: [{ castTime: 100, duration: 480 }] },
      {
        id: 71818,
        skills: [
          { castTime: 580, duration: 320 },
          { castTime: 5000, duration: 320 }
        ]
      },
      { id: 71989, skills: [{ castTime: 740, duration: 0 }] }
    ],
    {
      s71817: { name: 'Jurisdiction' },
      s71818: { name: 'Fire Jurisdiction (Level 1)' },
      s71989: { name: 'Detonate Jurisdiction' }
    }
  );
  const result = reconstructDpsReportRotation(report, guardianCatalog);
  const charge = result.actions.find((a) => a.rawSkillId === 71817);
  assert.equal(charge.endTimestampMs, 900);
  assert.ok(result.sourceActions.some((a) => a.rawSkillId === 71989));
  assert.ok(!result.actions.some((a) => a.rawSkillId === 71989));
  assert.ok(result.actions.some((a) => a.rawSkillId === 71818 && a.timestampMs === 5000 && !a.supportedByCatalog));
});

test('Revenant import preserves an explicit follow-up without inventing its missing chain opener', () => {
  // An incomplete log must reach simulator validation instead of being rewritten into a valid opener.
  const report = reportFixture('Renegade', [{ id: 29256, skills: [{ castTime: 0, duration: 520, timeGained: 0 }] }], {
    s29256: { name: 'Brutal Blade' }
  });
  const imported = reconstructDpsReportRotation(report, revenantCatalog);
  const simulation = simulateGw2({
    profession: revenantProfession,
    rotation: imported.rotation,
    config: defaultSimulationConfig({ specialization: 'Renegade', primaryWeapon: 'Sword' })
  });

  assert.equal(imported.actions.at(-1).skillId, 29256);
  assert.equal(simulation.steps.at(-1).skillId, 29256);
  assert.equal(simulation.steps.at(-1).invalid, true);
  assert.match(simulation.warnings.join(' '), /Brutal Blade is unavailable — cast Preparation Thrust first/);
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
    assert.equal(result.rotation.find((command) => command.skillId === -4)?.concurrentOffsetMs, expected);
    assert.equal(result.actions.find((action) => action.name === 'Swap Legends')?.timestampMs, 101 + offset);
  }
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
      { type: 'combat-start' },
      { type: 'cast', skillId: 27665 },
      { type: 'cast', skillId: 40485, concurrentOffsetMs: 520 },
      { type: 'wait', durationMs: 40 },
      { type: 'cast', skillId: 28549 }
    ]);
  }
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
  const reconstruction = reconstructDpsReportRotation(report, mesmerCatalog);
  const powerSpikes = reconstruction.rotation.filter((command) => command.skillId === 10212);
  const simulation = simulateMesmer(
    reconstruction.rotation,
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [],
      selectedSkillIds: [10211, 45425],
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialResource: 5
    })
  );

  assert.equal(reconstruction.parserId, 'mesmer:virtuoso');
  assert.deepEqual(
    powerSpikes.map((command) => command.concurrentOffsetMs),
    [200, 240]
  );
  // Spear's flip skill is a player input and must survive generic report reconstruction.
  assert.equal(reconstruction.rotation.filter((command) => command.skillId === 72957).length, 1);
  assert.equal(
    reconstruction.actions.every((action) => action.supportedByCatalog),
    true
  );
  assert.deepEqual(simulation.warnings, []);
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
    skills: [skill(80_247, 'Rend', { type: 'weapon', slot: 'weapon_3', castTimeMs: 960 })]
  };

  const result = reconstructDpsReportRotation(report, catalog);
  const rend = result.actions.find((action) => action.name === 'Rend');

  assert.equal(rend?.rawSkillId, 80_247);
  assert.equal(rend?.durationMs, 960);
  assert.equal(result.rotation.filter((command) => command.skillId === 80_247).length, 1);
});

for (const timeGained of [200, -200]) {
  test(`Guardian import leaves chain validation to the simulator after a shortened cast with timeGained ${timeGained}`, () => {
    // Explicit follow-up evidence survives import even when the simulator rejects its cancelled prerequisite.
    const report = reportFixture(
      'Luminary',
      [
        { id: 9137, skills: [{ castTime: 0, duration: 80, timeGained }] },
        { id: 9138, skills: [{ castTime: 80, duration: 600, timeGained: 0 }] }
      ],
      { s9137: { name: 'Strike' }, s9138: { name: 'Vengeful Strike' } }
    );
    const imported = reconstructDpsReportRotation(report, guardianCatalog);
    const simulation = simulateGw2({
      profession: guardianProfession,
      rotation: imported.rotation,
      config: defaultSimulationConfig({ specialization: 'Luminary', primaryWeapon: 'Greatsword' })
    });

    assert.equal(imported.actions.at(-1).skillId, 9138);
    assert.ok(imported.rotation.some((command) => command.skillId === 9138));
    assert.equal(simulation.steps.at(-1).invalid, true);
    assert.match(simulation.warnings.join(' '), /Vengeful Strike is unavailable — cast Strike first/);
  });
}

test('Guardian imports recorded chain steps while the simulator handles intervening casts', () => {
  // A cancelled follow-up leaves the chain pending across a trap or cancelled leap; a landed leap resets it.
  for (const [interruptingId, duration, nextId] of [
    [30364, 440, 9138],
    [9080, 80, 9138],
    [9080, 720, 9137]
  ]) {
    const report = reportFixture(
      'Dragonhunter',
      [
        { id: 9137, skills: [{ castTime: 0, duration: 400, timeGained: 0 }] },
        { id: 9138, skills: [{ castTime: 400, duration: 80, timeGained: -520 }] },
        { id: interruptingId, skills: [{ castTime: 480, duration, timeGained: 0 }] },
        { id: nextId, skills: [{ castTime: 480 + duration, duration: 600, timeGained: 0 }] }
      ],
      Object.fromEntries(
        [9137, 9138, interruptingId].map((id) => [`s${id}`, { name: guardianCatalog.skillsById.get(id).name }])
      )
    );
    const imported = reconstructDpsReportRotation(report, guardianCatalog);
    const simulation = simulateGw2({
      profession: guardianProfession,
      rotation: imported.rotation,
      config: defaultSimulationConfig({ specialization: 'Dragonhunter', primaryWeapon: 'Greatsword' })
    });

    assert.equal(imported.actions.at(-1).skillId, nextId);
    assert.deepEqual(simulation.warnings, []);
    assert.equal(simulation.steps.at(-1).skillId, nextId);
    assert.equal(simulation.steps.at(-1).cancelledBeforeCommit, undefined);
  }
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
    { type: 'cast', skillId: 73_132 },
    { type: 'combat-start', concurrentOffsetMs: 360 }
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
      skill(28287, 'Embrace the Darkness', { castTimeMs: 440, upkeepCost: 6 }),
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
      // A release is identified by its upkeep flip parent.
      skill(26693, 'Resist the Darkness', { castTimeMs: 0, flipParentId: 28287 }),
      skill(41858, 'Legendary Renegade Stance', { castTimeMs: 0 }),
      skill(-4, 'Swap Legends', { castTimeMs: 0 })
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
      skill(27074, 'Deathstrike', { type: 'weapon', weapon: 'Sword', castTimeMs: 720 }),
      skill(28625, 'Deathstrike', { type: 'weapon', weapon: 'Sword', castTimeMs: 0 }),
      skill(27107, 'Impossible Odds', { castTimeMs: 0, upkeepCost: 5 }),
      skill(28382, 'Relinquish Power', { castTimeMs: 0, flipParentId: 27107 }),
      skill(-4, 'Swap Legends', { castTimeMs: 0 }),
      skill(62895, "Phantom's Onslaught", {
        type: 'weapon',
        weapon: 'Greatsword',
        castTimeMs: 440
      }),
      skill(62713, "Phantom's Onslaught", {
        type: 'weapon',
        weapon: 'Greatsword',
        castTimeMs: 440
      })
    ]
  };

  const result = reconstructDpsReportRotation(report, catalog);
  // Composite animation segments must collapse to one player input for each weapon skill.
  for (const name of ['Deathstrike', "Phantom's Onslaught"]) {
    assert.equal(result.actions.filter((action) => action.name === name).length, 1);
  }

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
      skill(28287, 'Embrace the Darkness', { type: 'elite', castTimeMs: 440 }),
      skill(27505, 'Banish Enchantment', { type: 'utility', castTimeMs: 440 }),
      skill(27917, 'Call to Anguish', { type: 'utility', castTimeMs: 800 }),
      skill(76503, 'Unyielding Impact', { type: 'utility', castTimeMs: 920 }),
      skill(28029, 'Frigid Blitz', { type: 'weapon', castTimeMs: 960 })
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
