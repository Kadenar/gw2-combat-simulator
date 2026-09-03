import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2SimulationConfig } from '#gw2/app/simulation/config.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import {
  calculateRandomDistribution,
  partitionRandomDistributionTrials,
  randomDistributionMetrics,
  randomDistributionWorkerCount,
  summarizeRandomDistribution,
  summarizeRandomDistributionOutcomes
} from '#gw2/app/simulation/random-distribution.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild
} from '#gw2/content/professions/engineer/build/build.js';
import { engineerAppAdapter } from '#gw2/content/professions/engineer/app/app-definition.js';
import { engineerProfession } from '#gw2/content/professions/engineer/definition.js';
import { ENGINEER_TRAIT_IDS as ENGINEER_TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { guardianProfession } from '#gw2/content/professions/guardian/definition.js';
import { createGuardianBuildDefaults } from '#gw2/content/professions/guardian/build/build.js';
import { mesmerProfession } from '#gw2/content/professions/mesmer/definition.js';
import { createMesmerBuildDefaults } from '#gw2/content/professions/mesmer/build/build.js';
import { MESMER_TRAIT_IDS as MESMER_TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild
} from '#gw2/content/professions/necromancer/build/build.js';
import { necromancerProfession } from '#gw2/content/professions/necromancer/definition.js';
import { NECROMANCER_TRAIT_IDS as NECROMANCER_TRAIT } from '#gw2/content/professions/necromancer/data/ids.js';
import { revenantProfession } from '#gw2/content/professions/revenant/definition.js';
import { createRevenantBuildDefaults } from '#gw2/content/professions/revenant/build/build.js';
import { thiefProfession } from '#gw2/content/professions/thief/definition.js';
import { createThiefBuildDefaults } from '#gw2/content/professions/thief/build/build.js';

function minimalAttributeData() {
  return { attributes: {}, activeTraits: [] };
}

function simulationConfig(profession, build, specialization) {
  return createGw2SimulationConfig({
    app: {
      adapter: {
        assumptionControls: profession.ui.assumptionControls
      },
      build,
      attributeWeaponSet: 1,
      skillById: profession.catalog.skillsById
    },
    attributeData: minimalAttributeData(),
    specialization
  });
}

function traitConditionCount(result, traitId) {
  return result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === traitId).length;
}

test('seeded simulation random streams are reproducible and independent', () => {
  const first = createSimulationRandom({ mode: 'stochastic', seed: 42 });
  const second = createSimulationRandom({ mode: 'stochastic', seed: 42 });

  assert.deepEqual(
    [first.next('critical:player'), first.next('engineer.shrapnel'), first.next('critical:player')],
    [second.next('critical:player'), second.next('engineer.shrapnel'), second.next('critical:player')]
  );

  const isolated = createSimulationRandom({ mode: 'stochastic', seed: 42 });

  assert.equal(
    isolated.next('engineer.shrapnel'),
    createSimulationRandom({ mode: 'stochastic', seed: 42 }).next('engineer.shrapnel')
  );
});

test('every native profession exposes persisted simulation randomness', () => {
  const professions = [
    mesmerProfession,
    guardianProfession,
    necromancerProfession,
    engineerProfession,
    revenantProfession,
    thiefProfession
  ];

  for (const profession of professions) {
    assert.deepEqual(
      profession.ui.assumptionControls
        .filter((control) => control.section === 'simulation')
        .map((control) => control.key),
      ['simulationMode']
    );
    assert.equal(
      profession.ui.assumptionControls.find((control) => control.key === 'simulationMode')?.label,
      'Simulation randomness'
    );
  }

  const builds = [
    createMesmerBuildDefaults(),
    createGuardianBuildDefaults(),
    createNecromancerBuildDefaults(),
    createEngineerBuildDefaults(),
    createRevenantBuildDefaults(),
    createThiefBuildDefaults()
  ];

  for (const build of builds) {
    assert.equal(build.assumptions.simulationMode, 'deterministic');
  }

  const engineer = createEngineerBuildDefaults();
  const necromancer = createNecromancerBuildDefaults();
  const migratedEngineer = migrateEngineerBuild({
    ...engineer,
    assumptions: {
      ...engineer.assumptions,
      simulationMode: 'invalid'
    }
  });

  assert.equal(migratedEngineer.assumptions.simulationMode, 'deterministic');
  assert.equal(
    validateEngineerBuild({
      ...engineer,
      assumptions: {
        ...engineer.assumptions,
        simulationMode: 'invalid'
      }
    }).valid,
    false
  );
  assert.equal(migrateNecromancerBuild(necromancer).assumptions.simulationMode, 'deterministic');
});

