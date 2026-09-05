import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { strikeTimeline, conditionTimeline } from '#gw2/platform/engine/effects/factories.js';

// GW2 effect timing preserves individual packets and fixed pulses while applying Quickness scaling.
test('declarative multi-hit and delayed effects preserve individual events', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930010,
        name: 'Fixture Flurry',
        type: 'Weapon',
        weapon: 'Greatsword',
        castTimeMs: 300,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 66.666667, coefficient: 1 },
              { atMs: 133.333334, coefficient: 1 },
              { atMs: 200, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'cast'
          },
          {
            type: 'strike',
            coefficient: 1,
            atMs: 1000,
            timingAnchor: 'castStart',
            timingScale: 'fixed'
          }
        ]
      }
    ],
    weapons: ['Greatsword'],
    weaponHands: { Greatsword: '2h' }
  });
  const profession = defineProfession({
    id: 'multi-hit-fixture',
    name: 'Multi Hit Fixture',
    catalog,
    resources: {
      createProfessionState: () => ({ hits: 0 })
    },
    resolverHooks: {
      eventReactions: {
        'damage.resolved': (context) => {
          context.profession.hits += 1;
        }
      }
    }
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Flurry', { type: 'wait', durationMs: 1000 }]
  });
  const events = result.resolvedEvents.filter((event) => event.type === 'damage');

  assert.deepEqual(
    events.map((event) => Number(event.at.toFixed(3))),
    [0.1, 0.2, 0.3, 1]
  );
  assert.deepEqual(
    events.map((event) => event.hitIndex),
    [1, 2, 3, 1]
  );
  assert.equal(result.endState.profession.hits, 4);
});

test('declarative repeated statuses keep fixed pulse intervals', () => {
  const timing = {
    applications: 3,
    atMs: 200,
    intervalMs: 1000,
    intervalTimingScale: 'fixed',
    timingAnchor: 'castStart',
    timingScale: 'cast'
  };
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930037,
        name: 'Fixture Pulses',
        castTimeMs: 600,
        effects: [
          {
            type: 'blind',
            ...timing
          },
          {
            type: 'condition',
            condition: 'Crippled',
            stacks: 1,
            duration: 2,
            ...timing
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'pulse-fixture',
    name: 'Pulse Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Fixture Pulses', { type: 'wait', durationMs: 2500 }],
    config: { boons: { quickness: true } }
  });
  const timestamps = (type) =>
    result.events.filter((event) => event.type === type).map((event) => Math.round(event.at * 1000));

  assert.deepEqual(timestamps('blind'), [200, 1200, 2200]);
  assert.deepEqual(timestamps('condition'), [200, 1200, 2200]);
});

test('declarative strike timelines preserve per-hit coefficients and shared timestamps', () => {
  // Cast-relative fixtures are authored on the Quickness timeline; the normal
  // simulation expands them back to the unquickened packet schedule.
  const ticks = [
    { atMs: 0, coefficient: 0.2 },
    { atMs: 382.57, coefficient: 0.2 },
    { atMs: 670, coefficient: 0.5 },
    { atMs: 765.14, coefficient: 0.2 },
    { atMs: 1148.38, coefficient: 0.2 },
    { atMs: 1340, coefficient: 0.5 },
    { atMs: 1530.95, coefficient: 0.2 },
    { atMs: 1914.19, coefficient: 0.2 },
    { atMs: 2010, coefficient: 0.5 },
    { atMs: 2296.76, coefficient: 0.2 },
    { atMs: 2680, coefficient: 0.2 },
    { atMs: 2680, coefficient: 0.5 }
  ];
  const unquickenedAtMs = [0, 571, 1000, 1142, 1714, 2000, 2285, 2857, 3000, 3428, 4000, 4000];
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930023,
        name: 'Fixture Variable Hits',
        type: 'Utility',
        castTimeMs: 4000,
        effects: [
          strikeTimeline(ticks, {
            timingAnchor: 'castStart',
            timingScale: 'cast'
          })
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'variable-hit-fixture',
    name: 'Variable Hit Fixture',
    catalog
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: ['Fixture Variable Hits'],
      config: { boons: { quickness } }
    });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalHits = normal.resolvedEvents.filter((event) => event.type === 'damage');
  const quickHits = quick.resolvedEvents.filter((event) => event.type === 'damage');
  const quickAction = quick.events.find((event) => event.type === 'action');

  assert.deepEqual(
    normalHits.map((event) => Math.round(event.at * 1000)),
    unquickenedAtMs
  );
  assert.deepEqual(
    normalHits.map((event) => event.coefficient),
    ticks.map((tick) => tick.coefficient)
  );
  assert.deepEqual(
    normalHits.slice(-2).map((event) => [Number(event.at.toFixed(6)), event.coefficient]),
    [
      [4, 0.2],
      [4, 0.5]
    ]
  );
  assert.ok(Math.abs(normalHits.reduce((sum, event) => sum + event.coefficient, 0) - 3.6) < 1e-12);
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 2680);
  assert.deepEqual(
    quickHits.slice(-2).map((event) => [Math.round(event.at * 1000), event.coefficient]),
    [
      [2680, 0.2],
      [2680, 0.5]
    ]
  );
});

