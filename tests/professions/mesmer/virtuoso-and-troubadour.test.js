import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { skillBreakdownRows } from '#gw2/app/rotation/result/model.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/view.js';
import { shatterResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { simulationEventLogRows } from '#gw2/app/rotation/result/simulation-event-log.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';

test('Illusionary Reversion refunds one clone only after shattering three', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    selectedTraitIds: [TRAIT.ILLUSIONARY_REVERSION]
  });
  const fullShatter = simulateMesmer(['Split Second'], {
    ...config,
    initialResource: 3
  });
  const partialShatter = simulateMesmer(['Split Second'], {
    ...config,
    initialResource: 2
  });
  const continuumSplit = simulateMesmer(['Continuum Split'], {
    ...config,
    initialResource: 3
  });

  assert.equal(fullShatter.endState.profession.resource, 1);
  assert.equal(partialShatter.endState.profession.resource, 0);
  assert.equal(continuumSplit.endState.profession.resource, 1);
  assert.ok(
    simulationEventLogRows(fullShatter).some((event) =>
      event.description.includes('CLONE SPAWNED x1 -> 1/3 [Illusionary Reversion] (Clone #4 [Dagger])')
    )
  );
});

test('Deadly Blades activates only after a completed Virtuoso Bladesong', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.DEADLY_BLADES],
    initialResource: 1
  });
  const completed = simulateMesmer(['Bladesong Harmony'], config);
  const interrupted = simulateMesmer([{ name: 'Bladesong Harmony', interruptMs: 100 }], config);
  const action = completed.events.find((event) => event.type === 'action' && event.name === 'Bladesong Harmony');
  const buff = completed.events.find((event) => event.type === 'buff' && event.kind === 'deadly-blades');

  assert.ok(buff);
  assert.equal(buff.duration, 7);
  assert.ok(Math.abs(buff.at - action.fullEndsAt - 0.0001) < 1e-12);
  assert.equal(
    interrupted.events.some((event) => event.type === 'buff' && event.kind === 'deadly-blades'),
    false
  );
});

test('Infinite Forge refunds two blades only after a completed five-blade Bladesong', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    selectedTraitIds: [TRAIT.INFINITE_FORGE]
  });
  const observeRefund = (shatter) => [shatter, { name: '__wait', waitMs: 1000 }];
  const fullShatter = simulateMesmer(observeRefund('Bladesong Harmony'), {
    ...config,
    initialResource: 5
  });
  const partialShatter = simulateMesmer(observeRefund('Bladesong Harmony'), {
    ...config,
    initialResource: 4
  });
  const interruptedShatter = simulateMesmer(observeRefund({ name: 'Bladesong Harmony', interruptMs: 100 }), {
    ...config,
    initialResource: 5
  });
  const action = fullShatter.events.find((event) => event.type === 'action' && event.name === 'Bladesong Harmony');
  const refund = fullShatter.events.find(
    (event) => event.type === 'resource' && event.reason === 'Infinite Forge refund'
  );

  assert.equal(fullShatter.endState.profession.resource, 2);
  assert.equal(partialShatter.endState.profession.resource, 0);
  assert.equal(interruptedShatter.endState.profession.resource, 5);
  assert.equal(refund.amount, 2);
  assert.ok(Math.abs(refund.at - action.fullEndsAt - 0.0002) < 1e-12);
});

test('Signet of the Ether resets every phantasm skill cooldown', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', 'Phantasmal Warlock', 'Signet of the Ether', 'Phantasmal Duelist', 'Phantasmal Warlock'],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 0
    })
  );

  assert.equal(result.steps.length, 5);
  assert.ok(Math.abs(result.steps[3].start - result.steps[2].end) <= 1);
  assert.ok(Math.abs(result.steps[4].start - result.steps[3].end) <= 1);
});

test('Signet of the Ether re-locks 300ms after its cast completes', () => {
  const result = simulateMesmer(
    ['Signet of the Ether', { name: '__wait', waitMs: 500 }],
    defaultSimulationConfig({
      specialization: 'Core',
      boons: {
        ...defaultSimulationConfig().boons,
        alacrity: false,
        quickness: false
      }
    })
  );
  const cast = result.steps[0];
  const cooldown = result.endState.cooldowns['Signet of the Ether'];

  assert.equal(cooldown.readyAt - cast.end, 30300);
});

test('Signet of Illusions passively generates one resource every ten combat seconds', () => {
  const passiveEvents = (specialization) =>
    simulateMesmer(
      [{ name: '__wait', waitMs: 20001 }],
      defaultSimulationConfig({
        specialization,
        selectedSkills: ['Signet of Illusions'],
        initialResource: 0
      })
    ).events.filter((event) => event.type === 'resource' && event.reason === 'Signet of Illusions');

  assert.deepEqual(
    passiveEvents('Core').map((event) => [event.at, event.resource]),
    [
      [10, 'clones'],
      [20, 'clones']
    ]
  );
  assert.deepEqual(
    passiveEvents('Virtuoso').map((event) => [event.at, event.resource]),
    [
      [10, 'blades'],
      [20, 'blades']
    ]
  );
  assert.equal(
    simulateMesmer(
      [{ name: '__wait', waitMs: 20001 }],
      defaultSimulationConfig({
        specialization: 'Core',
        selectedSkills: [],
        initialResource: 0
      })
    ).events.some((event) => event.reason === 'Signet of Illusions'),
    false
  );
});

test('Signet of Illusions starts its passive cycle at combat start', () => {
  const result = simulateMesmer(
    [{ name: '__wait', waitMs: 5000 }, '__combat_start', { name: '__wait', waitMs: 10001 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 0
    })
  );
  const passiveEvents = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Signet of Illusions'
  );

  assert.deepEqual(
    passiveEvents.map((event) => event.at),
    [15]
  );
});

test('Signet of Illusions restarts its ten-second cycle after recharge', () => {
  const result = simulateMesmer(
    ['Signet of Illusions', { name: '__wait', waitMs: 70001 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 0,
      boons: {
        quickness: false,
        alacrity: false
      }
    })
  );
  const passiveEvents = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Signet of Illusions'
  );

  assert.deepEqual(
    passiveEvents.map((event) => event.at),
    [71.68]
  );
});

test('Signet of Illusions does not recharge Continuum Split or Crescendo', () => {
  const chronomancer = simulateMesmer(
    ['Continuum Split', { name: '__wait', waitMs: 2000 }, 'Split Second', 'Signet of Illusions'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 0
    })
  );

  assert.ok(chronomancer.endState.cooldowns['Continuum Split']);
  assert.equal(chronomancer.endState.cooldowns['Split Second'], undefined);

  const troubadour = simulateMesmer(
    ['Lively Lute', 'Crescendo', 'Signet of Illusions'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 1
    })
  );

  assert.ok(troubadour.endState.cooldowns.Crescendo);
  assert.equal(troubadour.endState.cooldowns['Lively Lute'], undefined);
});

