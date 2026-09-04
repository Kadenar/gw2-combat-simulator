import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';
import { createEventQueue } from '#kernel/events/queue.js';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { createGw2ConditionResolution } from '#gw2/platform/resolver/condition-resolution.js';

// Condition resolution preserves fractional ticks, observation boundaries, and environment attribution.
function tormentDamageAtMight(might) {
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
        might
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

  return result.resolvedEvents.find((event) => event.type === 'condition' && event.condition === 'Torment').damage;
}

test('Might increases condition damage as well as strike power', () => {
  assert.equal(tormentDamageAtMight(0), 121.8);
  assert.equal(tormentDamageAtMight(25), 189.3);
});

test('condition applications shorter than one second deal fractional damage', () => {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'condition',
        at: 0,
        name: 'Short Bleed',
        skillName: 'Short Bleed',
        condition: 'Bleeding',
        duration: 0.5,
        stacks: 1,
        source: 'Player',
        sourceId: 'short-bleed'
      }
    ],
    rotationEndTime: 2,
    resolverHandoff: {
      warnings: ['resolver handoff warning']
    }
  });
  const result = resolveTestGw2Stream({
    stream,
    config: {
      target: {},
      sigilSets: [{ names: [] }]
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0
      }),
      critical: () => ({ chance: 0.05, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1000
    }
  });

  assert.ok(result.conditionDamage > 0);
  assert.equal(result.firstHitTime, 0.5);
  assert.equal(result.resolvedEvents[0].damageTicks.length, 1);
  assert.equal(result.resolvedEvents[0].damageTicks[0].fraction, 0.5);
  assert.deepEqual(result.warnings, ['resolver handoff warning']);
});

test('staggered condition applications preserve fractional stack-seconds', () => {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'condition',
        at: 0,
        name: 'Long Bleed',
        skillName: 'Long Bleed',
        condition: 'Bleeding',
        duration: 1.25,
        stacks: 1,
        source: 'Player',
        sourceId: 'long-bleed'
      },
      {
        type: 'condition',
        at: 0.75,
        name: 'Short Bleed',
        skillName: 'Short Bleed',
        condition: 'Bleeding',
        duration: 0.5,
        stacks: 1,
        source: 'Player',
        sourceId: 'short-bleed'
      }
    ],
    rotationEndTime: 2
  });
  const result = resolveTestGw2Stream({
    stream,
    config: {
      target: {},
      sigilSets: [{ names: [] }]
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0
      }),
      critical: () => ({ chance: 0.05, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1000
    }
  });

  const applications = result.resolvedEvents.filter((event) => event.type === 'condition');

  // Independent fractional durations integrate to 1.75 stack-seconds instead
  // of being rounded onto a shared one-second condition-tick cadence.
  assert.equal(
    applications.reduce((total, application) => total + application.damagingStackSeconds, 0),
    1.75
  );
  assert.equal(result.conditionDamage, 143.5);
});

function resolveBleedThrough(rotationEndTime, { duration = 5, targetHealth = 0, startingHealthFraction = 1 } = {}) {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'condition',
        at: 0,
        name: 'Observed Bleed',
        skillName: 'Observed Bleed',
        condition: 'Bleeding',
        duration,
        stacks: 1,
        source: 'Player',
        sourceId: 'observed-bleed'
      }
    ],
    rotationEndTime
  });

  return resolveTestGw2Stream({
    stream,
    config: {
      target: targetHealth > 0 ? { health: targetHealth, startingHealthFraction } : {},
      sigilSets: [{ names: [] }]
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0
      }),
      critical: () => ({ chance: 0.05, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1000
    }
  });
}