test('declarative condition timelines preserve each application', () => {
  const ticks = [
    {
      atMs: 0,
      condition: 'Burning',
      stacks: 1,
      duration: 2
    },
    {
      atMs: 340,
      condition: 'Bleeding',
      stacks: 2,
      duration: 4
    },
    {
      atMs: 1360,
      condition: 'Poisoned',
      stacks: 1,
      duration: 3
    },
    {
      atMs: 1360,
      condition: 'Burning',
      stacks: 3,
      duration: 5
    }
  ];
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930025,
        name: 'Fixture Variable Conditions',
        castTimeMs: 2000,
        effects: [
          conditionTimeline(ticks, {
            timingAnchor: 'castStart',
            timingScale: 'cast'
          })
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'condition-timeline-fixture',
    name: 'Condition Timeline Fixture',
    catalog
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: ['Fixture Variable Conditions'],
      config: { boons: { quickness } }
    });
  const normal = simulate(false);
  const quick = simulate(true);
  const normalApplications = normal.resolvedEvents.filter((event) => event.type === 'condition');
  const quickApplications = quick.resolvedEvents.filter((event) => event.type === 'condition');
  const quickAction = quick.events.find((event) => event.type === 'action');

  assert.deepEqual(
    normalApplications.map((event) => ({
      atMs: Math.round(event.at * 1000),
      condition: event.condition,
      stacks: event.stacks,
      duration: event.duration
    })),
    [
      { ...ticks[0], atMs: 0 },
      { ...ticks[1], atMs: 500 },
      { ...ticks[2], atMs: 2000 },
      { ...ticks[3], atMs: 2000 }
    ]
  );
  assert.deepEqual(
    normalApplications.slice(-2).map((event) => [Number(event.at.toFixed(6)), event.condition]),
    [
      [2, 'Poisoned'],
      [2, 'Burning']
    ]
  );
  assert.ok(normal.conditionDamage > 0);
  assert.equal(Math.round((quickAction.endsAt - quickAction.at) * 1000), 1360);
  assert.deepEqual(
    quickApplications.slice(-2).map((event) => [Math.round(event.at * 1000), event.condition]),
    [
      [1360, 'Poisoned'],
      [1360, 'Burning']
    ]
  );
});

test('GW2 Quickness uses stored effect timing and slower casts scale it upward', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930020,
        name: 'Fixture Timeline',
        type: 'Utility',
        castTimeMs: 2200,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 370, coefficient: 1 },
              { atMs: 740, coefficient: 1 },
              { atMs: 1110, coefficient: 1 },
              { atMs: 1480, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'cast'
          }
        ]
      },
      {
        id: 930021,
        name: 'Fixture Channel',
        type: 'Utility',
        castTimeMs: 600,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 133.333333, coefficient: 1 },
              { atMs: 266.666666, coefficient: 1 },
              { atMs: 400, coefficient: 1 }
            ],
            timingAnchor: 'castStart',
            timingScale: 'cast'
          }
        ]
      },
      {
        id: 930022,
        name: 'Fixture Field',
        type: 'Utility',
        castTimeMs: 600,
        effects: [
          {
            type: 'strike',
            ticks: [
              { atMs: 1000, coefficient: 1 },
              { atMs: 2000, coefficient: 1 },
              { atMs: 3000, coefficient: 1 }
            ],
            timingAnchor: 'castEnd',
            timingScale: 'fixed'
          }
        ]
      },
      {
        id: 930023,
        name: 'Fixture Quickness Immune',
        type: 'Utility',
        castTimeMs: 600,
        unaffectedByQuickness: true,
        effects: [
          {
            type: 'strike',
            coefficient: 1,
            atMs: 600,
            timingAnchor: 'castStart',
            timingScale: 'cast'
          }
        ]
      }
    ]
  });
  const profession = defineProfession({
    id: 'quickness-fixture',
    name: 'Quickness Fixture',
    catalog
  });
  const simulate = (quickness) =>
    simulateGw2({
      profession,
      rotation: [
        'Fixture Timeline',
        'Fixture Channel',
        'Fixture Field',
        'Fixture Quickness Immune',
        { type: 'wait', durationMs: 4000 }
      ],
      config: { boons: { quickness } }
    });
  const quick = simulate(true);
  const normal = simulate(false);
  const profile = (result, skillName) => {
    const action = result.events.find((event) => event.type === 'action' && event.skillName === skillName);

    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      ticks: result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.skillName === skillName)
        .map((event) => Math.round((event.at - action.at) * 1000))
    };
  };

  assert.deepEqual(profile(quick, 'Fixture Timeline'), {
    cast: 1480,
    ticks: [370, 740, 1110, 1480]
  });
  assert.deepEqual(profile(quick, 'Fixture Channel'), {
    cast: 400,
    ticks: [133, 267, 400]
  });
  assert.deepEqual(profile(quick, 'Fixture Field'), {
    cast: 400,
    ticks: [1400, 2400, 3400]
  });
  assert.deepEqual(profile(quick, 'Fixture Quickness Immune'), {
    cast: 600,
    ticks: [600]
  });
  assert.deepEqual(profile(normal, 'Fixture Timeline'), {
    cast: 2200,
    ticks: [550, 1100, 1650, 2200]
  });
  assert.deepEqual(profile(normal, 'Fixture Channel'), {
    cast: 600,
    ticks: [200, 400, 600]
  });
});
