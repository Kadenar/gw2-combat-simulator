import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { skillBreakdownRows } from '#gw2/app/results/model.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { toApplicationBuild } from '#gw2/professions/mesmer/build/build.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';

// Mesmer conditions and relic interactions retain skill, trait, and illusion behavior.
test('condition-bearing clone autoattacks apply their damaging conditions', () => {
  const axe = simulateMesmer(
    ['Mirror Images', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedSkills: ['Mirror Images'],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const axeConditions = axe.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName.startsWith('Clone: ')
  );

  assert.ok(axeConditions.length > 0);
  assert.deepEqual([...new Set(axeConditions.map((event) => `${event.condition}:${event.duration}`))].sort(), [
    'Bleeding:1',
    'Torment:1'
  ]);
  assert.ok(axeConditions.every((event) => event.stacks === 1));
  const axeHits = axe.events.filter((event) => event.type === 'damage' && event.skillName === 'Clone: Lacerating Chop');

  assert.deepEqual([...new Set(axeHits.map((event) => Number(event.at.toFixed(3))))], [1.72, 3.28, 4.84]);
  assert.ok(
    !axe.events.some(
      (event) => event.skillName === 'Clone: Ethereal Chop' || event.skillName === 'Clone: Mirror Strikes'
    )
  );

  const staff = simulateMesmer(
    ['Phase Retreat', { name: '__wait', waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const staffConditions = staff.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Clone: Winds of Chaos'
  );

  assert.equal(staffConditions.length, 2);
  assert.ok(staffConditions.some((event) => event.condition === 'Torment' && event.duration === 2));
  assert.ok(staffConditions.some((event) => event.condition === 'Confusion' && event.duration === 2));
  const staffHits = staff.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Clone: Winds of Chaos'
  );

  assert.equal(
    staffHits.reduce((sum, event) => sum + event.hits, 0),
    2
  );

  const scepter = simulateMesmer(
    ['Mirror Images', { name: '__wait', waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedSkills: ['Mirror Images'],
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const scepterTorment = scepter.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Clone: Ether Bolt' && event.condition === 'Torment'
  );

  assert.equal(scepterTorment.length, 2);
  assert.ok(scepterTorment.every((event) => event.duration === 4));
});

test('Mirror Strikes applies Bleeding and Torment once across its two hits', () => {
  const result = simulateMesmer(
    ['Lacerating Chop', 'Ethereal Chop', 'Mirror Strikes', { name: '__wait', waitMs: 7000 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      selectedTraitIds: []
    })
  );
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Mirror Strikes'
  );

  assert.equal(
    strikes.reduce((sum, event) => sum + event.hits, 0),
    2
  );
  const conditions = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Mirror Strikes'
  );

  assert.deepEqual(conditions.map((event) => `${event.condition}:${event.stacks}:${event.duration}`).sort(), [
    'Bleeding:1:6',
    'Torment:1:6'
  ]);
});

test('axe clone attacks and Axes of Symmetry use cast-start snapshots', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    selectedSkills: ['Mirror Images'],
    selectedTraitIds: [],
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Torch',
    initialResource: 0
  });
  const existingClones = simulateMesmer(
    ['Mirror Images', { name: '__wait', waitMs: 1 }, { name: 'Axes of Symmetry', skillId: ID.AXES_OF_SYMMETRY }],
    config
  );
  const axesStep = existingClones.steps.find((step) => step.skill === 'Axes of Symmetry');
  const axesStart = axesStep.start / 1000;
  const playerHit = existingClones.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Axes of Symmetry' && event.actorType === 'player'
  );
  const cloneHits = existingClones.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name.includes('Axes of Symmetry') && event.source === 'Clone'
  );
  const cloneConfusion = existingClones.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Axes of Symmetry' && event.source === 'Clone'
  );

  assert.equal(axesStep.end - axesStep.start, 1000);
  assert.equal(Math.round((playerHit.at - axesStart) * 1000), 920);
  assert.deepEqual(
    cloneHits.map((event) => Math.round((event.at - axesStart) * 1000)),
    [960, 960]
  );
  assert.ok(cloneHits.every((event) => event.coefficient === 1.75 && event.weaponStrength === 28.5));
  assert.equal(cloneConfusion.length, 2);
  assert.ok(cloneConfusion.every((event) => event.stacks === 1 && event.duration === 6));
  const playerConfusion = existingClones.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Axes of Symmetry' && event.actorType === 'player'
  );

  assert.equal(playerConfusion.stacks, 5);
  assert.equal(playerConfusion.duration, 6);

  const spawnedDuringCast = simulateMesmer(
    [
      { name: 'Lingering Thoughts', skillId: ID.LINGERING_THOUGHTS },
      { name: 'Axes of Symmetry', skillId: ID.AXES_OF_SYMMETRY }
    ],
    config
  );

  assert.equal(
    spawnedDuringCast.resolvedEvents.some(
      (event) => event.type === 'damage' && event.name.includes('Axes of Symmetry') && event.source === 'Clone'
    ),
    false
  );
});

