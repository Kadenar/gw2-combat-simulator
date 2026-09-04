import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { eventLogCsv } from '#gw2/app/presentation/results/event-log-view.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { resolveProfessionRuntime } from '#gw2/platform/engine/profession/family.js';
import { formatTimelineCastDetails } from '#gw2/app/rotation/timeline/model.js';
import { moveRotationEntry } from '#gw2/app/rotation/editing/operations.js';
import { skillBreakdownRows } from '#gw2/app/rotation/result/model.js';
import { timelineWeaponRowGroups, timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { simulationEventLogRows } from '#gw2/app/rotation/result/simulation-event-log.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { toApplicationBuild } from '#gw2/professions/mesmer/build/build.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';

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

test('stationary torment uses the current PvE formula', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Ether Bolt', { name: '__wait', waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0,
      stats: {
        ...defaults.stats,
        conditionDamage: 1000,
        expertise: 0
      },
      boons: {
        ...defaults.boons,
        might: 0
      },
      target: {
        ...defaults.target,
        conditions: { ...defaults.target.conditions, Vulnerability: 0 },
        vulnerability: 0,
        moving: false,
        activatingSkills: false,
        confusionActivationsPerSecond: 0
      }
    })
  );
  const torment = result.resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Torment');

  assert.ok(Math.abs(torment.damage - 121.8) < 1e-9);
});

test('static and condition-specific duration bonuses reach the resolver', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Ether Bolt', { name: '__wait', waitMs: 2000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0,
      stats: {
        ...defaults.stats,
        expertise: 0,
        conditionDurationBonus: 25,
        conditionDurationBonuses: { Torment: 25 }
      }
    })
  );
  const torment = result.resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Torment');

  assert.equal(torment.effectiveDuration, 6);
});

test('target skill activations add the current PvE confusion activation damage', () => {
  const defaults = defaultSimulationConfig();
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    initialResource: 0,
    stats: {
      ...defaults.stats,
      conditionDamage: 1000,
      expertise: 0
    },
    boons: {
      ...defaults.boons,
      might: 0
    }
  };
  const resultAt = (confusionActivationsPerSecond) =>
    simulateMesmer(
      ['Confusing Images', { name: '__wait', waitMs: 1000 }],
      defaultSimulationConfig({
        ...config,
        target: {
          ...defaults.target,
          conditions: { ...defaults.target.conditions, Vulnerability: 0 },
          vulnerability: 0,
          activatingSkills: confusionActivationsPerSecond > 0,
          confusionActivationsPerSecond
        }
      })
    );
  const base = resultAt(0);
  const active = resultAt(1);
  const confusionDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.condition === 'Confusion')
      .reduce((sum, event) => sum + event.damage, 0);
  const stackSeconds = base.resolvedEvents
    .filter((event) => event.type === 'condition' && event.condition === 'Confusion')
    .reduce((sum, event) => sum + event.damagingStackSeconds, 0);
  const activationDamage = confusionDamage(active) - confusionDamage(base);

  assert.ok(Math.abs(activationDamage - stackSeconds * (16.24 + 0.0325 * 1000)) < 1e-9);
});

test('event log distinguishes phantasm summon, attack, and clone conversion', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 7000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const log = simulationEventLogRows(result, null, mesmerProfession);

  assert.ok(
    log.some(
      (event) => Math.abs(event.at - 0.56) < 0.00001 && event.description === 'PHANTASM SUMMONED Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 2.79) < 0.00001 && event.description === 'PHANTASM DAMAGE COMPLETE Phantasmal Duelist x1'
    )
  );
  assert.ok(
    log.some(
      (event) =>
        Math.abs(event.at - 3.3601) < 0.00001 &&
        event.description.includes('CLONE SPAWNED x1') &&
        event.description.includes('Phantasmal Duelist phantasm conversion')
    )
  );
  assert.match(eventLogCsv(log), /Phantasmal Duelist phantasm conversion/);
});

