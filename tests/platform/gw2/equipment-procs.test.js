import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { createSimulationRandom } from '#kernel/core/simulation-random.js';

// Equipment procs consume eligible hits, sampled critical outcomes, and the active weapon set.
test('Thief relic progresses on individual hits instead of an aggregate hit', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Unstable Bladestorm', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      relic: 'Thief',
      stats: {
        ...defaults.stats,
        precision: 3100
      },
      boons: {
        ...defaults.boons,
        fury: true
      }
    })
  );
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Unstable Bladestorm'
  );
  const stormPulses = hits.filter((event) => event.coefficient === 0.25);

  assert.equal(hits.length, 8);
  assert.equal(stormPulses.length, 4);
  assert.ok(stormPulses[1].damage > stormPulses[0].damage);
  assert.ok(stormPulses[2].damage > stormPulses[1].damage);
  assert.ok(stormPulses[3].damage > stormPulses[2].damage);
});

test('a damage packet removed before resolution cannot trigger critical sigils', () => {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'marker',
        at: 1,
        name: 'Cancelled strike',
        skillName: 'Cancelled strike',
        source: 'Player',
        sourceId: 'cancelled-strike',
        actorType: 'player',
        cancelled: true,
        detail: 'cancelled before resolver handoff'
      }
    ],
    rotationEndTime: 2
  });
  const result = resolveTestGw2Stream({
    stream,
    config: {
      sigilSets: [{ names: ['Air', 'Earth', 'Torment'] }]
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1_000,
        precision: 4_000,
        ferocity: 0,
        conditionDamage: 0,
        expertise: 0
      }),
      critical: () => ({ chance: 1, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1_000
    }
  });

  assert.equal(
    result.resolvedEvents.some((event) => event.source === 'Sigil'),
    false
  );
  assert.deepEqual(result.procSteps, []);
});

test('critical sigils enqueue and resolve their own proc event', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Bladecall'],
    defaultSimulationConfig({
      stats: {
        ...defaults.stats,
        precision: 3100
      },
      boons: {
        ...defaults.boons,
        fury: true
      },
      sigilSets: [
        { names: ['Air'], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    })
  );

  assert.ok(result.procSteps.some((proc) => proc.skill === 'Sigil of Air'));
  assert.ok(result.breakdown.some((entry) => entry.name === 'Sigil of Air' && entry.strikeDamage > 0));
});

test("seeded critical sigils consume the hit's single sampled crit outcome", () => {
  const defaults = defaultSimulationConfig();
  const rotation = [];

  for (let index = 0; index < 6; index += 1) {
    rotation.push('Flying Cutter');

    if (index < 5) rotation.push({ name: '__wait', waitMs: 5100 });
  }

  const config = defaultSimulationConfig({
    stats: {
      ...defaults.stats,
      precision: 1945
    },
    boons: {
      ...defaults.boons,
      fury: false
    },
    sigilSets: [
      { names: ['Earth', 'Torment'], strike: 1, condition: 1 },
      { names: [], strike: 1, condition: 1 }
    ]
  });
  const run = (mode, seed = 37) =>
    simulateMesmer(rotation, {
      ...config,
      randomness: { mode, seed }
    });

  const stochastic = run('stochastic');
  const random = createSimulationRandom({ mode: 'stochastic', seed: 37 });
  const expectedOutcomes = Array.from({ length: 6 }, () => random.roll(0.5, 'critical:player'));
  const sourceHits = stochastic.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Flying Cutter'
  );

  assert.deepEqual(
    sourceHits.map((event) => event.didCrit),
    expectedOutcomes
  );
  assert.deepEqual(
    stochastic.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter')
      .map((event) => event.didCrit),
    expectedOutcomes
  );

  const expectedProcs = expectedOutcomes.filter(Boolean).length;

  for (const sigil of ['Earth', 'Torment']) {
    assert.equal(
      stochastic.resolvedEvents.filter((event) => event.type === 'condition' && event.skillName === `Sigil of ${sigil}`)
        .length,
      expectedProcs
    );
  }

  const deterministic = run('deterministic');

  for (const sigil of ['Earth', 'Torment']) {
    assert.equal(
      deterministic.resolvedEvents.filter(
        (event) => event.type === 'condition' && event.skillName === `Sigil of ${sigil}`
      ).length,
      3
    );
  }
});