test('Axes of Symmetry registers clone packets before a later overlapping action', () => {
  const result = simulateMesmer(
    [
      'Mirror Images',
      { name: '__wait', waitMs: 1 },
      { name: 'Axes of Symmetry', skillId: ID.AXES_OF_SYMMETRY },
      { name: 'Signet of Midnight', offset: 970 }
    ],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedSkills: ['Mirror Images', 'Signet of Midnight'],
      selectedTraitIds: [],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );
  const cloneHits = result.events.filter(
    (event) => event.type === 'damage' && event.name.includes('Axes of Symmetry') && event.source === 'Clone'
  );
  const overlappingAction = result.events.find(
    (event) => event.type === 'action' && event.skillName === 'Signet of Midnight'
  );

  assert.equal(cloneHits.length, 2);
  assert.ok(cloneHits.every((event) => event.at < overlappingAction.at));
  assert.ok(cloneHits.every((event) => event.eventOrder < overlappingAction.eventOrder));
});

test('Imaginary Axes lands 360ms from cast start with two 3-stack torment hits', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', { name: 'Imaginary Axes', skillId: ID.IMAGINARY_AXES }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );
  const step = result.steps[1];
  const strike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Imaginary Axes' && event.source === 'Player'
  );
  const torment = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Imaginary Axes' && event.source === 'Player'
  );

  assert.equal(step.end - step.start, 440);
  assert.equal(Math.round((strike.at - step.start / 1000) * 1000), 360);
  assert.equal(torment.length, 2);
  assert.ok(torment.every((event) => event.at === strike.at));
  assert.ok(torment.every((event) => event.stacks === 3 && event.duration === 3.5));
});

test('destroyed clones do not apply prescheduled autoattack conditions', () => {
  const result = simulateMesmer(
    ['Phase Retreat', 'Mind Wrack', { name: '__wait', waitMs: 2500 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0
    })
  );

  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'condition' && event.skillName === 'Clone: Winds of Chaos'),
    false
  );
});

test('Ineptitude applies confusion for each direct blind on a normal target', () => {
  const result = simulateMesmer(
    ['Chaos Armor', 'Signet of Midnight', { name: '__wait', waitMs: 100 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.INEPTITUDE],
      selectedSkills: ['Signet of Midnight'],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const ineptitude = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name.endsWith('— Ineptitude')
  );

  assert.equal(ineptitude.length, 2);
  assert.equal(ineptitude[0].skillName, 'Chaos Armor');
  assert.equal(ineptitude[0].condition, 'Confusion');
  assert.equal(ineptitude[0].duration, 5);
  assert.equal(ineptitude[0].stacks, 2);
  assert.equal(ineptitude[1].skillName, 'Signet of Midnight');
});

test('Ineptitude direct blinds ignore the defiant-target interval', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Chaos Armor', 'Signet of Midnight', { name: '__wait', waitMs: 100 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.INEPTITUDE],
      selectedSkills: ['Signet of Midnight'],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0,
      target: {
        ...defaults.target,
        defiant: true
      }
    })
  );
  const ineptitude = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name.includes('Ineptitude')
  );

  assert.equal(ineptitude.length, 2);
});

test('Ineptitude intervals only interrupt-generated blinds on defiant targets', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Magic Bullet', 'Signet of Humility'],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.INEPTITUDE],
      selectedSkills: ['Signet of Humility'],
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0,
      target: {
        ...defaults.target,
        defiant: true,
        activatingSkills: true
      }
    })
  );
  const ineptitude = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name.includes('Ineptitude')
  );

  assert.deepEqual(
    ineptitude.map((event) => event.skillName),
    ['Magic Bullet']
  );
});

test('condition Chronomancer preset retains multi-hit Ineptitude', () => {
  const saved = JSON.parse(
    readFileSync(new URL('../../../data/gw2/builds/mesmer/b-condi-chronomancer.json', import.meta.url), 'utf8')
  );
  const build = toApplicationBuild({
    ...saved,
    rotation: ['Mirror Images', 'Rewinder']
  });
  const app = {
    build,
    skillByName: mesmerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  mesmerAppAdapter.recalculate(app);
  const config = mesmerAppAdapter.simulationConfig(app);
  const result = simulateMesmer(build.rotation, config);
  const ineptitude = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Rewinder' && event.name.includes('Ineptitude')
  );

  assert.equal(config.target.defiant, true);
  assert.equal(ineptitude?.stacks, 6);
});