test('configured Virtuoso bladesongs spend blades at cast end', () => {
  for (const skillName of ['Bladesong Harmony', 'Bladesong Sorrow', 'Bladesong Dissonance', 'Bladeturn Requiem']) {
    const result = simulateMesmer([skillName], defaultSimulationConfig({ initialResource: 5 }));
    const action = result.events.find((event) => event.type === 'action' && event.name === skillName);
    const spend = result.events.find((event) => event.type === 'resource' && event.sourceSkill === skillName);

    assert.equal(result.endState.profession.resource, 0);
    assert.equal(spend.amount, -5);
    assert.equal(spend.rotationIndex, 0);
    assert.ok(Math.abs(spend.at - action.fullEndsAt) < 0.00001, `${skillName} spent blades before cast end`);
  }
});

test('Bladeturn Requiem and Thousand Cuts retain their zero-second cast times', () => {
  for (const skillName of ['Bladeturn Requiem', 'Thousand Cuts']) {
    const result = simulateMesmer([skillName], defaultSimulationConfig({ initialResource: 5 }));
    const step = result.steps[0];
    const action = result.events.find((event) => event.type === 'action' && event.name === skillName);

    assert.equal(step.start, step.end);
    assert.equal(step.fullCastMs, 0);
    assert.equal(action.at, action.endsAt);
    assert.equal(action.at, action.fullEndsAt);
    assert.match(
      formatTimelineCastDetails(step, (time) => `${(time / 1000).toFixed(2)}s`),
      /Cast time: 0\.000s$/
    );
  }
});

test('interrupting a bladesong restores its reserved blades', () => {
  const result = simulateMesmer(
    [{ name: 'Bladesong Harmony', interruptMs: 100 }],
    defaultSimulationConfig({ initialResource: 5 })
  );

  assert.equal(result.endState.profession.resource, 5);
  assert.equal(
    result.events.some(
      (event) => event.type === 'resource' && event.sourceSkill === 'Bladesong Harmony' && event.amount < 0
    ),
    false
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Bladesong Harmony'),
    false
  );
});

