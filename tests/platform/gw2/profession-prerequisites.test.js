import assert from 'node:assert/strict';
import test from 'node:test';

import { simulationEventLogRows } from '#gw2/app/rotation/result/simulation-event-log.js';
import { createFixedSlotLoadout } from '#gw2/platform/builds/slot-loadout.js';
import {
  createProfessionAssumptionControls,
  normalizeProfessionAssumptions,
  STANDARD_POSITION_ASSUMPTION_CONTROLS,
  validateProfessionAssumptions
} from '#gw2/platform/builds/assumptions.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { createGw2CombatQuery, selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat/query/timeline-index.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { validateTraitCoverageManifest } from '../../helpers/trait-coverage.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { isGw2WeaponSkillEquipped } from '#gw2/platform/scheduler/policy.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';

const queryProfession = defineProfession({
  id: 'query-fixture',
  name: 'Query Fixture'
});

/** Builds the resolved recipient facts expected by low-level query fixtures. */
function resolvedAudience({ includesSelf = true, alliedPlayerCount = 0, companionIds = [] } = {}) {
  return {
    includesSelf,
    includesSummons: companionIds.length > 0,
    alliedPlayerCount,
    companionIds,
    recipientCount: Number(includesSelf) + alliedPlayerCount + companionIds.length
  };
}

test('profession composition validates UI callbacks and scheduler refiners', () => {
  assert.throws(
    () =>
      defineProfession({
        id: 'invalid-ui',
        name: 'Invalid UI',
        ui: { eventLogRow: true }
      }),
    /ui\.eventLogRow must be a function/
  );

  const invalidAvailability = defineProfession({
    id: 'invalid-availability',
    name: 'Invalid Availability',
    ui: {
      paletteSkillAvailability: () => true
    }
  });

  assert.throws(() => invalidAvailability.ui.paletteSkillAvailability({}, {}), /must return an object/);

  const mutating = defineProfession({
    id: 'mutating-refiner',
    name: 'Mutating Refiner',
    simulation: {
      refineSchedulerConfig(config) {
        config.changed = true;

        return { ...config };
      }
    }
  });

  assert.throws(() => mutating.simulation.refineSchedulerConfig({}, {}), /must not mutate prior config/);

  const sameObject = defineProfession({
    id: 'same-refiner',
    name: 'Same Refiner',
    simulation: {
      refineSchedulerConfig(config) {
        return config;
      }
    }
  });

  assert.throws(() => sameObject.simulation.refineSchedulerConfig({}, {}), /must return a new config object/);
});

test('target-condition queries combine assumptions and chronological runtime state', () => {
  const query = createGw2CombatQuery({
    profession: queryProfession,
    config: {
      target: {
        conditions: {
          Cripple: true,
          Vulnerability: 2
        }
      }
    }
  });
  const runtime = {
    conditionState: new Map([
      [
        'Poisoned',
        {
          stacks: [
            { appliedAt: 0, expiresAt: 2, weight: 2 },
            { appliedAt: 1, expiresAt: 3, weight: 3, removedAt: 2.5 }
          ]
        }
      ],
      [
        'Chilled',
        {
          stacks: [{ appliedAt: 0.5, expiresAt: 1.5, weight: 1 }]
        }
      ],
      [
        'Vulnerability',
        {
          stacks: [{ appliedAt: 0, expiresAt: 2, weight: 3 }]
        }
      ]
    ]),
    boons: new Map()
  };

  assert.equal(canonicalTargetConditionName('poison'), 'Poisoned');
  assert.equal(canonicalTargetConditionName('cripple'), 'Crippled');
  assert.equal(query.targetConditionStacks('Crippled', 1, runtime), 1);
  assert.equal(query.targetConditionStacks('Poison', 0.5, runtime), 2);
  assert.equal(query.targetConditionStacks('Poisoned', 1, runtime), 5);
  assert.equal(query.targetConditionStacks('Poisoned', 2, runtime), 3);
  assert.equal(query.targetConditionStacks('Poisoned', 2.5, runtime), 0);
  assert.equal(query.targetHasCondition('Chill', 1, runtime), true);
  assert.equal(query.targetHasCondition('Chilled', 1.5, runtime), false);
  assert.equal(query.targetConditionStacks('Vulnerability', 1, runtime), 5);
  assert.equal(query.targetConditionStacks('Vulnerability', 2, runtime), 2);
});

