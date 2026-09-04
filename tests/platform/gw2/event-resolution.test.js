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
