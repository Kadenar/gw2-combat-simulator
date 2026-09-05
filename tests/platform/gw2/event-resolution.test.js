import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';
import { createGw2ResolverEventHandlers } from '#gw2/platform/resolver/event-handlers.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { testProfession } from '../../fixtures/test-profession.js';

// Generic event resolution preserves recipient, strike, and profession-state contracts.
test('shared buff handling prioritizes allied players over summon recipients', () => {
  const handlers = createGw2ResolverEventHandlers({
    hitResolution: {
      buildContext: () => ({}),
      apply: () => {}
    },
    conditions: {
      activeStackCount: () => 0,
      apply: () => {},
      tick: () => ({})
    },
    reactions: { dispatch: () => {} }
  });
  const context = {
    config: {
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    },
    boons: new Map()
  };
  const application = {
    type: 'buff',
    at: 0,
    source: 'Player',
    sourceId: 'party-might',
    actorType: 'player',
    kind: 'might',
    duration: 10,
    stacks: 1,
    audience: {
      recipients: 'party',
      maximumRecipients: 5,
      eligibleCompanionIds: ['clone:one', 'clone:two']
    }
  };

  handlers.buff(context, application);

  assert.deepEqual(application.resolvedAudience, {
    includesSelf: true,
    includesSummons: false,
    alliedPlayerCount: 4,
    companionIds: [],
    recipientCount: 5
  });
});

test('flat and no-crit strikes skip critical queries', () => {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'damage',
        at: 1,
        name: 'Flat strike',
        skillName: 'Flat strike',
        flatDamage: 10,
        source: 'Player',
        sourceId: 'flat-strike',
        actorType: 'player'
      },
      {
        type: 'damage',
        at: 1.1,
        name: 'No-crit strike',
        skillName: 'No-crit strike',
        coefficient: 1,
        noCrit: true,
        weaponStrength: 1_000,
        source: 'Player',
        sourceId: 'no-crit-strike',
        actorType: 'player'
      }
    ],
    rotationEndTime: 1.1
  });
  let criticalQueries = 0;
  const result = resolveTestGw2Stream({
    stream,
    config: { sigilSets: [{ names: [] }] },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1_000,
        precision: 1_000,
        ferocity: 0,
        conditionDamage: 0,
        expertise: 0
      }),
      critical: () => {
        criticalQueries += 1;

        return { chance: 0.5, damage: 2 };
      },
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
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage');

  assert.equal(criticalQueries, 0);
  assert.equal(strikes.length, 2);
  for (const strike of strikes) {
    assert.equal(strike.criticalChance, 0);
    assert.equal(strike.criticalChanceBeforeCap, 0);
    assert.deepEqual(strike.criticalChanceContributors, []);
    assert.equal(strike.criticalDamage, 1);
    assert.equal(strike.critEligible, false);
  }
});

test('slot-skill strikes select nonweapon strength generically', () => {
  const result = simulateMesmer(['Power Spike'], defaultSimulationConfig({ specialization: 'Core' }));
  const powerSpike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Power Spike'
  );

  assert.equal(powerSpike.skillWeapon, 'Unequipped');
});