test('shared UI assumptions map to the resolver randomness config', () => {
  const build = createEngineerBuildDefaults();

  build.assumptions.simulationMode = 'stochastic';
  const config = simulationConfig(engineerProfession, build, 'Holosmith');

  assert.deepEqual(config.randomness, {
    mode: 'stochastic',
    seed: 1
  });
  assert.equal(Object.hasOwn(config.deterministicChoices, 'simulationMode'), false);
});

test('RNG distributions report expected and percentile DPS without a UI seed', () => {
  assert.deepEqual(summarizeRandomDistribution([10, 20, 30, 40, 50]), {
    trials: 5,
    mean: 30,
    p01: 10.4,
    p10: 14,
    p50: 30,
    p90: 46,
    p99: 49.6
  });

  const seenSeeds = [];
  const progressUpdates = [];
  const distribution = calculateRandomDistribution(
    {
      rotation: [],
      baseConfig: {},
      trials: 3
    },
    (_rotation, config) => {
      seenSeeds.push(config.randomness.seed);

      return { dps: config.randomness.seed * 100 };
    },
    {
      includeSamples: true,
      onProgress(progress) {
        progressUpdates.push(progress);
      }
    }
  );

  assert.deepEqual(seenSeeds, [1, 2, 3]);
  assert.deepEqual(distribution.samples, [100, 200, 300]);
  assert.deepEqual(progressUpdates[0], {
    completed: 0,
    total: 3,
    percent: 0
  });
  assert.deepEqual(progressUpdates.at(-1), {
    completed: 3,
    total: 3,
    percent: 100
  });
  assert.equal(distribution.trials, 3);
  assert.equal(distribution.mean, 200);
  assert.equal(distribution.p50, 200);
});

test('RNG explanations compare variable combat facts in low and high DPS cohorts', () => {
  const outcomes = Array.from({ length: 20 }, (_unused, index) => ({
    dps: 1000 + index * 10,
    metrics: [
      {
        id: 'critical:player',
        group: 'critical:player',
        label: 'Player critical hits',
        category: 'critical',
        unit: 'count',
        value: index
      },
      {
        id: 'condition:jagged-mind:bleeding',
        group: 'effect:jagged-mind',
        label: 'Jagged Mind bleeding stacks applied',
        category: 'condition',
        unit: 'stacks',
        value: Math.floor(index / 2)
      },
      {
        id: 'proc:fixed',
        group: 'effect:fixed',
        label: 'Fixed activations',
        category: 'proc',
        unit: 'count',
        value: 1
      }
    ]
  }));
  const distribution = summarizeRandomDistributionOutcomes(outcomes);

  assert.equal(distribution.explanation.cohortPercent, 10);
  assert.equal(distribution.explanation.lowDpsMean, 1005);
  assert.equal(distribution.explanation.highDpsMean, 1185);
  assert.deepEqual(
    distribution.explanation.drivers.map((driver) => driver.label),
    ['Player critical hits', 'Jagged Mind bleeding stacks applied']
  );
  assert.equal(
    distribution.explanation.drivers.some((driver) => driver.label === 'Fixed activations'),
    false
  );
  assert.equal(distribution.explanation.drivers[0].lowAverage, 0.5);
  assert.equal(distribution.explanation.drivers[0].highAverage, 18.5);
  assert.equal(distribution.explanation.drivers[0].delta, 18);
  assert.ok(distribution.explanation.drivers[0].correlation > 0.99);
  assert.equal(distribution.explanation.drivers[0].estimatedDpsDelta, 180);
});

test('RNG explanations retain condition damage when equal application counts tick differently', () => {
  const outcomes = Array.from({ length: 20 }, (_unused, index) => ({
    dps: 1000 + index * 10,
    metrics: randomDistributionMetrics({
      dps: 1000 + index * 10,
      resolvedEvents: [
        {
          type: 'condition',
          sourceId: 2202,
          name: 'Blade Strike — Jagged Mind',
          condition: 'Bleeding',
          stacks: 1,
          damage: 100 + index * 10
        }
      ]
    })
  }));
  const labels = summarizeRandomDistributionOutcomes(outcomes).explanation?.drivers.map((driver) => driver.label);

  assert.deepEqual(labels, ['Jagged Mind bleeding damage']);
});