test('Mental Collapse resets Mind the Gap cooldown', () => {
  const result = simulateMesmer(
    ['Mind the Gap', 'Mental Collapse', 'Mind the Gap'],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps.length, 3);
  assert.ok(Math.abs(result.steps[2].start - result.steps[1].end) <= 1);
  const resetOnly = simulateMesmer(
    ['Mind the Gap', 'Mental Collapse'],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(resetOnly.endState.cooldowns['Mind the Gap'], undefined);
});

test('Mind the Gap grants 15 seconds of Clarity and displays it as a skill proc', () => {
  const result = simulateMesmer(
    ['Mind the Gap'],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.endState.profession.clarityRemaining, 15000);
  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.skill === 'Clarity' &&
        proc.type === 'skill_proc' &&
        proc.sourceSkill === 'Mind the Gap' &&
        proc.icon.includes('Clarity.png')
    )
  );
});

test('Mesmer spear skills 3, 4, and 5 consume Clarity', () => {
  for (const consumer of ['Imaginary Inversion', 'Phantasmal Lancer', 'Mental Collapse']) {
    const result = simulateMesmer(
      ['Mind the Gap', consumer],
      defaultSimulationConfig({
        specialization: 'Virtuoso',
        primaryWeapon: 'Spear',
        secondaryWeapon: ''
      })
    );

    assert.equal(result.endState.profession.clarityRemaining, 0, consumer);
  }
});

test('Clarity makes Phantasmal Lancer summon and attack with a second phantasm', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    initialResource: 0
  });
  const normal = simulateMesmer(['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }], config);
  const empowered = simulateMesmer(['Mind the Gap', 'Phantasmal Lancer', { name: '__wait', waitMs: 3000 }], config);

  assert.equal(
    normal.events.find((event) => event.type === 'mesmer.phantasm-summoned' && event.name === 'Phantasmal Lancer')
      ?.count,
    1
  );
  assert.equal(
    empowered.events.find((event) => event.type === 'mesmer.phantasm-summoned' && event.name === 'Phantasmal Lancer')
      ?.count,
    2
  );
  assert.equal(
    normal.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
    ).length,
    1
  );
  assert.equal(
    empowered.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
    ).length,
    2
  );
  const coefficientBySource = (result) =>
    Object.fromEntries(
      ['Player', 'Phantasm'].map((source) => [
        source,
        result.resolvedEvents
          .filter(
            (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === source
          )
          .reduce((sum, event) => sum + event.coefficient, 0)
      ])
    );

  assert.deepEqual(coefficientBySource(normal), {
    Player: 1,
    Phantasm: 0.6
  });
  assert.deepEqual(coefficientBySource(empowered), {
    Player: 1,
    Phantasm: 1.2
  });
});

test("Phantasmal Blade lands one second after Phantasmal Lancer's phantasm hit", () => {
  const result = simulateMesmer(
    ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.PHANTASMAL_BLADES],
      initialResource: 0
    })
  );
  const blade = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Blade'
  );
  const phantasm = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
  );

  assert.equal(Number((blade.at - phantasm.at).toFixed(3)), 1);
});

test('Phantasmal Lancer converts after recovery and Chronophantasma repeats before final conversion', () => {
  const rotation = ['Phantasmal Lancer', { name: '__wait', waitMs: 5000 }];
  const baseConfig = {
    initialResource: 0,
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  };
  const normal = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Virtuoso',
      selectedTraitIds: []
    })
  );
  const chronophantasma = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.CHRONOPHANTASMA]
    })
  );
  const normalCastEnd = normal.steps.find((step) => step.skill === 'Phantasmal Lancer').end / 1000;
  const chronoCastEnd = chronophantasma.steps.find((step) => step.skill === 'Phantasmal Lancer').end / 1000;
  const normalDamage = normal.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
  );
  const normalConversion = normal.events.find((event) => event.reason === 'Phantasmal Lancer phantasm conversion');
  const resummon = chronophantasma.events.find(
    (event) => event.type === 'mesmer.phantasm-resummoned' && event.name === 'Phantasmal Lancer'
  );
  const repeatDamage = chronophantasma.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Phantasmal Lancer - Chronophantasma'
  );
  const chronoConversion = chronophantasma.events.find(
    (event) => event.reason === 'Phantasmal Lancer phantasm conversion'
  );

  assert.ok(Math.abs(normalDamage.at - (normalCastEnd + 1.16)) < 0.00001);
  assert.ok(Math.abs(normalConversion.at - (normalCastEnd + 2.0401)) < 0.00001);
  assert.ok(Math.abs(resummon.at - (chronoCastEnd + 2.04)) < 0.00001);
  assert.ok(Math.abs(repeatDamage.at - (chronoCastEnd + 3.3)) < 0.00001);
  assert.ok(Math.abs(chronoConversion.at - (chronoCastEnd + 4.1401)) < 0.00001);
});

test('Flying Cutter and Unstable Bladestorm remain available outside Virtuoso', () => {
  const result = simulateMesmer(
    ['Flying Cutter', 'Unstable Bladestorm'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Dagger',
      secondaryWeapon: ''
    })
  );

  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.name),
    ['Flying Cutter', 'Unstable Bladestorm']
  );
  assert.equal(result.warnings.length, 0);
});

test('Unstable Bladestorm commits at its measured spawn and retains its packet train', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword'
  });
  const committed = simulateMesmer(
    [
      { name: 'Unstable Bladestorm', interruptMs: 200 },
      { name: '__wait', waitMs: 5000 }
    ],
    config
  );
  const cancelled = simulateMesmer(
    [
      { name: 'Unstable Bladestorm', interruptMs: 199 },
      { name: '__wait', waitMs: 5000 }
    ],
    config
  );

  assert.deepEqual(
    committed.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Unstable Bladestorm')
      .map((event) => Number(event.at.toFixed(3))),
    [1.16, 1.2, 2.16, 2.2, 3.16, 3.2, 4.16, 4.2]
  );
  assert.equal(
    cancelled.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Unstable Bladestorm')
      .length,
    0
  );
});