test('combat lookups normalize once per query without stale cross-query state', () => {
  const config = {
    selectedTraitIds: [123],
    target: { conditions: { poison: 1 } }
  };
  const traits = selectedGw2TraitValues(config, {
    traits: [{ id: 123, name: 'Fixture Trait' }]
  });

  assert.equal(hasTrait({ config, traits }, 123), true);
  assert.equal(hasTrait({ config, traits }, '123'), true);
  assert.equal(hasTrait({ config, traits }, 456), false);
  assert.equal(hasTrait({ config }, '123'), true);
  assert.equal(hasTrait({ config, catalog: { traits: [{ id: 123, name: 'Fixture Trait' }] } }, 'Fixture Trait'), true);

  const first = createGw2CombatQuery({ profession: queryProfession, config });

  assert.equal(first.targetConditionStacks('Poisoned', 0), 1);
  config.target.conditions.poison = 2;
  const second = createGw2CombatQuery({ profession: queryProfession, config });

  assert.equal(second.targetConditionStacks('Poisoned', 0), 2);
});

test('same-time target-condition visibility follows runtime insertion order', () => {
  const query = createGw2CombatQuery({
    profession: queryProfession,
    config: { target: { conditions: {} } }
  });
  const runtime = { conditionState: new Map(), boons: new Map() };

  assert.equal(query.targetHasCondition('Weakness', 1, runtime), false);
  runtime.conditionState.set('Weakness', {
    stacks: [{ appliedAt: 1, expiresAt: 3, weight: 1 }]
  });
  assert.equal(query.targetHasCondition('Weakness', 1, runtime), true);
  assert.equal(query.targetHasCondition('Weakness', 3, runtime), false);
});

test('timeline indexes buff stacks by kind and summon audience', () => {
  const timeline = createGw2TimelineIndex({
    events: [
      {
        type: 'buff',
        at: 0,
        source: 'Player',
        sourceId: 'player-might',
        kind: 'MIGHT',
        duration: 2,
        stacks: 3,
        resolvedAudience: resolvedAudience()
      },
      {
        type: 'buff',
        at: 0,
        source: 'Player',
        sourceId: 'shared-might',
        kind: 'might',
        duration: 2,
        stacks: 4,
        resolvedAudience: resolvedAudience({ companionIds: ['minion:one'] })
      },
      {
        type: 'buff',
        at: 0,
        source: 'Trait',
        sourceId: 'trait-might',
        kind: 'might',
        duration: 2,
        stacks: 2,
        resolvedAudience: resolvedAudience({ companionIds: ['minion:one', 'minion:two'] })
      },
      {
        type: 'buff',
        at: 0,
        source: 'Trait',
        sourceId: 'summon-only-might',
        kind: 'might',
        duration: 2,
        stacks: 5,
        resolvedAudience: resolvedAudience({ includesSelf: false, companionIds: ['minion:one', 'minion:two'] })
      },
      {
        type: 'buff',
        at: 0,
        source: 'Player',
        sourceId: 'quickness-one',
        kind: 'quickness',
        duration: 2,
        resolvedAudience: resolvedAudience()
      },
      {
        type: 'buff',
        at: 1,
        source: 'Trait',
        sourceId: 'quickness-two',
        kind: 'quickness',
        duration: 2,
        resolvedAudience: resolvedAudience()
      }
    ]
  });

  assert.equal(timeline.buffStacksAt('might', 1, 0, 25), 9);
  assert.equal(timeline.buffStacksAt('Might', 1, 0, 25, 'summon'), 11);
  assert.equal(timeline.buffStacksAt('might', 1, 0, 25, 'summon', 'minion:one'), 11);
  assert.equal(timeline.buffStacksAt('might', 1, 0, 25, 'summon', 'minion:two'), 7);
  assert.equal(timeline.buffStacksAt('might', 1, 0, 25, 'summon-trait'), 7);
  assert.equal(timeline.buffStacksAt('might', 1, 0, 5), 5);
  assert.equal(timeline.buffStacksAt('might', 2, 0, 25), 0);
  assert.equal(timeline.buffStacksAt('quickness', 3.5, 0, 1), 1);
  assert.equal(timeline.buffStacksAt('quickness', 4, 0, 1), 0);
});