test('sigil and relic damage modifiers affect the queued rotation result', () => {
  const config = defaultSimulationConfig();
  const base = simulateMesmer(['Bladecall', 'Unstable Bladestorm'], {
    ...config,
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const equipped = simulateMesmer(['Bladecall', 'Unstable Bladestorm'], {
    ...config,
    relic: 'Thief',
    modifiers: { strike: 1.05, condition: 1 }
  });

  assert.ok(equipped.totalDamage > base.totalDamage * 1.05);
});

test('weapon swaps activate only the equipped set damage sigils', () => {
  const config = defaultSimulationConfig({
    relic: '',
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const rotation = ['Bladecall', 'Swap Weapons', 'Psycut'];
  const base = simulateMesmer(rotation, config);
  const equipped = simulateMesmer(rotation, {
    ...config,
    sigilSets: [
      { strike: 1.05, condition: 1 },
      { strike: 1, condition: 1 }
    ]
  });
  const strike = (result, name) =>
    result.breakdown
      .filter((entry) => entry.sourceSkill === name)
      .reduce((total, entry) => total + entry.strikeDamage, 0);

  assert.ok(Math.abs(strike(equipped, 'Bladecall') / strike(base, 'Bladecall') - 1.05) < 1e-12);
  assert.ok(Math.abs(strike(equipped, 'Psycut') / strike(base, 'Psycut') - 1) < 1e-12);
});

test('weapon swaps activate only the equipped set duration sigils', () => {
  const result = simulateMesmer(
    ['Confusing Images', 'Swap Weapons', 'Confusing Images', { name: '__wait', waitMs: 10000 }],
    defaultSimulationConfig({
      relic: '',
      selectedTraitIds: [],
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword',
      weaponSet2Primary: 'Scepter',
      weaponSet2Secondary: 'Sword',
      stats: { expertise: 0 },
      sigilSets: [
        {
          strike: 1,
          condition: 1,
          conditionDurationBonus: 10
        },
        {
          strike: 1,
          condition: 1,
          conditionDurationBonus: 0
        }
      ]
    })
  );
  const applications = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Confusing Images'
  );

  assert.equal(applications.length, 14);
  assert.ok(applications.slice(0, 7).every((application) => Math.abs(application.effectiveDuration - 7.7) < 1e-12));
  assert.ok(applications.slice(7).every((application) => Math.abs(application.effectiveDuration - 7) < 1e-12));
});

test('Relic of the Claw buffs strikes after a control skill for eight seconds', () => {
  const config = defaultSimulationConfig({
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const base = simulateMesmer(['Bladesong Dissonance', 'Bladecall'], config);
  const equipped = simulateMesmer(['Bladesong Dissonance', 'Bladecall'], {
    ...config,
    relic: 'Claw'
  });
  const damage = (result, name) =>
    result.breakdown
      .filter((entry) => entry.sourceSkill === name)
      .reduce((total, entry) => total + entry.strikeDamage, 0);

  assert.equal(damage(equipped, 'Bladesong Dissonance'), damage(base, 'Bladesong Dissonance'));
  assert.ok(Math.abs(damage(equipped, 'Bladecall') / damage(base, 'Bladecall') - 1.07) < 1e-12);
  assert.ok(
    equipped.procSteps.some(
      (proc) =>
        proc.type === 'relic_proc' &&
        proc.skill === 'Relic of the Claw' &&
        proc.sourceSkill === 'Bladesong Dissonance' &&
        proc.detail === 'activated'
    )
  );
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

test('Split Second shatter traits affect only the first strike from each source', () => {
  const rotation = ['Split Second', { name: '__wait', waitMs: 2000 }];
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    initialResource: 3,
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const baseline = simulateMesmer(rotation, config);
  const timeCatchesUp = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.TIME_CATCHES_UP]
  });
  const mentalAnguish = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.MENTAL_ANGUISH]
  });
  const maim = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED]
  });
  const packets = (result) =>
    Object.values(
      result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === 'Split Second')
        .reduce((groups, event) => {
          groups[event.at] ||= { at: event.at, damage: 0, traitEligible: Boolean(event.shatterTraitEligible) };
          groups[event.at].damage += event.damage;
          return groups;
        }, {})
    ).sort((left, right) => left.at - right.at);
  const baselinePackets = packets(baseline);
  const timeCatchesUpPackets = packets(timeCatchesUp);
  const mentalAnguishPackets = packets(mentalAnguish);
  const torment = maim.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Split Second' && event.condition === 'Torment'
  );

  assert.deepEqual(
    baselinePackets.map((packet) => ({ at: packet.at, traitEligible: packet.traitEligible })),
    [
      { at: 0, traitEligible: true },
      { at: 1, traitEligible: false }
    ]
  );
  assert.ok(Math.abs(timeCatchesUpPackets[0].damage / baselinePackets[0].damage - 1.1) < 1e-12);
  assert.equal(timeCatchesUpPackets[1].damage, baselinePackets[1].damage);
  assert.ok(Math.abs(mentalAnguishPackets[0].damage / baselinePackets[0].damage - 1.25) < 1e-12);
  assert.equal(mentalAnguishPackets[1].damage, baselinePackets[1].damage);
  assert.equal(torment.length, 1);
  assert.equal(torment[0].at, baselinePackets[0].at);
  assert.equal(torment[0].stacks, 4);
  assert.equal(torment[0].shatterTraitEligible, true);
});

test('Relic of the Claw can trigger from a non-damaging control skill and expires', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    relic: 'Claw',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    modifiers: { strike: 1, condition: 1 }
  });
  const active = simulateMesmer(['Signet of Domination', 'Mind Slash'], config);
  const expired = simulateMesmer(['Signet of Domination', { name: '__wait', waitMs: 8001 }, 'Mind Slash'], config);
  const strikeDamage = (result) =>
    result.breakdown
      .filter((entry) => entry.sourceSkill === 'Mind Slash')
      .reduce((total, entry) => total + entry.strikeDamage, 0);
  const activeDamage = strikeDamage(active);
  const expiredDamage = strikeDamage(expired);

  assert.ok(Math.abs(activeDamage / expiredDamage - 1.07) < 1e-12);
});