test('Flying Cutter tracks three hits for five seconds and Bladecall strikes six times', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword',
    selectedTraitIds: [TRAIT.JAGGED_MIND],
    stats: {
      ...defaults.stats,
      precision: 3100
    }
  });
  const consecutive = simulateMesmer(
    ['Flying Cutter', 'Flying Cutter', 'Flying Cutter', { name: '__wait', waitMs: 1500 }],
    config
  );
  const burst = consecutive.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Cutter Burst');

  assert.equal(burst.length, 3);
  assert.ok(
    burst.every(
      (event) =>
        event.skillName === 'Cutter Burst' &&
        event.parentSkillName === 'Flying Cutter' &&
        event.sourceId === ID.CUTTER_BURST &&
        event.skillId === ID.CUTTER_BURST
    )
  );
  assert.ok(Math.abs(burst.reduce((sum, event) => sum + event.coefficient, 0) - 0.6) < 1e-12);
  const skillRows = skillBreakdownRows(consecutive);
  const flyingCutterRow = skillRows.find((row) => row.name === 'Flying Cutter');
  const cutterBurstRow = skillRows.find((row) => row.name === 'Cutter Burst');

  assert.ok(flyingCutterRow.strike > 0);
  assert.ok(cutterBurstRow.strike > 0);
  assert.ok(flyingCutterRow.condition > 0);
  assert.ok(cutterBurstRow.condition > 0);
  assert.equal(flyingCutterRow.hits, 3);
  assert.equal(cutterBurstRow.hits, 3);
  assert.equal(flyingCutterRow.casts, 3);
  assert.equal(cutterBurstRow.casts, 0);
  assert.equal(cutterBurstRow.parentSkill, 'Flying Cutter');
  const triggerAt = consecutive.resolvedEvents
    .filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter' && event.name !== 'Cutter Burst')
    .at(-1).at;

  assert.deepEqual(
    burst.map((event) => Number((event.at - triggerAt).toFixed(3))),
    [0.217, 0.25, 0.384]
  );
  assert.deepEqual(
    consecutive.resolvedEvents
      .filter((event) => event.type === 'condition' && event.name === 'Cutter Burst — Jagged Mind')
      .map((event) => Number((event.at - triggerAt).toFixed(3))),
    [0.217, 0.25, 0.384]
  );

  const expired = simulateMesmer(
    ['Flying Cutter', { name: '__wait', waitMs: 5001 }, 'Flying Cutter', 'Flying Cutter'],
    config
  );

  assert.equal(
    expired.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Cutter Burst').length,
    0
  );

  const bladecall = simulateMesmer(['Bladecall', { name: '__wait', waitMs: 3000 }], config);
  const bladecallHits = bladecall.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Bladecall'
  );

  assert.equal(bladecallHits.length, 6);
  assert.ok(Math.abs(bladecallHits.reduce((sum, event) => sum + event.coefficient, 0) - 1.5) < 1e-12);
  assert.deepEqual(
    bladecallHits.map((event) => Number(event.at.toFixed(3))),
    [0.199, 0.199, 0.199, 2.716, 2.716, 2.766]
  );
  assert.deepEqual(
    bladecall.resolvedEvents
      .filter((event) => event.type === 'condition' && event.name === 'Bladecall — Jagged Mind')
      .map((event) => Number(event.at.toFixed(3))),
    [0.199, 0.199, 0.199, 2.716, 2.716, 2.766]
  );
});

test('Flying Cutter commits its projectile before an interrupt and retains Cutter Burst', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword'
  });
  const afterRelease = simulateMesmer(
    ['Flying Cutter', 'Flying Cutter', { name: 'Flying Cutter', interruptMs: 317 }, { name: '__wait', waitMs: 1000 }],
    config
  );
  const beforeRelease = simulateMesmer(
    ['Flying Cutter', 'Flying Cutter', { name: 'Flying Cutter', interruptMs: 316 }, { name: '__wait', waitMs: 1000 }],
    config
  );

  assert.equal(
    afterRelease.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter')
      .length,
    3
  );
  assert.equal(
    afterRelease.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Cutter Burst').length,
    3
  );
  assert.equal(
    beforeRelease.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter')
      .length,
    2
  );
  assert.equal(
    beforeRelease.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Cutter Burst').length,
    0
  );
});

test('Virtuoso bladesongs use configured projectile packet trains', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    selectedTraitIds: [TRAIT.JAGGED_MIND],
    stats: {
      ...defaults.stats,
      precision: 3100
    },
    initialResource: 5
  });
  const packets = (result, skillName, type = 'damage') =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === type &&
          event.skillName === skillName &&
          (type !== 'condition' || event.condition === 'Bleeding')
      )
      .map((event) => Number(event.at.toFixed(3)));

  const harmony = simulateMesmer(['Bladesong Harmony', { name: '__wait', waitMs: 2000 }], config);

  assert.deepEqual(packets(harmony, 'Bladesong Harmony'), [0.69, 0.848, 1.007, 1.174, 1.324]);
  assert.deepEqual(packets(harmony, 'Bladesong Harmony', 'condition'), [0.69, 0.848, 1.007, 1.174, 1.324]);

  const sorrow = simulateMesmer(['Bladesong Sorrow', { name: '__wait', waitMs: 2000 }], config);

  assert.deepEqual(packets(sorrow, 'Bladesong Sorrow'), [0.922, 0.997, 1.081, 1.155, 1.155]);
  assert.deepEqual(packets(sorrow, 'Bladesong Sorrow', 'condition'), [0.922, 0.997, 1.081, 1.155, 1.155]);
  assert.deepEqual(
    sorrow.resolvedEvents
      .filter(
        (event) =>
          event.type === 'condition' && event.skillName === 'Bladesong Sorrow' && event.condition === 'Confusion'
      )
      .map((event) => Number(event.at.toFixed(3))),
    [0.922, 0.997, 1.081, 1.155, 1.155]
  );
});

test('Cry of Pain improves every Bladesong Sorrow confusion packet', () => {
  const result = simulateMesmer(
    ['Bladesong Sorrow', { name: '__wait', waitMs: 2000 }],
    defaultSimulationConfig({
      selectedTraitIds: [TRAIT.CRY_OF_PAIN],
      initialResource: 5
    })
  );
  const confusion = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Bladesong Sorrow' && event.condition === 'Confusion'
  );

  assert.deepEqual(
    confusion.map((event) => Number(event.at.toFixed(3))),
    [0.922, 0.997, 1.081, 1.155, 1.155]
  );
  assert.ok(confusion.every((event) => event.stacks === 2 && event.duration === 4));
});

test('Maim the Disillusioned follows each damaging Virtuoso bladesong hit', () => {
  const skills = ['Bladesong Harmony', 'Bladesong Sorrow', 'Bladesong Dissonance', 'Bladeturn Requiem'];

  for (const skillName of skills) {
    const result = simulateMesmer(
      [skillName, { name: '__wait', waitMs: 5000 }],
      defaultSimulationConfig({
        selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED],
        initialResource: 5
      })
    );
    const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName);
    const hitTimes = hits.map((event) => Number(event.at.toFixed(3)));
    const torment = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === skillName && event.condition === 'Torment'
    );

    assert.ok(hitTimes.length > 0, skillName);
    assert.ok(
      hits.every((event) => event.shatterTraitEligible === true),
      skillName
    );
    assert.deepEqual(
      torment.map((event) => Number(event.at.toFixed(3))),
      hitTimes,
      skillName
    );
    assert.ok(
      torment.every((event) => event.stacks === 1 && event.duration === 6),
      skillName
    );
  }
});

test('Mental Anguish improves every damaging Virtuoso bladesong hit', () => {
  const skills = ['Bladesong Harmony', 'Bladesong Sorrow', 'Bladesong Dissonance', 'Bladeturn Requiem'];
  const damageEvents = (result, skillName) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName);

  for (const skillName of skills) {
    const rotation = [skillName, { name: '__wait', waitMs: 5000 }];
    const config = defaultSimulationConfig({ initialResource: 5 });
    const baseline = damageEvents(simulateMesmer(rotation, config), skillName);
    const boosted = damageEvents(
      simulateMesmer(rotation, { ...config, selectedTraitIds: [TRAIT.MENTAL_ANGUISH] }),
      skillName
    );

    assert.equal(boosted.length, baseline.length, skillName);
    assert.ok(
      boosted.every((event) => event.shatterTraitEligible === true),
      skillName
    );
    assert.ok(
      boosted.every((event, index) => Math.abs(event.damage / baseline[index].damage - 1.25) < 1e-12),
      skillName
    );
  }
});