test('Chaos Armor applies three base confusion plus two from Ineptitude', () => {
  const result = simulateMesmer(
    ['Chaos Armor'],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.INEPTITUDE],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const confusion = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Chaos Armor' && event.condition === 'Confusion'
  );

  assert.deepEqual(confusion.map((event) => event.stacks).sort(), [2, 3]);
});

test('Counterspell applies five base confusion plus two from Ineptitude', () => {
  const result = simulateMesmer(
    ['Illusionary Counter', 'Counterspell'],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.INEPTITUDE],
      primaryWeapon: 'Scepter',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const confusion = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Counterspell' && event.condition === 'Confusion'
  );

  assert.deepEqual(confusion.map((event) => event.stacks).sort(), [2, 5]);
});

test('Signet of Midnight blind applies two confusion from Ineptitude', () => {
  const result = simulateMesmer(
    ['Signet of Midnight'],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.INEPTITUDE],
      selectedSkills: ['Signet of Midnight'],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const confusion = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Signet of Midnight' && event.condition === 'Confusion'
  );

  assert.deepEqual(
    confusion.map((event) => event.stacks),
    [2]
  );
});

test('Signet of Midnight expertise is inactive while recharging', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Confusing Images', 'Signet of Midnight', 'Confusing Images', 'Confusing Images'],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedSkills: ['Signet of Midnight'],
      primaryWeapon: 'Scepter',
      secondaryWeapon: '',
      stats: {
        ...defaults.stats,
        expertise: 180
      },
      boons: {
        ...defaults.boons,
        quickness: false,
        alacrity: false
      }
    })
  );
  const applications = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Confusing Images'
  );

  assert.equal(applications.length, 21);
  assert.ok(applications.slice(0, 7).every((event) => Math.abs(event.effectiveDuration - 7.84) < 1e-12));
  assert.ok(applications.slice(7, 14).every((event) => event.effectiveDuration === 7));
  assert.ok(applications.slice(14).every((event) => Math.abs(event.effectiveDuration - 7.84) < 1e-12));
});

test('Continuum Shift restores Signet of Midnight passive expertise', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Continuum Split', 'Signet of Midnight', 'Continuum Shift', 'Confusing Images'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedSkills: ['Signet of Midnight'],
      selectedTraitIds: [TRAIT.MALICIOUS_SORCERY],
      primaryWeapon: 'Scepter',
      secondaryWeapon: '',
      initialResource: 3,
      stats: {
        ...defaults.stats,
        expertise: 180
      },
      boons: {
        ...defaults.boons,
        quickness: false,
        alacrity: false
      }
    })
  );
  const application = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Confusing Images'
  );

  assert.equal(application.effectiveDuration, 9.59);
});

test('Ineptitude treats control as an interrupt only for an activating target', () => {
  const defaults = defaultSimulationConfig();
  const config = {
    specialization: 'Core',
    selectedTraitIds: [TRAIT.INEPTITUDE],
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    initialResource: 0
  };
  const idle = simulateMesmer(
    ['Magic Bullet', { name: '__wait', waitMs: 100 }],
    defaultSimulationConfig({
      ...config,
      target: {
        ...defaults.target,
        activatingSkills: false,
        confusionActivationsPerSecond: 0
      }
    })
  );
  const active = simulateMesmer(
    ['Magic Bullet', { name: '__wait', waitMs: 100 }],
    defaultSimulationConfig({
      ...config,
      target: {
        ...defaults.target,
        activatingSkills: true,
        confusionActivationsPerSecond: 1
      }
    })
  );
  const ineptitudeEvents = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.name.endsWith('— Ineptitude'));

  assert.equal(ineptitudeEvents(idle).length, 0);
  assert.equal(ineptitudeEvents(active).length, 1);
  assert.equal(ineptitudeEvents(active)[0].stacks, 2);
});

test('Blinding Dissipation triggers Ineptitude once per Rewinder strike', () => {
  const result = simulateMesmer(
    ['Mirror Images', 'Rewinder'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.BLINDING_DISSIPATION, TRAIT.INEPTITUDE],
      selectedSkills: ['Mirror Images'],
      initialResource: 0
    })
  );
  const ineptitude = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Rewinder' && event.name.includes('Ineptitude')
  );

  // The mesmer and two clones each strike and blind.
  assert.equal(ineptitude.stacks, 6);
});