test('RNG trials scale worker count gradually from combined timeline workload', () => {
  assert.equal(randomDistributionWorkerCount(500, 16), 8);
  assert.equal(randomDistributionWorkerCount(500, 8), 7);
  assert.equal(randomDistributionWorkerCount(500, 4), 3);
  assert.equal(randomDistributionWorkerCount(500, 2), 1);
  assert.equal(randomDistributionWorkerCount(500, 0), 4);
  assert.equal(randomDistributionWorkerCount(0, 8), 0);
  assert.equal(
    randomDistributionWorkerCount(500, 16, {
      scheduledEvents: 1000,
      resolvedEvents: 1000,
      conditionTicks: 1999
    }),
    8
  );
  assert.equal(
    randomDistributionWorkerCount(500, 16, {
      scheduledEvents: 1000,
      resolvedEvents: 1000,
      conditionTicks: 2000
    }),
    4
  );
  assert.equal(
    randomDistributionWorkerCount(500, 16, {
      scheduledEvents: 3000,
      resolvedEvents: 3000,
      conditionTicks: 5999
    }),
    4
  );
  assert.equal(
    randomDistributionWorkerCount(500, 16, {
      scheduledEvents: 3000,
      resolvedEvents: 3000,
      conditionTicks: 6000
    }),
    2
  );
  assert.equal(randomDistributionWorkerCount(3, 16, { conditionTicks: 12_000 }), 2);
  assert.deepEqual(partitionRandomDistributionTrials(10, 3), [
    { trials: 4, seedStart: 1 },
    { trials: 3, seedStart: 5 },
    { trials: 3, seedStart: 8 }
  ]);
  assert.deepEqual(partitionRandomDistributionTrials(0, 3), []);
});

test('RNG analysis is available while detailed Engineer results stay deterministic', () => {
  const build = createEngineerBuildDefaults();

  build.rotation = ['Grenade Kit', 'Grenade'].map((name) => ({
    type: 'cast',
    skillId: engineerProfession.catalog.skillsByName.get(name).id
  }));
  const app = {
    adapter: engineerAppAdapter,
    profession: engineerProfession,
    build,
    results: null,
    attributeWeaponSet: 1,
    skillById: engineerProfession.catalog.skillsById,
    skillByName: engineerProfession.catalog.skillsByName
  };

  engineerAppAdapter.recalculate(app);
  engineerAppAdapter.runSimulation(app);
  assert.equal(app.results.randomness.mode, 'deterministic');

  const request = engineerAppAdapter.randomDistributionRequest(app);

  assert.equal(request.baseConfig.randomness.mode, 'stochastic');
  const distribution = engineerAppAdapter.calculateRandomDistribution({
    ...request,
    trials: 10
  });

  assert.equal(distribution.trials, 10);
  assert.equal(Number.isFinite(distribution.mean), true);
  assert.equal(distribution.p01 <= distribution.p99, true);
  assert.ok(distribution.explanation?.drivers.length > 0);
  assert.ok(
    distribution.explanation.drivers.every(
      (driver) =>
        typeof driver.label === 'string' && driver.label.length > 0 && Number.isFinite(driver.estimatedDpsDelta)
    )
  );
});

test('Mesmer distributions explain illusion criticals and their bleeding damage', () => {
  const rotation = ['Phantasmal Duelist', { name: '__wait', waitMs: 4000 }];
  const distribution = calculateRandomDistribution(
    {
      rotation,
      baseConfig: {
        specialization: 'Core',
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Pistol',
        selectedTraitIds: [MESMER_TRAIT.SHARPER_IMAGES],
        stats: {
          power: 2000,
          precision: 1945,
          ferocity: 750,
          conditionDamage: 1000,
          expertise: 0
        },
        boons: { fury: false },
        target: { armor: 2597 }
      },
      trials: 32
    },
    (trialRotation, config) =>
      simulateGw2({
        profession: mesmerProfession,
        rotation: trialRotation,
        config
      })
  );
  const labels = distribution.explanation?.drivers.map((driver) => driver.label);

  assert.ok(labels?.includes('Illusion critical hits'));
  assert.ok(labels?.includes('Sharper Images bleeding damage'));
});

