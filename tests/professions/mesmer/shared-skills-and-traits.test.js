import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { skillBreakdownRows } from '#gw2/app/results/model.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { createCloneAttackScheduler } from '#gw2/professions/mesmer/core/mechanics/illusions/clone-attacks.js';

// Shared Mesmer skills and traits retain their behavior across specializations.
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
      .filter(
        (event) => event.type === 'condition' && event.skillName === 'Bladecall' && event.sourceId === TRAIT.JAGGED_MIND
      )
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
    ['Flying Cutter', 'Flying Cutter', { name: 'Flying Cutter', interruptMs: 320 }, { name: '__wait', waitMs: 1000 }],
    config
  );
  const beforeRelease = simulateMesmer(
    ['Flying Cutter', 'Flying Cutter', { name: 'Flying Cutter', interruptMs: 319 }, { name: '__wait', waitMs: 1000 }],
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

test('clone attacks are scheduled lazily as the timeline advances', () => {
  const state = { clones: [] };
  const damage = [];
  const conditions = [];
  const scheduler = createCloneAttackScheduler({
    state,
    cloneAttacks: {
      Sword: {
        coefficient: 1,
        hits: 1,
        interval: 2,
        weaponStrength: 20,
        conditions: [{ name: 'Bleeding', duration: 1, stacks: 1 }]
      }
    },
    epsilon: 0.0001,
    addDamage: (...args) => damage.push(args),
    addCondition: (...args) => conditions.push(args)
  });

  state.clones.push(
    scheduler.initializeClone({
      id: 1,
      createdAt: 1,
      weapon: 'Sword'
    })
  );

  assert.equal(scheduler.nextAttackAt(), 3);
  assert.equal(damage.length, 0);
  scheduler.scheduleAt(2.9);
  assert.equal(damage.length, 0);
  scheduler.scheduleAt(3);
  assert.equal(damage.length, 1);
  assert.equal(conditions.length, 1);
  assert.equal(scheduler.nextAttackAt(), 5);
});

test("Egotism starts after the target falls below the Mesmer's health percentage", () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Sword',
    secondaryWeapon: '',
    initialResource: 0,
    boons: {
      ...defaults.boons,
      might: 0
    },
    target: {
      ...defaults.target,
      vulnerability: 0,
      health: 3970000
    }
  });
  const rotation = ['Mind Slash', 'Mind Gash'];
  const base = simulateMesmer(rotation, config);
  const egotism = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.EGOTISM]
  });
  const strike = (result, name) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === name).damage;

  assert.equal(strike(egotism, 'Mind Slash'), strike(base, 'Mind Slash'));
  assert.ok(Math.abs(strike(egotism, 'Mind Gash') / strike(base, 'Mind Gash') - 1.1) < 1e-12);
});

test('Master Fencer grants self and allied fury on critical hits with an eight-second ICD', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      'Flying Cutter',
      { name: '__wait', waitMs: 1000 },
      'Flying Cutter',
      { name: '__wait', waitMs: 9000 },
      'Flying Cutter'
    ],
    defaultSimulationConfig({
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      stats: {
        ...defaults.stats,
        precision: 2995
      },
      boons: {
        ...defaults.boons,
        fury: false,
        quickness: false,
        alacrity: false
      },
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter');
  const procs = result.events.filter((event) => event.type === 'proc' && event.name === 'Master Fencer');
  const fury = result.events.filter((event) => event.type === 'buff' && event.skillName === 'Master Fencer');

  assert.equal(hits.length, 3);
  assert.ok(hits.every((event) => event.didCrit === true));
  assert.equal(procs.length, 2);
  assert.equal(procs[0].at, hits[0].at);
  assert.equal(procs[1].at, hits[2].at);
  assert.ok(hits[1].at <= hits[0].at + 8);
  assert.ok(hits[2].at > hits[0].at + 8);
  assert.deepEqual(
    fury
      .filter((event) => event.audience?.recipients === 'self')
      .map((event) => [event.duration, event.resolvedAudience.includesSummons]),
    [
      [8, false],
      [8, false]
    ]
  );
  assert.deepEqual(
    fury
      .filter((event) => event.audience?.recipients === 'party')
      .map((event) => [event.duration, event.resolvedAudience.includesSummons]),
    [
      [4, false],
      [4, false]
    ]
  );

  const openParty = simulateMesmer(
    ['Flying Cutter'],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      initialResource: 2,
      stats: {
        ...defaults.stats,
        precision: 2995
      },
      boons: {
        ...defaults.boons,
        fury: false
      },
      allies: { count: 2, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const openPartyFury = openParty.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Master Fencer' && event.audience?.recipients === 'party'
  );

  assert.equal(openPartyFury.resolvedAudience.includesSummons, true);
  assert.equal(openPartyFury.resolvedAudience.alliedPlayerCount, 2);
  assert.equal(openPartyFury.resolvedAudience.recipientCount, 4);
  assert.equal(openPartyFury.resolvedAudience.companionIds.length, 1);
  assert.ok(openPartyFury.resolvedAudience.companionIds.every((id) => id.startsWith('mesmer.clone:')));

  const isolated = simulateMesmer(
    ['Flying Cutter'],
    defaultSimulationConfig({
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      stats: {
        ...defaults.stats,
        precision: 2995
      },
      boons: {
        ...defaults.boons,
        fury: false
      },
      sharePlayerBoonsWithSummons: false,
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const isolatedFury = isolated.events.filter((event) => event.type === 'buff' && event.skillName === 'Master Fencer');

  assert.equal(isolatedFury.length, 2);
  assert.equal(
    isolatedFury.find((event) => event.audience?.recipients === 'self')?.resolvedAudience.includesSummons,
    false
  );
  assert.equal(
    isolatedFury.find((event) => event.audience?.recipients === 'party')?.resolvedAudience.includesSummons,
    false
  );
});

test('Sharper Images samples illusion criticals instead of accumulating expected procs', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Core',
    selectedTraitIds: [TRAIT.SHARPER_IMAGES],
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    stats: {
      ...defaults.stats,
      precision: 1945
    },
    boons: {
      ...defaults.boons,
      fury: false
    }
  });
  const result = simulateMesmer(['Phantasmal Duelist', { name: '__wait', waitMs: 4000 }], {
    ...config,
    randomness: { mode: 'stochastic', seed: 91 }
  });
  const illusionHits = result.events.filter((event) => event.type === 'damage' && event.source === 'Phantasm');
  const criticals = illusionHits.filter((event) => event.didCrit).length;
  const sharperImages = result.events.filter(
    (event) => event.type === 'condition' && event.name.includes('Sharper Images')
  );

  assert.ok(illusionHits.length > 1);
  assert.ok(criticals > 0 && criticals < illusionHits.length);
  assert.equal(sharperImages.length, criticals);
  assert.ok(sharperImages.every((event) => event.stacks === 1));
});

test('Egotism does not increase condition damage', () => {
  const defaults = defaultSimulationConfig();
  const run = (selectedTraitIds) =>
    simulateMesmer(
      ['Phantasmal Swordsman', { name: '__wait', waitMs: 6000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Sword',
        secondaryWeapon: '',
        initialResource: 0,
        selectedTraitIds: [TRAIT.SHARPER_IMAGES, ...selectedTraitIds],
        target: {
          ...defaults.target,
          health: 3970000
        }
      })
    );
  const bleeding = (result) => result.conditionBreakdown.find((entry) => entry.name === 'Bleeding')?.damage || 0;

  assert.equal(bleeding(run([TRAIT.EGOTISM])), bleeding(run([])));
});