test('player control skills retain ownership and trigger Relic of the Claw', () => {
  const cases = [
    {
      skillName: 'Time Sink',
      skillId: ID.TIME_SINK,
      rotation: ['Time Sink'],
      config: {
        specialization: 'Chronomancer',
        initialResource: 3
      }
    },
    {
      skillName: 'Illusionary Wave',
      skillId: ID.ILLUSIONARY_WAVE,
      rotation: ['Illusionary Wave'],
      config: {
        specialization: 'Core',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: ''
      }
    },
    {
      skillName: 'Counter Blade',
      skillId: ID.COUNTER_BLADE,
      rotation: ['Illusionary Riposte', 'Counter Blade'],
      config: {
        specialization: 'Core',
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword'
      }
    }
  ];

  for (const testCase of cases) {
    const result = simulateMesmer(
      testCase.rotation,
      defaultSimulationConfig({
        ...testCase.config,
        relic: 'Claw',
        initialResource: testCase.config.initialResource ?? 0
      })
    );
    const control = result.events.find((event) => event.type === 'control' && event.skillId === testCase.skillId);

    assert.deepEqual(
      {
        source: control?.source,
        sourceId: control?.sourceId,
        actorType: control?.actorType
      },
      {
        source: 'Player',
        sourceId: testCase.skillId,
        actorType: 'player'
      },
      testCase.skillName
    );
    assert.equal(
      result.procSteps.some((proc) => proc.skill === 'Relic of the Claw' && proc.sourceSkill === testCase.skillName),
      true,
      testCase.skillName
    );
  }
});

test('Danger Time buffs phantasms while Claw and Time Bomb remain player-only', () => {
  const rotation = ['Time Sink', 'Phantasmal Swordsman', { name: '__wait', waitMs: 6000 }];
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    selectedTraitIds: [],
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    initialResource: 3,
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const base = simulateMesmer(rotation, config);
  const dangerTime = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.DANGER_TIME]
  });
  const timeBomb = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.TIME_BOMB]
  });
  const claw = simulateMesmer(rotation, { ...config, relic: 'Claw' });
  const strikeDamage = (result, actorType, summonKind = '') =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === 'damage' &&
          event.skillName === 'Phantasmal Swordsman' &&
          event.actorType === actorType &&
          (!summonKind || event.summonKind === summonKind)
      )
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(strikeDamage(dangerTime, 'player') > strikeDamage(base, 'player'));
  assert.ok(strikeDamage(dangerTime, 'summon', 'phantasm') > strikeDamage(base, 'summon', 'phantasm'));
  assert.ok(Math.abs(strikeDamage(claw, 'player') / strikeDamage(base, 'player') - 1.07) < 1e-12);
  assert.equal(strikeDamage(claw, 'summon', 'phantasm'), strikeDamage(base, 'summon', 'phantasm'));
  assert.ok(Math.abs(strikeDamage(timeBomb, 'player') / strikeDamage(base, 'player') - 1.1) < 1e-12);
  assert.equal(strikeDamage(timeBomb, 'summon', 'phantasm'), strikeDamage(base, 'summon', 'phantasm'));
  const timeBombBuff = timeBomb.events.find((event) => event.type === 'buff' && event.kind === 'time-bomb');
  const explosion = timeBomb.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Time Bomb');

  assert.equal(explosion.coefficient, 3);
  assert.equal(explosion.source, 'Player');
  assert.ok(explosion.at < timeBombBuff.at + timeBombBuff.duration);

  const rows = skillBreakdownRows(dangerTime);
  const playerRow = rows.find((row) => row.name === 'Phantasmal Swordsman' && row.group === 'Player');
  const entityRows = rows.filter((row) => row.parentSkill === 'Phantasmal Swordsman');

  assert.deepEqual(entityRows.map((row) => row.name).sort(), ['Blurred Frenzy', 'Sword Attack']);
  assert.ok(Math.abs(playerRow.strike - strikeDamage(dangerTime, 'player')) < 1e-9);
  assert.ok(
    Math.abs(entityRows.reduce((sum, row) => sum + row.strike, 0) - strikeDamage(dangerTime, 'summon', 'phantasm')) <
      1e-9
  );
});

test('Relic of Fireworks triggers on Virtuoso bladesongs', () => {
  const fireworks = simulateMesmer(
    ['Bladesong Sorrow', { name: '__wait', waitMs: 12000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      relic: 'Fireworks',
      initialResource: 5
    })
  );
  const procs = fireworks.procSteps.filter((proc) => proc.skill === 'Relic of Fireworks');

  assert.ok(procs.length > 0);
  assert.ok(procs.every((proc) => proc.sourceSkill === 'Bladesong Sorrow'));
});