test('observation horizons omit future condition ticks without creating endpoint damage', () => {
  const clipped = resolveBleedThrough(1.5);
  const extended = resolveBleedThrough(2);
  const clippedApplication = clipped.resolvedEvents.find((event) => event.type === 'condition');
  const extendedApplication = extended.resolvedEvents.find((event) => event.type === 'condition');

  assert.deepEqual(
    clippedApplication.damageTicks.map(({ at, fraction }) => ({ at, fraction })),
    [{ at: 1, fraction: 1 }]
  );
  assert.deepEqual(
    extendedApplication.damageTicks.map(({ at, fraction }) => ({ at, fraction })),
    [
      { at: 1, fraction: 1 },
      { at: 2, fraction: 1 }
    ]
  );
  assert.equal(clipped.conditionDamage, extendedApplication.damageTicks[0].damage);
});

test('target death occurs on natural condition ticks rather than the observation horizon', () => {
  const beforeNextTick = resolveBleedThrough(1.5, { targetHealth: 100 });
  const throughNextTick = resolveBleedThrough(2, { targetHealth: 100 });
  const throughNaturalRemainder = resolveBleedThrough(2, { duration: 1.5, targetHealth: 100 });
  const halfHealthTarget = resolveBleedThrough(2, { targetHealth: 200, startingHealthFraction: 0.5 });
  const deadTarget = resolveBleedThrough(2, { targetHealth: 100, startingHealthFraction: 0 });
  const remainderApplication = throughNaturalRemainder.resolvedEvents.find((event) => event.type === 'condition');

  assert.equal(beforeNextTick.deathTime, null);
  assert.ok(beforeNextTick.totalDamage < 100);
  assert.equal(throughNextTick.deathTime, 2);
  assert.equal(halfHealthTarget.deathTime, 2);
  assert.equal(deadTarget.deathTime, 0);
  assert.equal(deadTarget.totalDamage, 0);
  assert.equal(throughNaturalRemainder.deathTime, 1.5);
  assert.deepEqual(
    remainderApplication.damageTicks.map(({ at, fraction }) => ({ at, fraction })),
    [
      { at: 1, fraction: 1 },
      { at: 1.5, fraction: 0.5 }
    ]
  );
});

test('precombat conditions carry across an explicit combat start', () => {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'condition',
        at: 0,
        name: 'Precombat Bleed',
        skillName: 'Precombat Bleed',
        condition: 'Bleeding',
        duration: 3,
        stacks: 1,
        source: 'Player',
        sourceId: 'precombat-bleed'
      },
      {
        type: 'combat_start',
        at: 1,
        source: 'rotation',
        sourceId: 'combat-start'
      }
    ],
    rotationEndTime: 3,
    resolverHandoff: {
      hasExplicitCombatStart: true,
      combatStartTime: 1,
      warnings: []
    }
  });
  const result = resolveTestGw2Stream({
    stream,
    config: {
      target: {},
      sigilSets: [{ names: [] }]
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0
      }),
      critical: () => ({ chance: 0.05, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1000
    }
  });

  const application = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.name === 'Precombat Bleed'
  );

  assert.equal(result.firstHitTime, 1);
  assert.equal(application.at, 0);
  assert.deepEqual(
    application.damageTicks.map((tick) => tick.at),
    [1, 2, 3]
  );
  assert.equal(result.conditionDamage, 246);
});

