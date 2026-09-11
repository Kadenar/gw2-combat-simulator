import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { createEngineerBuildDefaults, toApplicationBuild } from '#gw2/professions/engineer/build/build.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';
import { scrapperSchedulerHooks } from '#gw2/professions/engineer/specializations/scrapper/traits/modifiers.js';
import { createScrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { engineerAppAdapter } from '#gw2/professions/engineer/app/app-definition.js';

// Scrapper contracts cover trait procs, combo boons, and gyro fields.
const baseConfig = Object.freeze({
  selectedSkills: ['Healing Turret', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
  selectedMorphSkillIds: [77103, 77203, 76954],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 }
  }
});

const simulate = createProfessionSimulator(engineerProfession, baseConfig);

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

test('Scrapper traits apply gyro control, superspeed, boons, and charges', () => {
  const result = simulate(
    'Scrapper',
    ['Med Kit', 'Bandage Self', 'Function Gyro', 'Function Gyro', { type: 'wait', durationMs: 2100 }],
    {
      selectedSkills: ['Med Kit', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
      selectedTraitIds: [
        TRAIT.SPEED_OF_SYNERGY,
        TRAIT.GYROSCOPIC_ACCELERATION,
        TRAIT.SYSTEM_SHOCKER,
        TRAIT.MASS_MOMENTUM,
        TRAIT.OBJECT_IN_MOTION,
        TRAIT.EX_MACHINA,
        TRAIT.APPLIED_FORCE
      ],
      boons: { might: 10 }
    }
  );

  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.name === 'Speed of Synergy — superspeed').length,
    1
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Speed of Synergy — superspeed' && event.duration === 10
    )
  );
  assert.ok(
    result.events.some(
      (event) => event.type === 'buff' && event.name === 'Gyroscopic Acceleration — superspeed' && event.duration === 5
    )
  );
  assert.equal(result.events.filter((event) => event.type === 'control' && event.controlKind === 'daze').length, 2);
  assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'stability' && event.duration === 3));
  assert.ok(result.procSteps.filter((step) => step.skill === 'Mass Momentum').length >= 3);
  assert.ok(result.procSteps.some((step) => step.skill === 'Applied Force'));
  assert.equal(result.endState.ammo['Function Gyro'].maximum, 2);

  const reconstructionField = simulate('Scrapper', ['Reconstruction Field'], {
    selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
    selectedTraitIds: [TRAIT.SPEED_OF_SYNERGY]
  });

  // Current F1 evidence retains seven seconds of Speed of Synergy superspeed after Reconstruction Field completes.
  assert.ok(
    reconstructionField.events.some((event) => event.name === 'Speed of Synergy — superspeed' && event.duration === 7)
  );

  const base = simulate('Scrapper', ['Puncturing Jab'], {
    target: { conditions: {} }
  });
  const moving = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.OBJECT_IN_MOTION],
    boons: {
      stability: true,
      swiftness: true,
      superspeed: true
    },
    target: { conditions: {} }
  });

  assert.ok(
    Math.abs(
      moving.resolvedEvents.find((event) => event.type === 'damage').damage /
        base.resolvedEvents.find((event) => event.type === 'damage').damage -
        1.05 ** 3
    ) < 1e-12
  );

  const appliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    selectedTraitIds: [TRAIT.APPLIED_FORCE],
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} }
  });
  const withoutAppliedForce = simulate('Scrapper', ['Puncturing Jab'], {
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} }
  });

  assert.ok(
    Math.abs(
      appliedForce.resolvedEvents.find((event) => event.type === 'damage').damage /
        withoutAppliedForce.resolvedEvents.find((event) => event.type === 'damage').damage -
        3500 / 2750
    ) < 1e-12
  );
});

test('Kinetic Accelerators emits party quickness and might from successful combos', () => {
  const config = {
    selectedSkills: ['Medic Gyro', 'Grenade Kit', 'Throw Mine', 'Elixir Gun', 'Supply Crate'],
    selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
    boons: { quickness: false },
    stats: { power: 2000, concentration: 260 }
  };
  const result = simulate(
    'Scrapper',
    ['Medic Gyro', 'Function Gyro', { type: 'wait', durationMs: 3200 }, 'Positive Strike'],
    config
  );
  const withoutTrait = simulate(
    'Scrapper',
    ['Medic Gyro', 'Function Gyro', { type: 'wait', durationMs: 3200 }, 'Positive Strike'],
    { ...config, selectedTraitIds: [] }
  );

  assert.equal(result.warnings.length, 0);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'combo' && event.skillName === 'Function Gyro' && event.finisherType === 'Blast'
    )
  );
  assert.equal(
    withoutTrait.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Function Gyro'),
    false
  );
  assert.equal(result.procSteps.filter((step) => step.skill === 'Kinetic Accelerators').length, 1);
  const quickness = result.events.find(
    (event) => event.type === 'buff' && event.name === 'Kinetic Accelerators — quickness'
  );
  const might = result.events.find((event) => event.type === 'buff' && event.name === 'Kinetic Accelerators — might');

  assert.equal(quickness.audience.recipients, 'party');
  assert.equal(quickness.duration, 3.52);
  assert.equal(might.audience.recipients, 'party');
  assert.equal(might.duration, 10 * (1 + 260 / 1500));
  assert.equal(might.stacks, 3);
  const chart = buildChartSeries(result, 40);

  assert.equal(chart.effectUnits.Quickness, 's');
  assert.equal(chart.effects.Quickness[0].v, 3.52);
  assert.ok(chart.effects.Quickness.some((point) => point.v > 0));

  const acceleratedStep = result.steps.find((step) => step.skill === 'Positive Strike');
  const baseStep = withoutTrait.steps.find((step) => step.skill === 'Positive Strike');

  assert.equal(acceleratedStep.end - acceleratedStep.start, 480);
  assert.equal(baseStep.end - baseStep.start, 720);

  const acceleratedHit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );
  const baseHit = withoutTrait.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Positive Strike'
  );

  assert.ok(Math.abs(acceleratedHit.damage / baseHit.damage - 2090 / 2000) < 1e-12);
});