test('Maim the Disillusioned applies torment for defensive shatters', () => {
  const cases = [
    {
      specialization: 'Virtuoso',
      skill: 'Bladesong Distortion',
      initialResource: 5,
      expectedStacks: 1
    },
    {
      specialization: 'Core',
      skill: 'Distortion',
      initialResource: 3,
      expectedStacks: 4
    },
    {
      specialization: 'Chronomancer',
      skill: 'Distortion',
      initialResource: 3,
      expectedStacks: 4
    },
    {
      specialization: 'Mirage',
      skill: 'Distortion',
      initialResource: 3,
      expectedStacks: 4
    }
  ];

  for (const testCase of cases) {
    const result = simulateMesmer(
      [testCase.skill],
      defaultSimulationConfig({
        specialization: testCase.specialization,
        selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED],
        initialResource: testCase.initialResource
      })
    );
    const torment = result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === testCase.skill && event.condition === 'Torment'
    );

    assert.equal(result.steps[0].start, result.steps[0].end);
    assert.equal(result.endState.profession.resource, 0);
    assert.equal(torment.length, 1);
    assert.equal(torment[0].stacks, testCase.expectedStacks);
    assert.equal(torment[0].duration, 6);
  }
});

test('Bladeturn Requiem starts one second later and scales by 0.5 per blade', () => {
  const result = simulateMesmer(
    ['Bladeturn Requiem', { name: '__wait', waitMs: 6000 }],
    defaultSimulationConfig({ initialResource: 5 })
  );
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Bladeturn Requiem'
  );

  assert.deepEqual(
    hits.map((event) => Number(event.at.toFixed(3))),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [0.5, 0.5, 0.5, 0.5, 0.5]
  );
});

test('Phantasmal Duelist uses eight timed unload and bleeding packets', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [],
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const times = (source) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Phantasmal Duelist' && event.source === source)
      .map((event) => Number(event.at.toFixed(3)));

  assert.deepEqual(times('Player'), [0.35, 0.35, 0.4]);
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.skillName === 'Phantasmal Duelist' && event.source === 'Player'
      )
      .map((event) => event.coefficient),
    [0.33, 0.33, 0.33]
  );
  assert.deepEqual(times('Phantasm'), [1.39, 1.59, 1.79, 1.99, 2.19, 2.39, 2.59, 2.79]);
  assert.ok(
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.skillName === 'Phantasmal Duelist' && event.source === 'Phantasm'
      )
      .every((event) => Math.abs(event.coefficient - 0.115) < 1e-12)
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === 'condition' && event.skillName === 'Phantasmal Duelist' && event.condition === 'Bleeding'
      )
      .map((event) => Number(event.at.toFixed(3))),
    [1.39, 1.59, 1.79, 1.99, 2.19, 2.39, 2.59, 2.79]
  );
});

test('supplied trait attacks execute with their exact coefficients', () => {
  const coefficient = (result, skillName) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .reduce((sum, event) => sum + event.coefficient, 0);

  const madness = simulateMesmer(
    ['Ether Feast', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.METHOD_OF_MADNESS],
      selectedSkills: ['Ether Feast']
    })
  );

  assert.ok(Math.abs(coefficient(madness, 'Lesser Chaos Storm') - 1.98) < 1e-12);

  const phantasmalBlade = simulateMesmer(
    ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.PHANTASMAL_BLADES],
      initialResource: 0
    })
  );

  assert.equal(coefficient(phantasmalBlade, 'Phantasmal Blade'), 0.7);
  const phantasmalBladeHit = phantasmalBlade.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Blade'
  );

  assert.equal(phantasmalBladeHit.source, 'Player');
  assert.equal(phantasmalBladeHit.actorType, 'player');
  assert.equal(phantasmalBladeHit.weaponStrength, 2553.5);
  const modifiedPhantasmalBlade = simulateMesmer(
    ['Phantasmal Lancer', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.PHANTASMAL_BLADES],
      initialResource: 0,
      sigilSets: [
        { strike: 1.1, condition: 1 },
        { strike: 1, condition: 1 }
      ]
    })
  ).resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Phantasmal Blade');

  assert.ok(Math.abs(modifiedPhantasmalBlade.damage / phantasmalBladeHit.damage - 1.1) < 1e-12);

  const syncopate = simulateMesmer(
    ['Illusionary Wave'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.SYNCOPATE]
    })
  );

  assert.equal(coefficient(syncopate, 'Syncopate'), 0.75);

  const timeBomb = simulateMesmer(
    ['Time Sink', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.TIME_BOMB],
      initialResource: 1
    })
  );

  assert.equal(coefficient(timeBomb, 'Time Bomb'), 3);
});

test('Troubadour instruments use configured packets and normalized strength', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    initialResource: 3,
    selectedTraitIds: [TRAIT.SYNCOPATE, TRAIT.SHREDDING, TRAIT.FORTISSIMO],
    boons: { ...defaults.boons, quickness: true, alacrity: true }
  });
  const lute = simulateMesmer(['Lively Lute', { name: '__wait', waitMs: 1000 }], config);
  const luteHits = lute.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.LIVELY_LUTE);

  assert.equal(lute.steps[0].end, 560);
  assert.deepEqual(
    luteHits.map((event) => Number(event.at.toFixed(3))),
    [0.435, 0.635, 0.835, 1.035]
  );
  assert.deepEqual(
    luteHits.map((event) => event.coefficient),
    [1, 1, 1, 1]
  );
  assert.ok(luteHits.every((event) => event.weaponStrengthProfileId === 'nonweapon.profession-mechanic'));

  const drum = simulateMesmer(['Deafening Drum', { name: '__wait', waitMs: 4000 }], config);
  const drumHit = drum.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Deafening Drum');
  const syncopate = drum.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Syncopate');

  assert.equal(drum.steps[0].end, 680);
  assert.equal(drumHit.at, 0.518);
  assert.equal(drumHit.coefficient, 2);
  assert.equal(drumHit.weaponStrengthProfileId, 'nonweapon.profession-mechanic');
  assert.deepEqual(
    syncopate.map((event) => event.at),
    [0.518, 3.518, 3.518]
  );
  assert.deepEqual(
    syncopate.map((event) => event.coefficient),
    [0.75, 1, 0.75]
  );
  assert.deepEqual(
    syncopate.map((event) => event.weaponStrengthProfileId),
    ['nonweapon.unequipped', 'nonweapon.unequipped', 'nonweapon.unequipped']
  );

  const stochasticDrum = simulateMesmer(['Deafening Drum', { name: '__wait', waitMs: 4000 }], {
    ...config,
    randomness: { mode: 'stochastic', seed: 1 }
  });
  const stochasticDrumHit = stochasticDrum.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Deafening Drum'
  );
  const stochasticSyncopate = stochasticDrum.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Syncopate'
  );

  assert.ok(stochasticDrumHit.weaponStrengthSampled);
  assert.equal(stochasticSyncopate.length, 3);
  assert.ok(
    stochasticSyncopate.every(
      (event) =>
        event.source === 'Trait' &&
        event.weaponStrengthSampled === true &&
        event.activationId !== stochasticDrumHit.activationId
    )
  );
});