test('Relic of the Claw records activation and refresh procs', () => {
  const claw = simulateMesmer(
    ['Signet of Domination', 'Diversion', { name: '__wait', waitMs: 8001 }, 'Signet of Domination'],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 3,
      relic: 'Claw'
    })
  );

  assert.deepEqual(
    claw.procSteps
      .filter((proc) => proc.skill === 'Relic of the Claw')
      .map((proc) => ({
        sourceSkill: proc.sourceSkill,
        detail: proc.detail,
        durationMs: proc.expiresAt - proc.start
      })),
    [
      { sourceSkill: 'Signet of Domination', detail: 'activated', durationMs: 8000 },
      { sourceSkill: 'Diversion', detail: 'refreshed', durationMs: 8000 },
      { sourceSkill: 'Signet of Domination', detail: 'activated', durationMs: 8000 }
    ]
  );
});

test('Relic of Fireworks records activation and refresh procs', () => {
  const fireworks = simulateMesmer(
    ['Chaos Storm', 'Swap Weapons', 'Phantasmal Mage'],
    defaultSimulationConfig({
      specialization: 'Core',
      relic: 'Fireworks',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      weaponSet2Primary: 'Sword',
      weaponSet2Secondary: 'Torch'
    })
  );

  assert.deepEqual(
    fireworks.procSteps
      .filter((proc) => proc.skill === 'Relic of Fireworks')
      .map((proc) => ({
        sourceSkill: proc.sourceSkill,
        detail: proc.detail,
        durationMs: proc.expiresAt - proc.start
      })),
    [
      { sourceSkill: 'Chaos Storm', detail: 'activated', durationMs: 6000 },
      { sourceSkill: 'Phantasmal Mage', detail: 'refreshed', durationMs: 6000 }
    ]
  );
});

test('Relic of Fireworks ignores non-weapon skills with qualifying cooldowns', () => {
  const fireworks = simulateMesmer(
    ['Well of Calamity'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      relic: 'Fireworks'
    })
  );

  assert.equal(
    fireworks.procSteps.some((proc) => proc.skill === 'Relic of Fireworks'),
    false
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

test('Relic of Akeem triggers on control against five confusion stacks', () => {
  const result = simulateMesmer(
    ['Bladesong Sorrow', 'Bladecall', 'Bladesong Dissonance', { name: '__wait', waitMs: 12000 }],
    defaultSimulationConfig({
      relic: 'Akeem',
      initialResource: 5,
      modifiers: { strike: 1, condition: 1 }
    })
  );

  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.type === 'relic_proc' && proc.skill === 'Relic of Akeem' && proc.sourceSkill === 'Bladesong Dissonance'
    )
  );
  assert.ok(result.breakdown.some((entry) => entry.name === 'Relic of Akeem — Confusion' && entry.conditionDamage > 0));
  assert.ok(result.breakdown.some((entry) => entry.name === 'Relic of Akeem — Torment' && entry.conditionDamage > 0));
});

test('Relic of Akeem is reported when its trigger ends the rotation', () => {
  const result = simulateMesmer(
    ['Bladesong Sorrow', 'Bladecall', 'Bladesong Dissonance'],
    defaultSimulationConfig({
      relic: 'Akeem',
      initialResource: 5
    })
  );

  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.type === 'relic_proc' && proc.skill === 'Relic of Akeem' && proc.sourceSkill === 'Bladesong Dissonance'
    )
  );
});