test('effective boon and Vulnerability queries use their canonical runtime state', () => {
  const events = [
    {
      type: 'buff',
      at: 1,
      source: 'Player',
      sourceId: 'might',
      kind: 'might',
      duration: 5,
      stacks: 5,
      resolvedAudience: resolvedAudience()
    },
    {
      type: 'buff',
      at: 1,
      source: 'Player',
      sourceId: 'fury',
      kind: 'fury',
      duration: 5,
      stacks: 1,
      resolvedAudience: resolvedAudience()
    },
    {
      type: 'condition',
      at: 1,
      source: 'Player',
      sourceId: 'vulnerability',
      condition: 'Vulnerability',
      duration: 5,
      stacks: 3
    }
  ];
  const query = createGw2CombatQuery({
    profession: queryProfession,
    config: {
      boons: { might: 2, fury: false },
      target: { conditions: { Vulnerability: 1, Slow: true } }
    },
    events
  });
  const runtime = { boons: new Map(), conditionState: new Map() };
  const event = {
    type: 'damage',
    at: 1,
    source: 'Player',
    sourceId: 'hit',
    actorType: 'player'
  };

  assert.equal(query.mightStacksAt(1, runtime, event), 2);
  assert.equal(query.furyActiveAt(1, runtime, event), false);
  assert.equal(query.vulnerabilityStacksAt(1, runtime), 1);
  assert.equal(query.targetHasCondition('Slow', 1, runtime), true);
  assert.equal(query.mightStacksAt(1, null, event), 7);
  assert.equal(query.furyActiveAt(1, null, event), true);
  assert.equal(query.vulnerabilityStacksAt(1, null), 1);

  runtime.boons.set('might', [{ at: 1, expiresAt: 6, stacks: 5, resolvedAudience: resolvedAudience() }]);
  runtime.boons.set('fury', [{ at: 1, expiresAt: 6, stacks: 1, resolvedAudience: resolvedAudience() }]);
  runtime.conditionState.set('Vulnerability', {
    stacks: [{ appliedAt: 1, expiresAt: 6, weight: 3 }]
  });

  assert.equal(query.mightStacksAt(1, runtime, event), 7);
  assert.equal(query.furyActiveAt(1, runtime, event), true);
  assert.equal(query.vulnerabilityStacksAt(1, runtime), 4);
});

