import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { shatterResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { simulationEventLogRows } from '#gw2/app/rotation/result/simulation-event-log.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

// Chronomancer clone refunds, phantasm repeats, and Continuum snapshots retain their timing contracts.
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