test('Relic of the Eagle activates after runtime damage drops the target below 50%', () => {
  const config = defaultSimulationConfig({
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const probe = simulateMesmer(['Bladecall'], config);
  const firstHitDamage = probe.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Bladecall'
  ).damage;
  const target = {
    ...config.target,
    health: firstHitDamage * 1.5
  };
  const base = simulateMesmer(['Bladecall', 'Bladecall'], {
    ...config,
    target
  });
  const eagle = simulateMesmer(['Bladecall', 'Bladecall'], {
    ...config,
    relic: 'Eagle',
    target
  });
  const hits = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Bladecall')
      .map((event) => event.damage);

  assert.equal(hits(eagle)[0], hits(base)[0]);
  assert.ok(Math.abs(hits(eagle)[1] / hits(base)[1] - 1.1) < 1e-12);
  assert.equal(eagle.deathTime, base.deathTime);
});

test('permanent target conditions satisfy condition-dependent relic triggers', () => {
  const result = simulateMesmer(
    ['Bladesong Dissonance'],
    defaultSimulationConfig({
      relic: 'Akeem',
      initialResource: 5,
      target: {
        ...defaultSimulationConfig().target,
        conditions: {
          Confusion: 5,
          Torment: 0,
          Vulnerability: 0
        }
      }
    })
  );

  assert.ok(
    result.procSteps.some((proc) => proc.skill === 'Relic of Akeem' && proc.sourceSkill === 'Bladesong Dissonance')
  );
});

test('Relic of Mistburn grants ten percent critical chance at ten Might', () => {
  const config = defaultSimulationConfig({
    relic: 'Mistburn',
    stats: {
      ...defaultSimulationConfig().stats,
      precision: 1000
    },
    modifiers: { strike: 1, condition: 1 }
  });
  const resultAt = (might) =>
    simulateMesmer(['Bladecall'], {
      ...config,
      boons: {
        ...config.boons,
        might,
        fury: false
      }
    });
  const criticalChance = (result) => result.resolvedEvents.find((event) => event.type === 'damage').criticalChance;

  assert.ok(Math.abs(criticalChance(resultAt(9)) - 0.05) < 1e-12);
  assert.ok(Math.abs(criticalChance(resultAt(10)) - 0.15) < 1e-12);
});

test('Relic of Aristocracy extends conditions after weakness or vulnerability', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    relic: 'Aristocracy',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    stats: {
      ...defaultSimulationConfig().stats,
      expertise: 0
    },
    modifiers: { strike: 1, condition: 1 }
  });
  const result = simulateMesmer(
    ['Mind Slash', 'Mind Gash', 'Phantasmal Duelist', { name: '__wait', waitMs: 5000 }],
    config
  );
  const bleeding = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Phantasmal Duelist' && event.condition === 'Bleeding'
  );

  assert.ok(Math.abs(bleeding.effectiveDuration - 4.12) < 1e-12);
  assert.ok(
    result.procSteps.some(
      (proc) =>
        proc.type === 'relic_proc' &&
        proc.skill === 'Relic of Aristocracy' &&
        proc.sourceSkill === 'Mind Slash' &&
        proc.detail === '1/5 stacks'
    )
  );
  assert.equal(result.procSteps.filter((proc) => proc.skill === 'Relic of Aristocracy').length, 1);
});

test('Relic of Aristocracy requires more than its one-second ICD', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    relic: 'Aristocracy',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol'
  });
  const aristocracyProcs = (waitMs) =>
    simulateMesmer(
      ['Mind Slash', { name: '__wait', waitMs }, 'Mind Gash', { name: '__wait', waitMs: 2000 }],
      config
    ).procSteps.filter((proc) => proc.skill === 'Relic of Aristocracy');

  assert.equal(aristocracyProcs(479).length, 1);
  assert.equal(aristocracyProcs(480).length, 1);
  assert.equal(aristocracyProcs(481).length, 2);
  assert.deepEqual(
    aristocracyProcs(481).map((proc) => proc.detail),
    ['1/5 stacks', '2/5 stacks']
  );
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

test('weapon swap only starts its cooldown in combat', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: ''
  });
  const precombat = simulateMesmer(['Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    precombat.steps.map((step) => step.start),
    [0, 0]
  );
  assert.equal(precombat.endState.activeWeaponSet, 1);
  assert.equal(precombat.endState.cooldowns['Swap Weapons'], undefined);

  const inCombat = simulateMesmer(['__combat_start', 'Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    inCombat.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
    [0, 10000]
  );
  assert.equal(inCombat.endState.activeWeaponSet, 1);
  assert.equal(inCombat.endState.cooldowns['Swap Weapons'].readyAt, 20000);
});