test('player boon sharing can exclude non-mech summons', () => {
  const events = [
    {
      type: 'buff',
      at: 0,
      source: 'Player',
      sourceId: 'player-might',
      actorType: 'player',
      kind: 'might',
      duration: 10,
      stacks: 5,
      resolvedAudience: resolvedAudience()
    },
    {
      type: 'buff',
      at: 0,
      source: 'Player',
      sourceId: 'player-fury',
      actorType: 'player',
      kind: 'fury',
      duration: 10,
      stacks: 1,
      resolvedAudience: resolvedAudience()
    }
  ];
  const runtime = {
    boons: new Map([
      ['might', [{ at: 0, expiresAt: 10, stacks: 5, resolvedAudience: resolvedAudience() }]],
      ['fury', [{ at: 0, expiresAt: 10, stacks: 1, resolvedAudience: resolvedAudience() }]]
    ])
  };
  const config = {
    stats: {
      power: 1000,
      precision: 1000
    },
    boons: {
      might: 5,
      fury: false
    }
  };
  const damageEvent = {
    type: 'damage',
    at: 1,
    source: 'Player',
    sourceId: 'fixture-hit',
    actorType: 'player',
    coefficient: 1
  };
  const summonEvent = {
    ...damageEvent,
    source: 'Minion',
    actorType: 'summon'
  };
  const mechEvent = {
    ...summonEvent,
    source: 'engineer',
    metadata: { engineerMech: true },
    summonInheritsAttributes: true
  };
  const phantasmEvent = {
    ...summonEvent,
    source: 'Phantasm'
  };
  const spiritSkillEvent = {
    ...summonEvent,
    source: 'Spirit',
    actorType: 'player',
    summonKind: 'spirit',
    spiritAttackType: 'initial'
  };
  const spiritAutoattackEvent = {
    ...spiritSkillEvent,
    actorType: 'summon',
    spiritAttackType: 'autoattack'
  };
  const shared = createGw2CombatQuery({
    profession: queryProfession,
    config: {
      ...config,
      sharePlayerBoonsWithSummons: true
    },
    events
  });
  const isolated = createGw2CombatQuery({
    profession: queryProfession,
    config: {
      ...config,
      sharePlayerBoonsWithSummons: false
    },
    events
  });

  assert.equal(shared.statsAt(1, damageEvent, runtime).power, 1300);
  // Both permanent and runtime player-only Might stay on the player.
  assert.equal(shared.statsAt(1, summonEvent, runtime).power, 1000);
  assert.equal(isolated.statsAt(1, summonEvent, runtime).power, 1000);
  assert.equal(isolated.statsAt(1, mechEvent, runtime).power, 1300);
  assert.equal(isolated.statsAt(1, phantasmEvent, runtime).power, 1300);
  assert.equal(isolated.statsAt(1, spiritSkillEvent, runtime).power, 1300);
  assert.equal(isolated.statsAt(1, spiritAutoattackEvent, runtime).power, 1000);
  assert.equal(shared.critical(summonEvent, 1, runtime).chance, 0.05);
  assert.equal(isolated.critical(summonEvent, 1, runtime).chance, 0.05);
  assert.equal(isolated.critical(mechEvent, 1, runtime).chance, 0.3);
});

test('summon-targeted trait boons bypass disabled player boon sharing', () => {
  const events = [
    {
      type: 'buff',
      at: 0,
      source: 'Trait',
      sourceId: 'summon-trait',
      actorType: 'effect',
      kind: 'might',
      duration: 10,
      stacks: 2,
      resolvedAudience: resolvedAudience({ companionIds: ['fixture-minion'] })
    },
    {
      type: 'buff',
      at: 0,
      source: 'Trait',
      sourceId: 'self-fury',
      actorType: 'effect',
      kind: 'fury',
      duration: 8,
      stacks: 1,
      resolvedAudience: resolvedAudience()
    },
    {
      type: 'buff',
      at: 0,
      source: 'Trait',
      sourceId: 'allied-fury',
      actorType: 'effect',
      kind: 'fury',
      duration: 4,
      stacks: 1,
      resolvedAudience: resolvedAudience({ includesSelf: false, companionIds: ['fixture-minion'] })
    }
  ];
  const query = createGw2CombatQuery({
    profession: queryProfession,
    config: {
      stats: {
        power: 1000,
        precision: 1000,
        conditionDurationBonus: 25,
        conditionDurationBonuses: { Bleeding: 15 }
      },
      boons: { might: 25, fury: false },
      sharePlayerBoonsWithSummons: false
    },
    events
  });
  const summonEvent = {
    type: 'damage',
    at: 1,
    source: 'Minion',
    sourceId: 'fixture-minion',
    actorType: 'summon',
    summonOwner: 'fixture-minion',
    coefficient: 1
  };
  const independentSummonEvent = {
    ...summonEvent,
    independentSummonStrike: true,
    summonBasePower: 1524,
    summonBaseConditionDamage: 1000,
    summonBaseExpertise: 150
  };

  assert.equal(query.statsAt(1, summonEvent).power, 1060);
  assert.equal(query.statsAt(1, independentSummonEvent).conditionDamage, 1060);
  assert.equal(query.statsAt(1, independentSummonEvent).conditionDurationBonus, 0);
  assert.deepEqual(query.statsAt(1, independentSummonEvent).conditionDurationBonuses, {});
  assert.equal(
    query.conditionDurationMultiplier('Bleeding', 1, query.statsAt(1, independentSummonEvent), independentSummonEvent),
    1.1
  );
  assert.deepEqual(
    {
      power: query.statsAt(1, { ...independentSummonEvent, summonUsesMight: false }).power,
      conditionDamage: query.statsAt(1, { ...independentSummonEvent, summonUsesMight: false }).conditionDamage
    },
    { power: 1524, conditionDamage: 1000 }
  );
  assert.equal(query.critical(summonEvent, 1).chance, 0.3);
  assert.equal(query.critical(summonEvent, 5).chance, 0.05);
  assert.equal(
    query.critical(
      {
        ...summonEvent,
        source: 'Player',
        actorType: 'player'
      },
      5
    ).chance,
    0.3
  );

  const runtime = { boons: new Map() };

  assert.equal(query.statsAt(1, summonEvent, runtime).power, 1000);
  runtime.boons.set('might', [
    {
      at: 0,
      expiresAt: 10,
      stacks: 2,
      source: 'Trait',
      resolvedAudience: resolvedAudience({ companionIds: ['fixture-minion'] })
    }
  ]);
  assert.equal(query.statsAt(1, summonEvent, runtime).power, 1060);
});

