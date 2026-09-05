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