test('Troubadour skills use measured Quickness cast times', () => {
  const result = simulateMesmer(
    [
      'Flustering Flute',
      'Lively Lute',
      'Crescendo',
      'Harmonious Harp',
      'Mimic',
      'Tale of the Tortured Mastermind',
      'Deafening Drum'
    ],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      selectedSkills: ['Mimic', 'Tale of the Tortured Mastermind'],
      boons: { quickness: true },
      initialResource: 3
    })
  );

  assert.deepEqual(
    result.steps.map((step) => step.end - step.start),
    [560, 560, 1000, 2000, 640, 400, 680]
  );
});

test('Harmonious Harp replays at 480ms after its Harp Playing packet commits without dealing damage', () => {
  const config = defaultSimulationConfig({
    specialization: 'Troubadour',
    initialResource: 3,
    boons: { quickness: false }
  });
  const full = simulateMesmer(['Harmonious Harp'], config);
  const interrupted = simulateMesmer([{ name: 'Harmonious Harp', interruptMs: 480 }], config);

  assert.equal(full.steps[0].end - full.steps[0].start, 3000);
  assert.equal(interrupted.steps[0].fullCastMs, 3000);
  assert.equal(interrupted.steps[0].end - interrupted.steps[0].start, 480);
  assert.equal(interrupted.steps[0].interrupted, true);
  assert.equal(interrupted.endState.profession.resource, 0);
  const instrument = interrupted.events.find(
    (event) => event.type === 'mesmer.instrument' && event.instrument === 'Harp'
  );
  assert.ok(Math.abs(instrument.at - 0.4801) < 1e-12);
  assert.equal(instrument.expiresAt, 20.48);
  assert.equal(
    interrupted.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Harmonious Harp'),
    false
  );
});

test('Shatter Storm gives Lively Lute a second charge without a full cooldown', () => {
  const config = (selectedTraitIds) =>
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds
    });
  const ordinary = simulateMesmer(['Lively Lute', 'Lively Lute'], config([]));
  const shatterStorm = simulateMesmer(['Lively Lute', 'Lively Lute'], config([TRAIT.SHATTER_STORM]));
  const shatterStormAfterOne = simulateMesmer(['Lively Lute'], config([TRAIT.SHATTER_STORM]));
  const shatterStormBeforeUse = simulateMesmer([], config([TRAIT.SHATTER_STORM]));
  const livelyLute = mesmerCatalog.skillsById.get(ID.LIVELY_LUTE);
  const paletteApp = (results) => ({
    build: { rotation: [] },
    results
  });

  assert.equal(ordinary.steps[1].start, 10160);
  assert.equal(shatterStorm.steps[1].start, shatterStorm.steps[0].end);
  assert.equal(paletteSkillView(paletteApp(ordinary), livelyLute).ammo, null);
  assert.deepEqual(paletteSkillView(paletteApp(shatterStormBeforeUse), livelyLute).ammo, {
    current: 2,
    maximum: 2,
    available: true,
    label: '2/2 ammo',
    pips: [true, true]
  });
  assert.deepEqual(paletteSkillView(paletteApp(shatterStormAfterOne), livelyLute).ammo, {
    current: 1,
    maximum: 2,
    available: true,
    label: '1/2 ammo',
    pips: [true, false]
  });
});

test('Tortured Mastermind follows its four-hit condition timeline', () => {
  const result = simulateMesmer(
    ['Flustering Flute', 'Tale of the Tortured Mastermind', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.SYNCOPATE, TRAIT.DAZZLING]
    })
  );
  const taleHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Tale of the Tortured Mastermind'
  );
  const taleConditions = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Tale of the Tortured Mastermind'
  );

  assert.equal(result.steps[1].start, 560);
  assert.equal(result.steps[1].end, 960);
  assert.deepEqual(
    taleHits.map((event) => Number(event.at.toFixed(3))),
    [0.91, 1.91, 2.91, 3.91]
  );
  assert.deepEqual(
    taleHits.map((event) => event.coefficient),
    [1, 1, 1, 1]
  );
  assert.deepEqual(
    taleConditions
      .filter((event) => event.condition === 'Torment')
      .map((event) => [Number(event.at.toFixed(3)), event.stacks, event.duration]),
    [
      [0.91, 1, 8],
      [1.91, 1, 8],
      [2.91, 1, 8],
      [3.91, 1, 8]
    ]
  );
  assert.deepEqual(
    taleConditions
      .filter((event) => event.condition !== 'Torment')
      .map((event) => [event.condition, Number(event.at.toFixed(3)), event.stacks, event.duration]),
    [
      ['Weakness', 0.91, 1, 5],
      ['Vulnerability', 1.91, 10, 4]
    ]
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'control' && event.skillName === 'Tale of the Tortured Mastermind' && event.at === 3.91
    )
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Syncopate' && event.at === 3.91
    )
  );
  assert.equal(result.endState.profession.resource, 1);
});

test('Chaotic Interruption recharges a phantasm cast before Tortured Mastermind delayed control lands', () => {
  const result = simulateMesmer(
    ['Flustering Flute', 'Tale of the Tortured Mastermind', 'Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      primaryWeapon: 'Staff',
      selectedSkills: ['Flustering Flute', 'Tale of the Tortured Mastermind'],
      selectedTraitIds: [TRAIT.CHAOTIC_INTERRUPTION],
      target: { activatingSkills: true }
    })
  );

  const proc = result.events.find((event) => event.type === 'proc' && event.name === 'Chaotic Interruption');

  assert.equal(proc?.at, 3.91);
  assert.equal(proc?.sourceSkill, 'Tale of the Tortured Mastermind');
  assert.equal(result.endState.cooldowns['Phantasmal Warlock'].readyAt, 6400);
});

test('Troubadour tales grant their boons and instrument-specific notes', () => {
  const cases = [
    [
      'Lively Lute',
      'Tale of the Soulkeeper',
      2,
      [
        ['might', 10, 15],
        ['fury', 1, 10],
        ['quickness', 1, 4]
      ]
    ],
    ['Deafening Drum', 'Tale of the Honorable Rogue', 1, [['aegis', 1, 4]]],
    [
      'Harmonious Harp',
      'Tale of the Valiant Marshal',
      1,
      [
        ['stability', 5, 4],
        ['resistance', 1, 3]
      ]
    ]
  ];

  for (const [instrument, tale, expectedNotes, expectedBoons] of cases) {
    const result = simulateMesmer(
      [instrument, tale, { name: '__wait', waitMs: 100 }],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        initialResource: 3,
        allies: { count: 4, strikesPerSecond: 1 },
        sharePlayerBoonsWithSummons: true
      })
    );

    assert.equal(result.endState.profession.resource, expectedNotes, tale);
    assert.ok(
      result.events.some((event) => event.type === 'mesmer.instrument' && instrument.includes(event.instrument))
    );
    const boons = result.events
      .filter((event) => event.type === 'buff' && event.skillName === tale)
      .map((event) => [event.kind, event.stacks, event.duration]);

    assert.deepEqual(boons, expectedBoons, tale);
    assert.ok(
      result.events
        .filter((event) => event.type === 'buff' && event.skillName === tale)
        .every(
          (event) =>
            event.audience?.recipients === 'party' &&
            event.resolvedAudience.recipientCount === 5 &&
            event.resolvedAudience.includesSummons === false
        ),
      tale
    );

    if (instrument === 'Harmonious Harp') {
      assert.ok(
        result.events.some((event) => event.type === 'buff' && event.kind === 'distortion' && event.duration === 2)
      );
    }
  }
});