test('trait coverage validates complete mixed-effect implementation manifests', () => {
  const catalog = {
    traits: [
      { id: 1, name: 'Mixed Trait' },
      { id: 2, name: 'Support Trait' }
    ]
  };
  const coverage = validateTraitCoverageManifest(
    catalog,
    [
      {
        traitId: 1,
        status: 'implemented',
        effects: [
          {
            description: 'Increases strike damage while the target is poisoned.',
            status: 'implemented'
          },
          {
            description: 'Heals nearby allies when the damage bonus activates.',
            status: 'out-of-model',
            reason: 'Ally healing is outside the single-target damage model.'
          }
        ],
        reason: null
      },
      {
        traitId: 2,
        status: 'out-of-model',
        effects: ['Revives and heals nearby allied players.'],
        reason: 'Ally healing and revival are not represented by the simulator.'
      }
    ],
    { professionId: 'fixture' }
  );

  assert.equal(coverage.length, 2);
  assert.equal(Object.isFrozen(coverage), true);
  assert.equal(coverage[0].effects[1].status, 'out-of-model');
});

test('trait coverage rejects gaps, unknown traits, names, and title evidence', () => {
  const catalog = { traits: [{ id: 1, name: 'Known Trait' }] };

  assert.throws(() => validateTraitCoverageManifest(catalog, []), /coverage is missing/);
  assert.throws(
    () =>
      validateTraitCoverageManifest(catalog, [
        {
          traitId: 2,
          status: 'implemented',
          effects: ['Deals strike damage after using a tool-belt skill.'],
          reason: null
        }
      ]),
    /unknown trait 2/
  );
  assert.throws(
    () =>
      validateTraitCoverageManifest(catalog, [
        {
          traitId: 1,
          status: 'implemented',
          effects: ['Known Trait'],
          reason: null
        }
      ]),
    /not only its name/
  );
  assert.throws(
    () =>
      validateTraitCoverageManifest(catalog, [
        {
          traitId: 1,
          status: 'implemented',
          effects: ['Deals strike damage after using a tool-belt skill.'],
          tests: [
            {
              file: 'tests/fixture.test.js',
              name: 'claimed behavior'
            }
          ],
          reason: null
        }
      ]),
    /cannot use test-title evidence/
  );
  assert.throws(
    () =>
      validateTraitCoverageManifest(catalog, [
        {
          traitId: 1,
          status: 'out-of-model',
          effects: ['Heals nearby allied players.'],
          reason: 'unsupported'
        }
      ]),
    /concrete reason/
  );
});