test("Relic of Fireworks triggers on Distortion's 0-damage shatter", () => {
  const fireworks = simulateMesmer(
    ['Distortion', { name: '__wait', waitMs: 12000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      relic: 'Fireworks',
      initialResource: 3
    })
  );
  const procs = fireworks.procSteps.filter((proc) => proc.skill === 'Relic of Fireworks');

  assert.ok(procs.length > 0);
  assert.ok(procs.every((proc) => proc.sourceSkill === 'Distortion'));
});

test('Virtuoso Deadly Blades vulnerability triggers Relic of Aristocracy', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Bladecall', { name: '__wait', waitMs: 2000 }],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      selectedTraitIds: [TRAIT.DEADLY_BLADES],
      relic: 'Aristocracy',
      initialResource: 0,
      stats: {
        ...defaults.stats,
        precision: 4000
      }
    })
  );
  const vulnerability = result.events.filter(
    (event) =>
      event.type === 'condition' && event.condition === 'Vulnerability' && event.sourceId === TRAIT.DEADLY_BLADES
  );
  const aristocracy = result.procSteps.filter((proc) => proc.skill === 'Relic of Aristocracy');

  assert.equal(vulnerability.length, 3);
  assert.equal(
    vulnerability.every((event) => event.stacks === 1),
    true
  );
  assert.deepEqual(
    aristocracy.map((proc) => ({
      sourceSkill: proc.sourceSkill,
      detail: proc.detail
    })),
    [{ sourceSkill: 'Bladecall', detail: '1/5 stacks' }]
  );
});

test('Relic of Peitha triggers from Mesmer shadowsteps', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Staff',
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const rotation = [
    'Phase Retreat',
    { name: '__wait', waitMs: 900 },
    'Winds of Chaos',
    { name: '__wait', waitMs: 8000 }
  ];
  const base = simulateMesmer(rotation, config);
  const equipped = simulateMesmer(rotation, { ...config, relic: 'Peitha' });
  const damage = (result) =>
    result.breakdown
      .filter((entry) => entry.sourceSkill === 'Winds of Chaos')
      .reduce((total, entry) => total + entry.strikeDamage, 0);

  assert.ok(Math.abs(damage(equipped) / damage(base) - 1.1) < 1e-12);
  assert.ok(
    equipped.breakdown.some((entry) => entry.name === 'Relic of Peitha — Torment' && entry.conditionDamage > 0)
  );
  assert.ok(
    equipped.procSteps.some(
      (proc) => proc.type === 'relic_proc' && proc.skill === 'Relic of Peitha' && proc.sourceSkill === 'Phase Retreat'
    )
  );
});

test('Relic of Peitha does not grant its player damage bonus to phantasms', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    selectedTraitIds: [],
    initialResource: 0,
    primaryWeapon: 'Staff',
    secondaryWeapon: 'Staff',
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const rotation = [
    'Phase Retreat',
    { name: '__wait', waitMs: 900 },
    'Phantasmal Warlock',
    { name: '__wait', waitMs: 4000 }
  ];
  const base = simulateMesmer(rotation, config);
  const equipped = simulateMesmer(rotation, { ...config, relic: 'Peitha' });
  const phantasmDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === 'damage' && event.skillName === 'Phantasmal Warlock' && event.source === 'Phantasm'
      )
      .reduce((sum, event) => sum + event.damage, 0);

  assert.equal(phantasmDamage(equipped), phantasmDamage(base));
});

test('Relic of Thorns uses the deterministic incoming-hit assumption', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    relic: '',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Pistol',
    modifiers: { strike: 1, condition: 1 }
  });
  const rotation = [{ name: '__wait', waitMs: 3100 }, 'Phantasmal Duelist', { name: '__wait', waitMs: 5000 }];
  const base = simulateMesmer(rotation, config);
  const equipped = simulateMesmer(rotation, { ...config, relic: 'Thorns' });

  assert.ok(equipped.conditionDamage > base.conditionDamage);
  assert.deepEqual(
    equipped.procSteps.filter((proc) => proc.skill === 'Relic of Thorns').map((proc) => proc.start),
    [3000, 8000]
  );

  // Mesmer uses the shared relic bonus once, including configured opening stacks.
  const queryConfig = defaultSimulationConfig({ boons: {}, relic: 'Thorns', initialThornsStacks: 5 });
  const query = createGw2CombatQuery({
    profession: resolveProfessionRuntime(mesmerProfession, queryConfig),
    config: queryConfig
  });
  assert.equal(query.statsAt(0).conditionDamage, 1150);
  assert.equal(query.statsAt(3).conditionDamage, 1180);
});