test('Kinetic Accelerators applies its strict ICD only to whirl finishers', () => {
  const boons = [];
  const context = {
    config: {
      selectedTraitIds: [TRAIT.KINETIC_ACCELERATORS],
      stats: { concentration: 0 }
    },
    state: {
      activeWeaponSet: 1,
      profession: {
        core: {},
        specialization: { kind: 'Scrapper', state: createScrapperState() }
      }
    },
    epsilon: 1e-9,
    emitDerived(_event, boon) {
      boons.push(boon);
    }
  };
  const combo = (finisherType, at) => ({
    type: 'combo',
    at,
    source: 'engineer',
    sourceId: 1,
    actorType: 'player',
    skillName: `${finisherType} test`,
    finisherType,
    schedulerPrediction: 'combo-result'
  });

  const observe = scrapperSchedulerHooks.onEventScheduled.handler;

  observe(context, combo('Whirl', 1));
  observe(context, combo('Whirl', 2));
  observe(context, combo('Leap', 2));
  observe(context, combo('Blast', 2));
  observe(context, combo('Whirl', 4));
  observe(context, combo('Whirl', 4.001));

  const quickness = boons.filter((event) => event.kind === 'quickness');
  const might = boons.filter((event) => event.kind === 'might');

  assert.deepEqual(
    quickness.map((event) => [event.at, event.duration]),
    [
      [1, 3],
      [2, 3],
      [2, 3],
      [4.001, 3]
    ]
  );
  assert.deepEqual(
    might.map((event) => [event.at, event.duration, event.stacks]),
    [
      [1, 10, 3],
      [2, 10, 3],
      [2, 10, 3],
      [4.001, 10, 3]
    ]
  );
  assert.ok(boons.every((event) => event.audience?.recipients === 'party'));
  assert.ok(boons.every((event) => event.schedulerPrediction == null));
});

test('Scrapper 1-3-2 converts 13% of Power into Concentration', () => {
  const canonical = createEngineerBuildDefaults();

  canonical.gear = Object.fromEntries(Object.keys(canonical.gear).map((slot) => [slot, "Berserker's"]));
  canonical.rune = '';
  canonical.food = '';
  canonical.utility = '';
  canonical.jadeBotCore = false;
  canonical.infusions = canonical.infusions.map((infusion) => ({
    ...infusion,
    count: 0
  }));
  canonical.specializations = [
    { name: 'Explosives', traits: '3-2-3' },
    { name: 'Firearms', traits: '3-3-1' },
    { name: 'Scrapper', traits: '1-3-2' }
  ];
  canonical.assumptions.quickness = false;
  const app = {
    build: toApplicationBuild(canonical),
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  engineerAppAdapter.recalculate(app);

  assert.ok(app.attributeData.activeTraits.some((trait) => trait.name === 'Kinetic Accelerators'));
  assert.equal(
    app.attributeData.attributes.Concentration.traits,
    Math.round(app.attributeData.attributes.Power.final * 0.13)
  );
});

test('Medic Gyro and Reconstruction Field expose their water fields', () => {
  const reconstructionField = mechanic('Reconstruction Field');

  assert.equal(reconstructionField.cooldown, 25);
  assert.equal(reconstructionField.comboFields[0].fieldType, 'Water');
  assert.equal(reconstructionField.comboFields[0].duration, 2);
  assert.deepEqual(reconstructionField.effects[0], {
    type: 'boon',
    boon: 'protection',
    duration: 2,
    stacks: 1
  });

  const medicGyro = mechanic('Medic Gyro');

  assert.equal(medicGyro.cooldown, 20);
  assert.equal(medicGyro.comboFields[0].fieldType, 'Water');
  assert.equal(medicGyro.comboFields[0].duration, 5);
});