test('Engineer random trait procs repeat by seed and vary across seeds', () => {
  const rotation = ['Grenade Kit', ...Array(12).fill('Grenade')];
  const config = {
    specialization: 'Core',
    selectedSkills: ['Grenade Kit'],
    selectedTraitIds: [ENGINEER_TRAIT.SHRAPNEL, ENGINEER_TRAIT.SERRATED_STEEL, ENGINEER_TRAIT.INCENDIARY_POWDER],
    stats: {
      power: 2000,
      precision: 4000,
      ferocity: 500,
      conditionDamage: 1000,
      expertise: 0,
      vitality: 1000
    },
    target: {
      armor: 2597,
      conditions: { Vulnerability: 25 }
    }
  };
  const run = (seed) =>
    simulateGw2({
      profession: engineerProfession,
      rotation,
      config: {
        ...config,
        randomness: { mode: 'stochastic', seed }
      }
    });
  const signature = (result) => [
    traitConditionCount(result, ENGINEER_TRAIT.SHRAPNEL),
    traitConditionCount(result, ENGINEER_TRAIT.SERRATED_STEEL),
    traitConditionCount(result, ENGINEER_TRAIT.INCENDIARY_POWDER)
  ];

  assert.deepEqual(signature(run(1)), signature(run(1)));
  assert.notDeepEqual(signature(run(1)), signature(run(2)));
  assert.deepEqual(run(2).randomness, { mode: 'stochastic', seed: 2 });
});

test('Necromancer randomizes Barbed Precision and Chilling Nova by seed', () => {
  const common = {
    stats: {
      power: 2000,
      precision: 4000,
      ferocity: 500,
      conditionDamage: 1200,
      expertise: 0,
      vitality: 1000
    },
    target: {
      armor: 2597,
      conditions: { Chilled: true, Vulnerability: 25 }
    }
  };
  const barbed = (seed) =>
    simulateGw2({
      profession: necromancerProfession,
      rotation: ['Weeping Shots', { type: 'wait', durationMs: 4100 }],
      config: {
        ...common,
        specialization: 'Harbinger',
        primaryWeapon: 'Pistol',
        selectedTraitIds: [NECROMANCER_TRAIT.BARBED_PRECISION],
        randomness: { mode: 'stochastic', seed }
      }
    });

  assert.equal(
    traitConditionCount(barbed(1), NECROMANCER_TRAIT.BARBED_PRECISION),
    traitConditionCount(barbed(1), NECROMANCER_TRAIT.BARBED_PRECISION)
  );
  assert.notEqual(
    traitConditionCount(barbed(1), NECROMANCER_TRAIT.BARBED_PRECISION),
    traitConditionCount(barbed(2), NECROMANCER_TRAIT.BARBED_PRECISION)
  );

  const chillingNova = (seed) =>
    simulateGw2({
      profession: necromancerProfession,
      rotation: ["Reaper's Shroud", 'Life Rend'],
      config: {
        ...common,
        specialization: 'Reaper',
        selectedTraitIds: [NECROMANCER_TRAIT.CHILLING_NOVA],
        stats: { ...common.stats, precision: 2000 },
        initialResource: 100,
        randomness: { mode: 'stochastic', seed }
      }
    }).resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === NECROMANCER_TRAIT.CHILLING_NOVA);

  assert.equal(chillingNova(1), true);
  assert.equal(chillingNova(3), false);
});

test('Reaper rolls ice-field projectile finishers per bullet by seed', () => {
  const boltCount = (mode, seed) =>
    simulateGw2({
      profession: necromancerProfession,
      rotation: ['Weeping Shots', 'Vicious Shot', { type: 'wait', durationMs: 2000 }],
      config: {
        specialization: 'Reaper',
        primaryWeapon: 'Pistol',
        professionAssumptions: { permanentIceField: true },
        stats: {
          power: 2000,
          precision: 2000,
          ferocity: 1000,
          conditionDamage: 1000
        },
        target: { armor: 2597 },
        randomness: { mode, seed }
      }
    }).resolvedEvents.filter(
      (event) => event.type === 'combo' && event.fieldType === 'Ice' && event.finisherType === 'Projectile'
    ).length;

  // Deterministic mode banks the expected chance across all seven projectiles
  // (Weeping Shots' six bullets plus Vicious Shot's one), so it is seed-stable.
  assert.equal(boltCount('deterministic', 1), boltCount('deterministic', 9));

  // Stochastic mode rolls each bullet separately: outcomes vary across seeds and
  // reproduce for a fixed seed. A dud seed can also land zero bolts.
  const seeds = [1, 2, 3, 4, 8];
  const counts = seeds.map((seed) => boltCount('stochastic', seed));

  assert.equal(boltCount('stochastic', 1), counts[0]);
  assert.ok(new Set(counts).size > 1, 'per-bullet rolls should vary by seed');
  assert.ok(
    counts.some((count) => count === 0),
    'some seed should roll no finishers'
  );
});