/** Resolves a minimal stream against permanent target conditions with player-neutral numeric facts. */
function resolveEnvironmentConditions({
  conditions = {},
  events = [],
  rotationEndTime = 2,
  targetHealth = 10_000,
  target = {},
  professionReactions = {}
} = {}) {
  const config = {
    target: {
      armor: 1000,
      health: targetHealth,
      conditions,
      ...target
    },
    sigilSets: [{ names: [] }]
  };
  const stream = buildScheduledEventStream({ events, rotationEndTime });
  return resolveTestGw2Stream({
    stream,
    config,
    traits: new Set(),
    professionReactions,
    query: {
      statsAt: () => ({
        power: 1000,
        precision: 1000,
        toughness: 1000,
        vitality: 1000,
        ferocity: 0,
        conditionDamage: 9000,
        expertise: 0,
        concentration: 0,
        healingPower: 0
      }),
      critical: () => ({ chance: 0, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      conditionBaseDurationMultiplier: () => 1,
      vulnerabilityStacksAt: () => Number(conditions.Vulnerability || 0),
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1000
    }
  });
}

test('permanent damaging target conditions use environment formulas and diagnostics', () => {
  const result = resolveEnvironmentConditions({
    conditions: {
      Bleeding: 1,
      Burning: true,
      Poisoned: true,
      Torment: 1,
      Confusion: 1,
      Chilled: true
    },
    rotationEndTime: 1,
    target: {
      moving: true,
      confusionActivationsPerSecond: 100
    }
  });
  const damageByCondition = Object.fromEntries(
    result.environmentConditionBreakdown.map((entry) => [entry.name, entry.damage])
  );

  assert.deepEqual(damageByCondition, {
    Burning: 131,
    Poisoned: 33.5,
    Torment: 31.8,
    Bleeding: 22,
    Confusion: 18.25
  });
  assert.ok(Math.abs(result.environmentDamage - 236.55) < 1e-12);
  assert.equal(result.environmentDps, result.environmentDamage);
  assert.equal(result.totalDamage, 0);
  assert.equal(result.dps, 0);
  assert.equal(result.strikeDamage, 0);
  assert.equal(result.conditionDamage, 0);
  assert.equal(result.firstHitTime, null);
  assert.equal(result.lastHitTime, null);
  assert.deepEqual(result.breakdown, []);
  assert.deepEqual(result.conditionBreakdown, []);
});

test('environment condition ticks reduce target health and can kill the target', () => {
  const result = resolveEnvironmentConditions({
    conditions: { Bleeding: 1 },
    rotationEndTime: 5,
    targetHealth: 30
  });

  assert.equal(result.deathTime, 2);
  assert.equal(result.environmentDamage, 44);
  assert.deepEqual(
    result.environmentConditionBreakdown[0].damageTicks.map((tick) => tick.at),
    [1, 2]
  );
  assert.equal(result.totalDamage, 0);
  assert.equal(result.firstHitTime, null);
});

test('environment condition damage applies target Vulnerability without player attributes', () => {
  const result = resolveEnvironmentConditions({
    conditions: { Bleeding: 1, Vulnerability: 25 },
    rotationEndTime: 1
  });

  assert.equal(result.environmentDamage, 27.5);
});

test('environment conditions do not change player attribution over an equal observation window', () => {
  const events = [
    {
      type: 'damage',
      at: 0.5,
      source: 'Player',
      sourceId: 'fixed-hit-one',
      actorType: 'player',
      name: 'Fixed Hit One',
      flatDamage: 50,
      noCrit: true
    },
    {
      type: 'damage',
      at: 1.5,
      source: 'Player',
      sourceId: 'fixed-hit-two',
      actorType: 'player',
      name: 'Fixed Hit Two',
      flatDamage: 50,
      noCrit: true
    }
  ];
  const baseline = resolveEnvironmentConditions({ events, rotationEndTime: 2.5 });
  const ambient = resolveEnvironmentConditions({ conditions: { Bleeding: 1 }, events, rotationEndTime: 2.5 });

  for (const field of ['totalDamage', 'dps', 'strikeDamage', 'conditionDamage', 'firstHitTime', 'lastHitTime']) {
    assert.equal(ambient[field], baseline[field], field);
  }

  assert.deepEqual(ambient.breakdown, baseline.breakdown);
  assert.ok(ambient.environmentDamage > 0);
});

test('environment damage can end a player sequence early without entering player totals', () => {
  const events = [0.5, 1.5, 2.5].map((at, index) => ({
    type: 'damage',
    at,
    source: 'Player',
    sourceId: `early-hit-${index}`,
    actorType: 'player',
    name: `Early Hit ${index}`,
    flatDamage: 20,
    noCrit: true
  }));
  const baseline = resolveEnvironmentConditions({ events, rotationEndTime: 3, targetHealth: 75 });
  const ambient = resolveEnvironmentConditions({
    conditions: { Bleeding: 1 },
    events,
    rotationEndTime: 3,
    targetHealth: 75
  });

  assert.equal(baseline.deathTime, null);
  assert.equal(baseline.totalDamage, 60);
  assert.equal(ambient.deathTime, 2);
  assert.equal(ambient.totalDamage, 40);
  assert.equal(ambient.environmentDamage, 44);
  assert.ok(ambient.totalDamage + ambient.environmentDamage >= 75);
});

test('environment scheduling preserves permanent status counts without duplicating runtime stacks', () => {
  const resolution = createGw2ConditionResolution({
    reactions: { dispatch: () => {} },
    config: { target: { conditions: { Bleeding: 2 } } }
  });
  const context = {
    horizon: 2,
    queue: createEventQueue(),
    conditionState: new Map(),
    environmentConditions: new Map()
  };

  resolution.initializeEnvironment(context);

  assert.equal(resolution.activeConditionStackCount(context, 'Bleeding', 1), 2);
  assert.equal(context.conditionState.size, 0);
  assert.equal(context.environmentConditions.get('Bleeding').stacks, 2);
  assert.equal(context.queue.length, 2);
});

test('non-damaging permanent target conditions do not schedule environment ticks', () => {
  const result = resolveEnvironmentConditions({
    conditions: { Chilled: true, Weakness: true, Blindness: true },
    rotationEndTime: 3
  });

  assert.equal(result.environmentDamage, 0);
  assert.deepEqual(result.environmentConditionBreakdown, []);
  assert.equal(result.deathTime, null);
});

test('target-health coefficient thresholds include environment damage', () => {
  const events = [
    {
      type: 'damage',
      at: 0.5,
      source: 'Player',
      sourceId: 'threshold-opening',
      actorType: 'player',
      name: 'Threshold Opening',
      coefficient: 0.04,
      weaponStrengthProfileId: 'weapon.sword',
      noCrit: true
    },
    {
      type: 'damage',
      at: 1.5,
      source: 'Player',
      sourceId: 'threshold-finisher',
      actorType: 'player',
      name: 'Threshold Finisher',
      coefficient: 0.04,
      weaponStrengthProfileId: 'weapon.sword',
      coefficientModifiers: [{ kind: 'target-health-below', threshold: 0.5, multiplier: 2 }],
      noCrit: true
    }
  ];
  const baseline = resolveEnvironmentConditions({ events, rotationEndTime: 2, targetHealth: 100 });
  const ambient = resolveEnvironmentConditions({
    conditions: { Bleeding: 1 },
    events,
    rotationEndTime: 2,
    targetHealth: 100
  });
  const finisher = (result) => result.resolvedEvents.find((event) => event.name === 'Threshold Finisher').damage;

  assert.equal(finisher(baseline), 40);
  assert.equal(finisher(ambient), 80);
});

test('environment ticks bypass player condition reactions and proc accounting', () => {
  let conditionTickReactions = 0;
  const result = resolveEnvironmentConditions({
    conditions: { Bleeding: 1 },
    rotationEndTime: 2,
    professionReactions: {
      'condition-tick.resolved': () => {
        conditionTickReactions += 1;
      }
    }
  });

  assert.equal(result.environmentDamage, 44);
  assert.equal(conditionTickReactions, 0);
  assert.deepEqual(result.procSteps, []);
});

test('an explicit empty target condition map does not restore default conditions', () => {
  const defaults = defaultSimulationConfig();
  const run = (conditions) =>
    simulateMesmer(
      ['Bladecall'],
      defaultSimulationConfig({
        target: {
          ...defaults.target,
          conditions
        }
      })
    ).strikeDamage;

  const unconditioned = run({});
  const vulnerable = run({ Vulnerability: 25 });

  assert.ok(Math.abs(vulnerable / unconditioned - 1.25) < 1e-12);
});