test('resolver profession state changes are chronological and preserve counters', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 980001,
        name: 'Chronology Fixture',
        type: 'Utility',
        castTimeMs: 0,
        effects: [
          strikeTimeline(
            [
              { atMs: 1000, coefficient: 1 },
              { atMs: 5000, coefficient: 1 },
              { atMs: 6000, coefficient: 1 }
            ],
            {
              timingAnchor: 'castStart',
              timingScale: 'fixed'
            }
          ),
          {
            type: 'custom',
            eventType: 'chronology-fixture.state',
            atMs: 5000,
            event: { active: true, priority: -10 },
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'chronology-fixture',
    name: 'Chronology Fixture',
    catalog,
    resources: {
      createProfessionState: (config) => ({
        active: Boolean(config.initialActive),
        hitCount: 0
      }),
      createResolverState: (config) => ({
        active: Boolean(config.initialActive),
        hitCount: 0
      }),
      projectEndState: ({ resolverState }) => ({
        active: resolverState.active
      })
    },
    attributeRules: {
      modifyStrikeDamage(context, value) {
        return context.runtime.profession.active ? value * 2 : value;
      }
    },
    resolverHooks: {
      eventHandlers: {
        'chronology-fixture.state': (context, event) => {
          context.profession.active = event.active;
        }
      },
      eventReactions: {
        'damage.resolved': (context) => {
          context.profession.hitCount += 1;
        }
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: ['Chronology Fixture', { type: 'wait', durationMs: 6000 }]
  });
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage');

  assert.equal(Math.round(hits[1].damage / hits[0].damage), 2);
  assert.equal(Math.round(hits[2].damage / hits[0].damage), 2);
  assert.equal(result.profession.hitCount, 3);
  assert.deepEqual(result.endState.profession, { active: true });

  const configured = simulateGw2({
    profession,
    rotation: ['Chronology Fixture', { type: 'wait', durationMs: 6000 }],
    config: { initialActive: true }
  });
  const configuredHits = configured.resolvedEvents.filter((event) => event.type === 'damage');

  assert.equal(Math.round(configuredHits[2].damage / configuredHits[0].damage), 1);
});

test('off-target casts retain their activation while hostile packets miss the target', () => {
  const result = simulateGw2({
    profession: testProfession,
    rotation: [{ type: 'cast', skillId: 900001, offTarget: true }],
    config: {
      attributes: { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0 },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });
  const activationEvents = result.events.filter((event) => event.sourceId === 900001);

  assert.equal(result.steps[0].end, 1000);
  assert.equal(
    activationEvents.every((event) => event.offTarget === true),
    true
  );
  assert.equal(
    activationEvents.some((event) => event.type === 'damage'),
    true
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage'),
    false
  );
  assert.equal(result.endState.profession.controlEvents, 0);
});

test('test profession runs end to end without importing Mesmer', () => {
  const base = simulateGw2({
    profession: testProfession,
    rotation: [
      { type: 'cast', skillId: 900001 },
      { type: 'cast', skillId: 900002 }
    ],
    config: {
      selectedTraitIds: ['fixture.power'],
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });
  const withoutTrait = simulateGw2({
    profession: testProfession,
    rotation: [{ type: 'cast', skillId: 900001 }],
    config: {
      attributes: {
        power: 1000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 0
      },
      target: { armor: 2597 },
      weaponStrength: 1000
    }
  });

  assert.ok(base.totalDamage > withoutTrait.totalDamage);
  assert.equal(base.profession.charge, 1);
  assert.equal(base.profession.controlEvents, 1);
  assert.equal(base.schedulerState.profession.charge, 0);
  assert.equal(
    base.events.every((event) => event.type && Number.isFinite(event.at) && event.source && event.sourceId != null),
    true
  );
});

test('resolver modifiers receive stable trait, event, and runtime context', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930002,
        name: 'Context Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  let observed = null;
  const profession = defineProfession({
    id: 'context-fixture',
    name: 'Context Fixture',
    catalog,
    attributeRules: {
      modifyStrikeDamage(context, multiplier) {
        observed = {
          actorType: context.actorType,
          hasRuntimeProfession: Boolean(context.runtime?.profession),
          skillId: context.skillId,
          trait: context.traits.has('context-fixture.damage')
        };

        return observed.trait && observed.skillId === 930002 ? multiplier * 2 : multiplier;
      }
    }
  });
  const base = simulateGw2({
    profession,
    rotation: ['Context Strike']
  });
  const modified = simulateGw2({
    profession,
    rotation: ['Context Strike'],
    config: {
      selectedTraitIds: ['context-fixture.damage']
    }
  });

  assert.equal(modified.strikeDamage / base.strikeDamage, 2);
  assert.deepEqual(observed, {
    actorType: 'player',
    hasRuntimeProfession: true,
    skillId: 930002,
    trait: true
  });
});