test('Tale of the Honorable Rogue owns its Aegis, note gate, and two-charge timing', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Tale of the Honorable Rogue', 'Tale of the Honorable Rogue', 'Tale of the Honorable Rogue'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0,
      boons: { ...defaults.boons, quickness: false, alacrity: false }
    })
  );
  const casts = result.steps.filter((step) => step.skill === 'Tale of the Honorable Rogue');
  const aegis = result.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Tale of the Honorable Rogue' && event.kind === 'aegis'
  );

  assert.deepEqual(
    casts.map((step) => step.start),
    [0, 4000, 25000]
  );
  assert.equal(result.endState.profession.resource, 0);
  assert.equal(aegis.length, 3);
  assert.ok(aegis.every((event) => event.duration === 4));
});

test('Troubadour instrument note spends retain rotation timeline metadata', () => {
  const result = simulateMesmer(
    ['Lively Lute', 'Tale of the Soulkeeper', 'Flustering Flute'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3
    })
  );
  const spends = shatterResourceSpends(result);

  assert.deepEqual(spends.get(0), {
    count: 3,
    resource: 'notes',
    sourceSkill: 'Lively Lute'
  });
  assert.deepEqual(spends.get(2), {
    count: 2,
    resource: 'notes',
    sourceSkill: 'Flustering Flute'
  });
  assert.deepEqual(
    result.endState.profession.activeInstruments.map((instrument) => instrument.name),
    ['Lute', 'Flute']
  );
  const resourceViews = mesmerProfession
    .resolveRuntime({
      specialization: 'Troubadour'
    })
    .ui.resourceViews({
      specialization: 'Troubadour',
      professionState: result.endState.profession
    });
  const notesView = resourceViews.find((view) => view.id === 'notes');
  const playingView = resourceViews.find((view) => view.id === 'playing-instruments');

  assert.equal(notesView.pipStyle, 'mesmer-notes');
  assert.equal(notesView.statusItems, undefined);
  assert.equal(playingView.displayMode, 'status');
  assert.equal(playingView.statusItemsLabel, undefined);
  assert.deepEqual(
    playingView.statusItems.map((item) => item.label),
    ['Lute', 'Flute']
  );
  assert.ok(playingView.statusItems.every((item) => /^\d+\.\d+s$/.test(item.valueLabel)));
  const resourceHtml = activeResourceGroup({
    profession: mesmerProfession,
    adapter: { eliteSpecialization: () => 'Troubadour' },
    build: { initialResource: 0 },
    results: result
  });

  assert.match(resourceHtml, /active-resource-pips mesmer-notes/);
  assert.equal([...resourceHtml.matchAll(/<span class="active-resource-pip(?: active)?"><\/span>/g)].length, 3);
  assert.match(resourceHtml, /active-resource-statuses/);
  assert.doesNotMatch(resourceHtml, /active-resource-status-label/);
  assert.match(resourceHtml, />Lute</);
  assert.match(resourceHtml, />Flute</);
  for (const index of [0, 2]) {
    const spend = result.events.find(
      (event) => event.type === 'resource' && event.reason === 'profession mechanic' && event.rotationIndex === index
    );

    assert.ok(spend);
    const action = result.events.find((event) => event.type === 'action' && event.name === spend.sourceSkill);

    assert.ok(action);
    assert.equal(spend.sourceSkill, action.name);
    assert.ok(Math.abs(spend.at - action.fullEndsAt) < 0.00001);
  }

  const empty = simulateMesmer(
    ['Deafening Drum'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0
    })
  );

  assert.deepEqual(shatterResourceSpends(empty).get(0), {
    count: 0,
    resource: 'notes',
    sourceSkill: 'Deafening Drum'
  });
});

test('Troubadour adept and support traits emit their modeled effects', () => {
  const resonance = simulateMesmer(
    ['Flustering Flute', 'Dodge', 'Dodge', 'Dodge'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3
    })
  );

  assert.equal(resonance.steps[3].start, 8560);

  const mayhem = simulateMesmer(
    ['Flustering Flute', 'Dodge', 'Flustering Flute'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0,
      selectedTraitIds: [TRAIT.MAYHEM]
    })
  );
  const torment = mayhem.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.condition === 'Torment' && event.name.includes('Mayhem')
  );

  assert.deepEqual(
    torment.map((event) => [event.stacks, event.duration]),
    [
      [4, 5],
      [4, 5]
    ]
  );
  assert.equal(mayhem.steps[2].start, 15060);

  const rogueEndurance = simulateMesmer(
    ['Dodge', 'Dodge', 'Tale of the Honorable Rogue', 'Dodge'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0
    })
  );

  assert.equal(rogueEndurance.steps[3].start, 0);

  const raconteur = simulateMesmer(
    ['Tale of the Soulkeeper'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      selectedTraitIds: [TRAIT.RACONTEUR],
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    })
  );

  assert.ok(
    raconteur.events.some(
      (event) =>
        event.type === 'buff' &&
        event.kind === 'protection' &&
        event.duration === 3 &&
        event.audience?.recipients === 'party' &&
        event.resolvedAudience.includesSummons === false
    )
  );

  const party = simulateMesmer(
    ['Lively Lute', 'Crescendo'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.LIFE_OF_THE_PARTY],
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    })
  );
  const partyBoons = party.events.filter(
    (event) => event.type === 'buff' && ['quickness', 'might', 'fury'].includes(event.kind)
  );

  assert.ok(
    partyBoons.every(
      (event) =>
        event.audience?.recipients === 'party' &&
        event.resolvedAudience.recipientCount === 5 &&
        event.resolvedAudience.includesSummons === false
    )
  );
  assert.ok(partyBoons.some((event) => event.kind === 'quickness' && event.duration === 6));
  assert.ok(partyBoons.some((event) => event.kind === 'might' && event.stacks === 5 && event.duration === 8));
  assert.ok(partyBoons.some((event) => event.kind === 'quickness' && event.duration === 8));
  assert.ok(partyBoons.some((event) => event.kind === 'might' && event.stacks === 8 && event.duration === 15));
  assert.ok(partyBoons.some((event) => event.kind === 'fury' && event.duration === 8));
});