test('critical-strike food consumes seeded crit and proc outcomes in stochastic mode', () => {
  const defaults = defaultSimulationConfig();
  const rotation = [];

  for (let index = 0; index < 6; index += 1) {
    rotation.push('Flying Cutter');

    if (index < 5) rotation.push({ name: '__wait', waitMs: 2100 });
  }

  const seed = 117;
  const result = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      food: 'Cilantro Lime Sous-Vide Steak',
      stats: {
        ...defaults.stats,
        precision: 1945
      },
      boons: {
        ...defaults.boons,
        fury: false
      },
      randomness: { mode: 'stochastic', seed }
    })
  );
  const sourceHits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter');
  const procRandom = createSimulationRandom({ mode: 'stochastic', seed });
  let expectedProcs = 0;
  let foodReadyAt = -Infinity;

  for (const event of sourceHits) {
    if (event.didCrit !== true || event.at < foodReadyAt) continue;

    if (!procRandom.roll(0.66, 'food.critical-strike')) continue;
    expectedProcs += 1;
    foodReadyAt = event.at + 2;
  }

  const nourishment = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Nourishment'
  );

  assert.equal(nourishment.length, expectedProcs);
});

test('critical-strike food procs remain unmodified without profession effects', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Flying Cutter', { name: '__wait', waitMs: 2000 }, 'Flying Cutter'],
    defaultSimulationConfig({
      food: 'Cilantro Lime Sous-Vide Steak',
      stats: {
        ...defaults.stats,
        precision: 3100
      }
    })
  );
  const nourishment = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Nourishment'
  );

  assert.equal(nourishment.length, 1);
  assert.equal(nourishment[0].damage, 325);
  const nourishmentBreakdown = result.breakdown.find((entry) => entry.name === 'Nourishment');

  assert.equal(nourishmentBreakdown.strikeDamage, 325);
  assert.equal(nourishmentBreakdown.conditionDamage, 0);
  const withoutVulnerability = simulateMesmer(
    ['Flying Cutter', { name: '__wait', waitMs: 2000 }, 'Flying Cutter'],
    defaultSimulationConfig({
      food: 'Cilantro Lime Sous-Vide Steak',
      stats: {
        ...defaults.stats,
        precision: 3100
      },
      target: {
        ...defaults.target,
        conditions: {
          ...defaults.target.conditions,
          Vulnerability: 0
        }
      }
    })
  ).resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Nourishment');

  assert.equal(withoutVulnerability.length, 1);
  assert.equal(withoutVulnerability[0].damage, 325);
  const nourishmentProc = result.procSteps.find((proc) => proc.type === 'food_proc' && proc.skill === 'Nourishment');

  assert.equal(nourishmentProc.icon, 'https://wiki.guildwars2.com/images/c/ca/Nourishment_food.png');
});

test('weapon-swap sigils resolve locally on the destination weapon set', () => {
  const result = simulateMesmer(
    ['Bladecall', 'Swap Weapons', 'Psycut', { name: '__wait', waitMs: 2000 }],
    defaultSimulationConfig({
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword',
      weaponSet2Primary: 'Spear',
      weaponSet2Secondary: '',
      sigilSets: [
        { names: [], strike: 1, condition: 1 },
        { names: ['Doom', 'Geomancy'], strike: 1, condition: 1 }
      ]
    })
  );

  assert.ok(
    result.resolvedEvents.some(
      (event) => event.skillName === 'Sigil of Geomancy' && event.condition === 'Bleeding' && event.damage > 0
    )
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.skillName === 'Sigil of Doom' && event.condition === 'Poisoned' && event.damage > 0
    )
  );
});

test('critical weapon-swap sigil strikes can trigger critical-hit sigils', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['__combat_start', 'Swap Weapons'],
    defaultSimulationConfig({
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword',
      weaponSet2Primary: 'Spear',
      weaponSet2Secondary: '',
      stats: { ...defaults.stats, precision: 4000 },
      sigilSets: [
        { names: [], strike: 1, condition: 1 },
        { names: ['Geomancy', 'Torment'], strike: 1, condition: 1 }
      ]
    })
  );

  assert.deepEqual(
    result.procSteps.map((proc) => proc.skill),
    ['Sigil of Geomancy', 'Sigil of Torment']
  );
  const torment = result.resolvedEvents.find(
    (event) => event.skillName === 'Sigil of Torment' && event.condition === 'Torment'
  );

  assert.equal(torment?.stacks, 2);
  assert.equal(torment?.duration, 5);
});

test('Severance affects strikes after its control trigger', () => {
  const defaults = defaultSimulationConfig();
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    initialResource: 0,
    stats: {
      ...defaults.stats,
      precision: 1000
    },
    boons: {
      ...defaults.boons,
      fury: false
    },
    target: {
      ...defaults.target,
      vulnerability: 0
    }
  });
  const run = (names) =>
    simulateMesmer(['Magic Bullet', 'Mind Slash'], {
      ...config,
      sigilSets: [
        { names, strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    });
  const base = run([]);
  const severance = run(['Severance']);
  const mindSlashDamage = (result) => result.breakdown.find((entry) => entry.sourceSkill === 'Mind Slash').strikeDamage;

  assert.ok(mindSlashDamage(severance) > mindSlashDamage(base));
  assert.ok(
    severance.procSteps.some((proc) => proc.skill === 'Sigil of Severance' && proc.sourceSkill === 'Magic Bullet')
  );
});