test('weapon swaps start new weapon-set rows in the rotation timeline', () => {
  const rows = timelineWeaponRows(
    ['Bladecall', 'Swap Weapons', 'Psycut', 'Swap Weapons', 'Bladecall'].map((skillId) => ({
      type: 'cast',
      skillId
    }))
  );

  assert.deepEqual(
    rows.map((row) => row.weaponSet),
    [1, 2, 1]
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]]
  );
  assert.deepEqual(
    timelineWeaponRowGroups(rows).map((group) => [group.weaponSet, group.rows.length]),
    [
      [1, 1],
      [2, 1],
      [1, 1]
    ]
  );
});

test('shroud and forge transitions start a new row on the current weapon set', () => {
  for (const [enter, exit] of [
    ['Swap Legends', 'Swap Legends'],
    ["Reaper's Shroud", "Exit Reaper's Shroud"],
    ['Harbinger Shroud', 'Exit Harbinger Shroud'],
    ["Ritualist's Shroud", "Exit Ritualist's Shroud"],
    ['Enter Shadow Shroud', 'Exit Shadow Shroud'],
    ['Enter Radiant Forge', 'Exit Radiant Forge']
  ]) {
    const rows = timelineWeaponRows(
      ['Before', enter, 'During', exit, 'After', 'Swap Weapons', 'Other set'].map((skillId) => ({
        type: 'cast',
        skillId
      })),
      {
        startingWeaponSet: 2
      }
    );

    assert.deepEqual(
      rows.map((row) => row.weaponSet),
      [2, 2, 2, 1],
      enter
    );
    assert.deepEqual(
      rows.map((row) => row.skills.map((skill) => skill.index)),
      [[0, 1], [2, 3], [4, 5], [6]],
      enter
    );
    assert.deepEqual(
      timelineWeaponRowGroups(rows).map((group) => [group.weaponSet, group.rows.length]),
      [
        [2, 3],
        [1, 1]
      ],
      enter
    );
  }
});

test('a final weapon swap remains on its originating weapon-set row', () => {
  const rows = timelineWeaponRows(['Bladecall', 'Swap Weapons'].map((skillId) => ({ type: 'cast', skillId })));

  assert.deepEqual(
    rows.map((row) => row.weaponSet),
    [1]
  );
  assert.deepEqual(
    rows[0].skills.map((skill) => skill.index),
    [0, 1]
  );
});

test('rotation drag reordering respects before and after insertion positions', () => {
  const command = (skillId) => ({ type: 'cast', skillId });
  const rotation = [command('Bladecall'), command('Mirror Blade'), command('Mind Spike')];

  assert.equal(moveRotationEntry(rotation, 0, 2), true);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);

  assert.equal(moveRotationEntry(rotation, 2, 0), true);
  assert.deepEqual(rotation, [command('Mind Spike'), command('Mirror Blade'), command('Bladecall')]);

  assert.equal(moveRotationEntry(rotation, 0, rotation.length), true);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);

  assert.equal(moveRotationEntry(rotation, 1, 2), false);
  assert.deepEqual(rotation, [command('Mirror Blade'), command('Bladecall'), command('Mind Spike')]);
});

test('shift-queued Mirror Images after an instant action still grants clones', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Feedback', { name: 'Mirror Images', offset: 100 }], config);

  assert.equal(result.endState.time, 100);
  assert.equal(result.endState.profession.resource, 2);
});

test('shift-queued Mirror Images after a resource-generating cast grants both clones', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Bladecall', { name: 'Mirror Images', offset: 100 }], config);
  const mirrorImagesResource = result.events.find(
    (event) => event.type === 'resource' && event.reason === 'Mirror Images'
  );

  assert.equal(mirrorImagesResource?.amount, 2);
  assert.equal(result.endState.profession.resource, 3);
});

test('clones from shift-queued Mirror Images are available to the next shatter', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Feedback', { name: 'Mirror Images', offset: 100 }, 'Mind Wrack'], config);

  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[2].start, 100);
  assert.equal(result.endState.profession.resource, 0);
});