test('Harmonize, Call and Response, Fortissimo, and Altered Chord execute', () => {
  const harmonize = simulateMesmer(
    ['Phantasmal Swordsman', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0
    })
  );

  assert.deepEqual(
    harmonize.events.filter((event) => event.type === 'resource').map((event) => event.reason),
    ['Harmonize', 'Phantasmal Swordsman phantasm conversion']
  );
  assert.equal(harmonize.endState.profession.resource, 2);

  const response = simulateMesmer(
    ['Lively Lute', { name: '__wait', waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      selectedTraitIds: [TRAIT.CALL_AND_RESPONSE]
    })
  );
  const afterimageHits = response.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.source === 'Afterimage'
  );

  assert.deepEqual(
    afterimageHits.map((event) => Number(event.at.toFixed(3))),
    [2.06, 2.26, 2.46]
  );
  assert.ok(afterimageHits.every((event) => event.actorType === 'summon'));
  assert.ok(
    response.events.some((event) => event.type === 'proc' && event.name === 'Call and Response' && event.at === 2.06)
  );

  const fortissimo = simulateMesmer(
    ['Crescendo', { name: '__wait', waitMs: 5100 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 0,
      selectedTraitIds: [TRAIT.FORTISSIMO]
    })
  );

  assert.deepEqual(
    fortissimo.events
      .filter((event) => event.type === 'resource' && event.reason === 'Fortissimo')
      .map((event) => event.at),
    [2, 3, 4]
  );

  const altered = simulateMesmer(
    ['Deafening Drum', 'Crescendo', { name: '__wait', waitMs: 3000 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.ALTERED_CHORD, TRAIT.SYNCOPATE]
    })
  );

  assert.ok(
    altered.events.some((event) => event.type === 'control' && event.skillName === 'Crescendo' && event.at === 1.53)
  );
  assert.ok(
    altered.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Crescendo' && event.at === 1.53
    )
  );

  const luteSpotlight = simulateMesmer(
    ['Lively Lute', 'Crescendo'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.ALTERED_CHORD]
    })
  );

  assert.ok(
    luteSpotlight.events.some(
      (event) => event.type === 'buff' && event.kind === 'altered-chord' && event.duration === 10
    )
  );

  const fluteSpotlight = simulateMesmer(
    ['Flustering Flute', 'Crescendo'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 1,
      selectedTraitIds: [TRAIT.ALTERED_CHORD]
    })
  );

  assert.ok(
    fluteSpotlight.resolvedEvents.some(
      (event) =>
        event.type === 'condition' &&
        event.name.includes('Altered Chord') &&
        event.condition === 'Confusion' &&
        event.stacks === 5 &&
        event.duration === 8
    )
  );

  const crescendoReadyAt = (initialResource) =>
    simulateMesmer(
      ['Crescendo', 'Lively Lute'],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        initialResource,
        selectedTraitIds: [TRAIT.ALTERED_CHORD]
      })
    ).endState.cooldowns.Crescendo.readyAt;

  assert.equal(crescendoReadyAt(0) - crescendoReadyAt(1), 2000);
});

test('Bountiful Blades stocks each Berserker blade independently', () => {
  const result = simulateMesmer(
    ['Phantasmal Berserker', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const conversions = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Phantasmal Berserker phantasm conversion'
  );

  assert.deepEqual(
    conversions.map((event) => event.amount),
    [1, 1]
  );
  assert.ok(Math.abs(conversions[0].at - 3.6801) < 0.00001);
  assert.ok(Math.abs(conversions[1].at - 4.0001) < 0.00001);
});

test('Chronophantasma preserves each Bountiful Blades conversion timestamp', () => {
  const result = simulateMesmer(
    ['Phantasmal Berserker', { name: '__wait', waitMs: 6000 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES, TRAIT.CHRONOPHANTASMA],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const conversions = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Phantasmal Berserker phantasm conversion'
  );

  assert.deepEqual(
    conversions.map((event) => [event.amount, Number(event.at.toFixed(4))]),
    [
      [1, 5.6801],
      [1, 5.7201]
    ]
  );
});

test('Chronophantasma conversions preserve clone spends across a Continuum Split boundary', () => {
  const result = simulateMesmer(
    [
      'Phantasmal Berserker',
      'Phantasmal Disenchanter',
      { name: '__wait', waitMs: 3980 },
      'Continuum Split',
      { name: '__wait', waitMs: 150 },
      'Time Sink',
      'Rewinder',
      'Mirror Images',
      { name: '__wait', waitMs: 300 },
      'Continuum Shift',
      'Rewinder'
    ],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES, TRAIT.CHRONOPHANTASMA],
      selectedSkills: ['Phantasmal Disenchanter', 'Mirror Images'],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 2
    })
  );
  const spends = result.events
    .filter((event) => event.type === 'resource' && event.reason === 'profession mechanic')
    .map((event) => [event.sourceSkill, -event.amount]);

  assert.deepEqual(spends, [
    ['Continuum Split', 2],
    ['Time Sink', 1],
    ['Rewinder', 0],
    ['Rewinder', 3]
  ]);
});

test('Rain of Swords pulses after its cast with fixed damage and vulnerability timing', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(['Rain of Swords', 'Rain of Swords'], {
    ...defaults,
    specialization: 'Virtuoso',
    selectedTraitIds: [],
    selectedSkills: ['Rain of Swords'],
    boons: {
      ...defaults.boons,
      alacrity: false
    },
    target: {
      ...defaults.target,
      conditions: {
        ...defaults.target.conditions,
        Vulnerability: 0
      }
    }
  });
  const firstCastEnd = result.steps[0].end / 1000;
  const firstActivation = result.events.find((event) => event.type === 'action' && event.name === 'Rain of Swords');
  const firstActivationDamage = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' &&
      event.skillName === 'Rain of Swords' &&
      event.activationId === firstActivation.activationId
  );
  const firstActivationVulnerability = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillName === 'Rain of Swords' &&
      event.condition === 'Vulnerability' &&
      event.activationId === firstActivation.activationId
  );

  assert.equal(result.steps[0].end - result.steps[0].start, 680);
  assert.equal(result.steps[1].start, 25_680);
  assert.deepEqual(
    firstActivationDamage.map((event) => [Math.round((event.at - firstCastEnd) * 1000), event.coefficient]),
    [
      [840, 1.2],
      [1840, 1.2],
      [2840, 1.2],
      [3840, 1.2],
      [4840, 1.2]
    ]
  );
  assert.deepEqual(
    firstActivationVulnerability.map((event) => [
      Math.round((event.at - firstCastEnd) * 1000),
      event.stacks,
      event.duration
    ]),
    [
      [840, 3, 10],
      [1840, 3, 10],
      [2840, 3, 10],
      [3840, 3, 10],
      [4840, 3, 10]
    ]
  );
});