test('profession event-log hooks present, hide, and diagnose custom events', () => {
  const result = {
    events: [
      { type: 'engineer.kit-equipped', at: 1, kitName: 'Grenade Kit' },
      { type: 'engineer.state', at: 1, heat: 20 }
    ],
    resolvedEvents: [],
    endState: { profession: {} }
  };
  const profession = {
    ui: {
      eventLogRow(_context, event) {
        if (event.type === 'engineer.state') return null;

        if (event.type === 'engineer.kit-equipped') {
          return {
            type: 'trigger',
            description: `KIT EQUIPPED ${event.kitName}`,
            className: 'trigger',
            order: 20,
            flags: []
          };
        }

        return undefined;
      }
    }
  };

  assert.deepEqual(
    simulationEventLogRows(result, null, profession).map((row) => row.description),
    ['KIT EQUIPPED Grenade Kit']
  );

  const warnings = [];
  const originalWarn = console.warn;

  console.warn = (...values) => warnings.push(values);
  try {
    const [diagnostic] = simulationEventLogRows({
      events: [{ type: 'engineer.unknown', at: 0 }],
      resolvedEvents: [],
      endState: { profession: {} }
    });

    assert.equal(diagnostic.description, 'UNPRESENTED CUSTOM EVENT engineer.unknown');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('Engineer and Thief contracts present state and suppress known packet events', () => {
  const engineerRows = simulationEventLogRows(
    {
      events: [
        {
          type: 'engineer.state',
          at: 1,
          reason: 'enter-forge',
          state: { heat: 25 }
        },
        { type: 'engineer.lightning-rod-pulse', at: 1.1 },
        { type: 'engineer.conduit-surge', at: 1.2 },
        { type: 'engineer.electric-artillery', at: 1.3 }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    { specialization: 'Holosmith' },
    engineerProfession
  );

  assert.equal(engineerRows.length, 1);
  assert.equal(engineerRows[0].type, 'engineer.state');
  assert.match(engineerRows[0].description, /enter-forge.*Heat 25\.0/);
  assert.notEqual(engineerRows[0].type, 'diagnostic');

  const thiefRows = simulationEventLogRows(
    {
      events: [
        {
          type: 'thief.state',
          at: 2,
          reason: 'initiative-spent',
          state: { initiative: 7, malice: 2 }
        }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    null,
    thiefProfession
  );

  assert.equal(thiefRows.length, 1);
  assert.equal(thiefRows[0].type, 'thief.state');
  assert.match(thiefRows[0].description, /initiative-spent.*Initiative 7\.0/);
  assert.notEqual(thiefRows[0].type, 'diagnostic');

  const originalWarn = console.warn;

  console.warn = () => {};

  try {
    const [unknown] = simulationEventLogRows(
      {
        events: [{ type: 'engineer.unhandled', at: 3 }],
        resolvedEvents: [],
        endState: { profession: {} }
      },
      null,
      engineerProfession
    );

    assert.equal(unknown.description, 'UNPRESENTED CUSTOM EVENT engineer.unhandled');
  } finally {
    console.warn = originalWarn;
  }
});

test('Guardian and Necromancer classify every known custom event', () => {
  const warnings = [];
  const originalWarn = console.warn;

  console.warn = (...values) => warnings.push(values);
  try {
    const guardianCoreRows = simulationEventLogRows(
      {
        events: [
          {
            type: 'guardian.virtue-activated',
            at: 0,
            skillName: 'Virtue of Justice'
          },
          { type: 'guardian.virtues-refreshed', at: 1 },
          { type: 'guardian.righteous-instincts-tick', at: 7 }
        ],
        resolvedEvents: [],
        endState: { profession: {} }
      },
      { specialization: 'Core' },
      guardianProfession
    );
    const guardianFirebrandRows = simulationEventLogRows(
      {
        events: [
          { type: 'guardian.tome-stowed', at: 8 },
          {
            type: 'guardian.tome-page-used',
            at: 9,
            skillName: 'Chapter 1: Searing Spell',
            pageCost: 1,
            pagesRemaining: 4
          }
        ],
        resolvedEvents: [],
        endState: { profession: {} }
      },
      { specialization: 'Firebrand' },
      guardianProfession
    );
    const guardianLuminaryRows = simulationEventLogRows(
      {
        events: [
          { type: 'guardian.effulgent-activated', at: 2 },
          { type: 'guardian.effulgent-detonate', at: 6 },
          { type: 'guardian.radiant-forge-entered', at: 10 },
          {
            type: 'guardian.radiant-forge-exited',
            at: 30,
            automatic: true
          }
        ],
        resolvedEvents: [],
        endState: { profession: {} }
      },
      { specialization: 'Luminary' },
      guardianProfession
    );
    const guardianRows = [...guardianCoreRows, ...guardianFirebrandRows, ...guardianLuminaryRows];

    assert.deepEqual(
      guardianRows.map((row) => row.type),
      [
        'guardian.virtue-activated',
        'guardian.virtues-refreshed',
        'guardian.tome-stowed',
        'guardian.tome-page-used',
        'guardian.radiant-forge-entered',
        'guardian.radiant-forge-exited'
      ]
    );
    assert.match(guardianRows[0].description, /VIRTUE ACTIVATED/);
    assert.match(guardianRows.at(-1).description, /\[automatic\]/);

    const necromancerCoreRows = simulationEventLogRows(
      {
        events: [
          {
            type: 'necromancer.state',
            at: 0,
            reason: 'shroud-entered',
            state: { lifeForce: 75, activeShroud: 'reaper' }
          },
          {
            type: 'necromancer.chill',
            at: 1,
            skillName: 'Spinal Shivers',
            duration: 5
          },
          { type: 'necromancer.summon-attack', at: 3 }
        ],
        resolvedEvents: [],
        endState: { profession: {} }
      },
      { specialization: 'Core' },
      necromancerProfession
    );
    const ritualistRows = simulationEventLogRows(
      {
        events: [
          { type: 'necromancer.painful-bond', at: 2 },
          { type: 'necromancer.weapon-spell', at: 4 },
          { type: 'necromancer.weapon-spell-ally-trigger', at: 5 }
        ],
        resolvedEvents: [],
        endState: { profession: {} }
      },
      { specialization: 'Ritualist' },
      necromancerProfession
    );
    const necromancerRows = [...necromancerCoreRows, ...ritualistRows];

    assert.deepEqual(
      necromancerRows.map((row) => row.type),
      ['necromancer.state', 'necromancer.chill']
    );
    assert.match(necromancerRows[1].description, /Spinal Shivers \(5\.0s\)/);
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test('fixed slot loadouts normalize, validate, render, and gate alternate bars', () => {
  const loadout = createFixedSlotLoadout({
    id: 'test-legends',
    label: 'Legends',
    entryLabel: 'Legend',
    selectionKey: 'selectedLegends',
    startingKey: 'startingLegend',
    entries: [
      { id: 'jalis', name: 'Jalis', skillIds: [1, 2, 3, 4, 5] },
      { id: 'mallyx', name: 'Mallyx', skillIds: [6, 7, 8, 9, 10] },
      {
        id: 'glint',
        name: 'Glint',
        specialization: 'Herald',
        skillIds: [11, 12, 13, 14, 15]
      }
    ],
    defaults: ['jalis', 'mallyx']
  });
  const normalized = loadout.normalizeBuild(
    {
      selectedLegends: ['jalis', 'jalis'],
      startingLegend: 'missing'
    },
    { specialization: 'Core' }
  );

  assert.deepEqual(normalized, {
    selectedLegends: ['jalis', 'mallyx'],
    startingLegend: 'jalis'
  });
  assert.deepEqual(loadout.validateBuild(normalized, { specialization: 'Core' }), []);
  assert.ok(
    loadout.validateBuild(
      {
        selectedLegends: ['jalis', 'glint'],
        startingLegend: 'glint'
      },
      { specialization: 'Core' }
    ).length > 0
  );

  const build = {
    selectedLegends: ['jalis', 'mallyx'],
    startingLegend: 'jalis'
  };
  let view = loadout.view({ build, specialization: 'Core' });

  assert.deepEqual(view.activeBar.skillIds, [1, 2, 3, 4, 5]);
  assert.deepEqual(view.inactiveBars[0].skillIds, [6, 7, 8, 9, 10]);
  assert.match(loadout.unavailableReason({ id: 6 }, { build, specialization: 'Core' }), /Swap to Mallyx/);
  loadout.updateBuild(build, 'startingLegend', 'mallyx', {
    build,
    specialization: 'Core'
  });
  view = loadout.view({ build, specialization: 'Core' });
  assert.equal(view.activeBar.id, 'mallyx');
  assert.equal(loadout.paletteGroups({ build, specialization: 'Core' }).length, 2);
});

test('weapon-set matching supports exact dual-wield and empty-offhand bars', () => {
  const context = {
    catalog: {
      weaponHands: new Map([
        ['Dagger', 'mh+oh'],
        ['Pistol', 'mh+oh'],
        ['Shortbow', '2h']
      ])
    }
  };
  const cases = [
    {
      skill: {
        type: 'Weapon',
        weapon: 'Dagger',
        slot: 'Weapon_3',
        requiredMainHand: 'Dagger',
        requiredOffHand: 'Pistol'
      },
      valid: [['Dagger', 'Pistol']],
      invalid: [
        ['Dagger', 'Dagger'],
        ['Dagger', ''],
        ['Pistol', 'Dagger']
      ]
    },
    {
      skill: {
        type: 'Weapon',
        weapon: 'Dagger',
        slot: 'Weapon_3',
        requiredMainHand: 'Dagger',
        requiredOffHand: false
      },
      valid: [['Dagger', '']],
      invalid: [
        ['Dagger', 'Pistol'],
        ['Dagger', 'Dagger']
      ]
    },
    {
      skill: { type: 'Weapon', weapon: 'Shortbow', slot: 'Weapon_5' },
      valid: [['Shortbow', '']],
      invalid: [['Dagger', 'Pistol']]
    },
    {
      skill: {
        type: 'Profession',
        requiredMainHand: 'Dagger'
      },
      valid: [['Dagger', 'Mace']],
      invalid: [['Sword', 'Axe']]
    }
  ];

  for (const fixture of cases) {
    for (const pair of fixture.valid) {
      assert.equal(defaultWeaponSkillMatchesSet(fixture.skill, pair, context), true, `${pair.join('/')} should match`);
    }

    for (const pair of fixture.invalid) {
      assert.equal(
        defaultWeaponSkillMatchesSet(fixture.skill, pair, context),
        false,
        `${pair.join('/')} should not match`
      );
    }
  }

  const exactMatcher = (skill, pair) => skill.combo === `${pair[0] || 'none'}/${pair[1] || 'none'}`;

  assert.equal(
    isGw2WeaponSkillEquipped(
      {
        config: { primaryWeapon: 'Dagger', secondaryWeapon: 'Pistol' },
        state: { activeWeaponSet: 1 }
      },
      {
        type: 'Weapon',
        weapon: 'Dagger',
        combo: 'Dagger/Pistol'
      },
      exactMatcher
    ),
    true
  );
  assert.equal(
    isGw2WeaponSkillEquipped(
      {
        config: { primaryWeapon: 'Dagger', secondaryWeapon: '' },
        state: { activeWeaponSet: 1 }
      },
      {
        type: 'Weapon',
        weapon: 'Dagger',
        combo: 'Dagger/Pistol'
      },
      exactMatcher
    ),
    false
  );
});

test('profession assumption controls normalize and validate deterministic inputs', () => {
  const controls = createProfessionAssumptionControls([
    ...STANDARD_POSITION_ASSUMPTION_CONTROLS,
    {
      key: 'stolenSkillChoice',
      label: 'Stolen skill',
      type: 'select',
      defaultValue: 'golem',
      options: [
        { value: 'golem', label: 'Raid golem' },
        { value: 'boon', label: 'Boon target' }
      ]
    }
  ]);
  const assumptions = normalizeProfessionAssumptions(
    {
      targetDistance: 9999,
      playerHealthPercent: -5,
      targetDefiant: false,
      stolenSkillChoice: 'missing'
    },
    controls
  );

  assert.deepEqual(assumptions, {
    targetDistance: 2000,
    playerHealthPercent: 0,
    targetDefiant: false,
    stolenSkillChoice: 'golem'
  });
  assert.deepEqual(validateProfessionAssumptions(assumptions, controls), []);
  assert.ok(
    validateProfessionAssumptions(
      {
        ...assumptions,
        targetDistance: -1,
        stolenSkillChoice: 'missing'
      },
      controls
    ).length >= 2
  );
});
