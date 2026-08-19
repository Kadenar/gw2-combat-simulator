import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2SimulationConfig } from '../../../js/app/simulation/config.js';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { FOOD_DATA } from '../../../js/platform/gw2/gear-data.js';
import { aggregateSigilSet } from '../../../js/platform/gw2/weapon-sigils.js';
import { createNecromancerBuildDefaults } from '../../../js/professions/necromancer/build.js';

test('the shared simulation config defaults to day and preserves a night selection', () => {
  const build = createNecromancerBuildDefaults();
  const config = () =>
    createGw2SimulationConfig({
      app: {
        build,
        adapter: { assumptionControls: [] },
        skillById: new Map()
      },
      attributeData: { attributes: {} },
      specialization: 'Reaper'
    });

  assert.equal(config().timeOfDay, 'day');
  build.assumptions.timeOfDay = 'night';
  assert.equal(config().timeOfDay, 'night');
});

function flyingCutterDamage(config) {
  const result = simulateMesmer(['Flying Cutter'], config);

  return result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Flying Cutter').damage;
}

test('Night sigil uses an additive 3% strike bonus and a night-only 7% multiplier', () => {
  const noSigil = aggregateSigilSet([]);
  const nightSigil = aggregateSigilSet(['Night']);
  const base = defaultSimulationConfig({
    sigilSets: [noSigil, noSigil],
    target: { armor: 2597, conditions: {} }
  });
  const dayDamage = flyingCutterDamage({
    ...base,
    timeOfDay: 'day',
    sigilSets: [nightSigil, nightSigil]
  });
  const nightDamage = flyingCutterDamage({
    ...base,
    timeOfDay: 'night',
    sigilSets: [nightSigil, nightSigil]
  });
  const unsigiledDamage = flyingCutterDamage(base);

  assert.equal(nightSigil.strikeAdd, 0.03);
  assert.equal(nightSigil.strike, 1.03);
  assert.equal(nightSigil.nightStrikeMultiplier, 1.07);
  assert.ok(Math.abs(dayDamage / unsigiledDamage - 1.03) < 1e-12);
  assert.ok(Math.abs(nightDamage / dayDamage - 1.07) < 1e-12);
});

function pepperRotation() {
  const rotation = [];

  for (let index = 0; index < 5; index += 1) {
    rotation.push('Flying Cutter');

    if (index < 4) rotation.push({ name: '__wait', waitMs: 1100 });
  }

  return rotation;
}

function pepperSimulation(timeOfDay) {
  const defaults = defaultSimulationConfig();

  return simulateMesmer(
    pepperRotation(),
    defaultSimulationConfig({
      food: 'Ghost Pepper Popper',
      timeOfDay,
      stats: {
        ...defaults.stats,
        precision: 4000,
        concentration: 0,
        boonDurationBonus: 0,
        boonDurationBonuses: {},
        expertise: 0,
        conditionDurationBonus: 0,
        conditionDurationBonuses: {}
      },
      boons: {
        ...defaults.boons,
        might: 0,
        fury: false
      }
    })
  );
}

test('Ghost Pepper Popper grants Might by day and inflicts Chilled by night', () => {
  const food = FOOD_DATA['Ghost Pepper Popper'];
  const proc = food.proc;

  assert.equal(food.icon, 'https://render.guildwars2.com/file/1C1D9D0407CD96F3E80266DEBD2B544E799AF658/433666.png');
  assert.equal(proc.chance, 0.4);
  assert.equal(proc.icdMs, 1000);
  assert.deepEqual(proc.dayEffect, {
    type: 'boon',
    name: 'Might',
    stacks: 1,
    duration: 5
  });
  assert.deepEqual(proc.nightEffect, {
    type: 'condition',
    name: 'Chilled',
    stacks: 1,
    duration: 1
  });

  const day = pepperSimulation('day');
  const dayHits = day.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter');

  assert.equal(day.procSteps.filter((event) => event.type === 'food_proc').length, 2);
  assert.ok(dayHits.at(-1).damage > dayHits[0].damage);
  assert.equal(
    day.resolvedEvents.some((event) => event.type === 'condition' && event.source === 'Food'),
    false
  );

  const night = pepperSimulation('night');
  const nightChill = night.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.source === 'Food' && event.condition === 'Chilled'
  );

  assert.equal(nightChill.length, 2);
  assert.ok(nightChill.every((event) => event.effectiveDuration === 1));
  const nightHits = night.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Flying Cutter'
  );

  assert.equal(nightHits.at(-1).damage, nightHits[0].damage);
});