test('Virtuoso cast-end blade spends retain timeline metadata', () => {
  const rotation = [
    'Phantasmal Disenchanter',
    'Imaginary Inversion',
    { name: 'Bladeturn Requiem', offset: 100 },
    'Mind the Gap',
    'Phantasmal Lancer',
    'Power Spike',
    'Thousand Cuts',
    'Mental Collapse',
    'Mind the Gap',
    'Swap Weapons',
    'Phantasmal Berserker',
    'Signet of the Ether',
    'Phantasmal Berserker',
    'Mind Stab',
    'Mirror Blade',
    'Bladesong Harmony',
    'Rain of Swords',
    'Phantasmal Disenchanter',
    'Bladesong Sorrow'
  ];
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES, TRAIT.INFINITE_FORGE],
      selectedSkills: [
        'Signet of the Ether',
        'Phantasmal Disenchanter',
        'Rain of Swords',
        'Mantra of Pain',
        'Thousand Cuts'
      ],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      weaponSet2Primary: 'Spear',
      weaponSet2Secondary: '',
      startingWeaponSet: 2,
      initialResource: 5
    })
  );
  const harmony = result.events.find((event) => event.type === 'marker' && event.name === 'Bladesong Harmony');
  const harmonyAction = result.events.find((event) => event.type === 'action' && event.name === 'Bladesong Harmony');
  const harmonySpend = result.events.find(
    (event) =>
      event.type === 'resource' && event.reason === 'profession mechanic' && event.sourceSkill === 'Bladesong Harmony'
  );
  const timelineSpends = shatterResourceSpends(result);

  assert.equal(result.warnings.length, 0);
  assert.equal(harmony.detail, '5 blades spent');
  assert.equal(harmonySpend.amount, -5);
  assert.equal(harmonySpend.sourceSkill, 'Bladesong Harmony');
  assert.equal(harmonySpend.rotationIndex, 15);
  assert.ok(Math.abs(harmonySpend.at - harmonyAction.fullEndsAt) < 0.00001);
  assert.deepEqual(timelineSpends.get(15), {
    count: 5,
    resource: 'blades',
    sourceSkill: 'Bladesong Harmony'
  });
});

test('Clarity makes only an empowered Mental Collapse a control skill', () => {
  const config = defaultSimulationConfig({
    specialization: 'Virtuoso',
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  });
  const normal = simulateMesmer(['Mental Collapse'], config);
  const empowered = simulateMesmer(['Mind the Gap', 'Mental Collapse'], config);
  const activeNearExpiry = simulateMesmer(
    ['Mind the Gap', { name: '__wait', waitMs: 14999 }, 'Mental Collapse'],
    config
  );
  const expired = simulateMesmer(['Mind the Gap', { name: '__wait', waitMs: 15000 }, 'Mental Collapse'], config);
  const hasMentalCollapseControl = (result) =>
    result.events.some((event) => event.type === 'control' && event.skillName === 'Mental Collapse');

  assert.equal(hasMentalCollapseControl(normal), false);
  assert.equal(hasMentalCollapseControl(empowered), true);
  assert.equal(hasMentalCollapseControl(activeNearExpiry), true);
  assert.equal(hasMentalCollapseControl(expired), false);
});

test('Shackles converts Lancer immobilize into a stun that triggers Syncopate', () => {
  const result = simulateMesmer(
    ['Mind the Gap', 'Phantasmal Lancer', { name: '__wait', waitMs: 6200 }],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialResource: 0,
      selectedTraitIds: [TRAIT.SYNCOPATE],
      relic: 'Shackles'
    })
  );
  const lancerConditions = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillName === 'Phantasmal Lancer' &&
      ['Crippled', 'Immobilized'].includes(event.condition)
  );
  const syncopate = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Syncopate');
  const shackles = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Relic of the Shackles'
  );
  const shacklesStuns = result.events.filter(
    (event) => event.type === 'control' && event.skillName === 'Relic of the Shackles'
  );

  assert.deepEqual(
    lancerConditions.map((event) => [event.condition, event.duration, event.source, event.actorType, event.summonKind]),
    [
      ['Crippled', 3, 'Phantasm', 'summon', 'phantasm'],
      ['Immobilized', 2, 'Phantasm', 'summon', 'phantasm']
    ]
  );
  assert.equal(shackles.length, 1);
  assert.equal(shackles[0].at, lancerConditions[1].at + 5);
  assert.deepEqual(
    shacklesStuns.map((event) => [event.at, event.controlKind, event.duration]),
    [[lancerConditions[1].at + 5, 'stun', 1]]
  );
  assert.equal(syncopate.length, 1);
  assert.equal(syncopate[0].at, shacklesStuns[0].at);
});

test('Signet of the Ether does not generate a clone', () => {
  const result = simulateMesmer(
    ['Signet of the Ether'],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 0
    })
  );

  assert.equal(result.endState.profession.resource, 0);
  assert.equal(
    result.events.some((event) => event.type === 'resource' && event.reason === 'Signet of the Ether'),
    false
  );
});

test('concurrent Continuum Split excludes the still-casting skill from its snapshot', () => {
  const result = simulateMesmer(
    ['Phantasmal Warlock', { name: 'Continuum Split', offset: 100 }, 'Continuum Shift', 'Phantasmal Warlock'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3,
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps[0].end, 840);
  assert.equal(result.steps[1].start, 100);
  assert.equal(result.steps[3].start, result.steps[2].end);
});

test('a cooldown-delayed Continuum Split still excludes a skill that remains in flight', () => {
  const result = simulateMesmer(
    [
      'Continuum Split',
      { name: '__wait', waitMs: 1 },
      'Continuum Shift',
      { name: '__wait', waitMs: 69199 },
      'Phantasmal Swordsman',
      { name: 'Continuum Split', offset: 100 },
      'Continuum Shift',
      'Phantasmal Swordsman'
    ],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3,
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword'
    })
  );
  const delayedSplit = result.steps.find((step) => step.ri === 5);
  const firstSwordsman = result.steps.find((step) => step.ri === 4);
  const restoredSwordsman = result.steps.find((step) => step.ri === 7);

  assert.equal(delayedSplit.start, 70001);
  assert.equal(restoredSwordsman.start, firstSwordsman.end);
});

test('Mind the Gap grants its clone before a concurrent two-clone Continuum Split snapshot', () => {
  const result = simulateMesmer(
    ['Mind the Gap', { name: 'Continuum Split', offset: 580 }, 'Continuum Shift', 'Mind the Gap'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 1,
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );
  const clone = result.events.find((event) => event.type === 'resource' && event.reason === 'Mind the Gap');

  assert.equal(Math.round(clone.at * 1000 - result.steps[0].start), 480);
  assert.deepEqual(shatterResourceSpends(result).get(1), {
    count: 2,
    resource: 'clones',
    sourceSkill: 'Continuum Split'
  });
  assert.equal(result.steps[1].start, 580);
  assert.equal(result.steps[3].start, 600);
});

test('mid-rotation concurrent Continuum Split does not restore expired cooldowns', () => {
  const result = simulateMesmer(
    [
      'Chaos Storm',
      { name: '__wait', waitMs: 14000 },
      'Phantasmal Warlock',
      { name: 'Continuum Split', offset: 100 },
      'Continuum Shift',
      'Chaos Storm'
    ],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3,
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps[3].start, 14580);
  assert.equal(result.steps[5].start, result.steps[4].end);
});
