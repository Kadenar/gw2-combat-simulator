import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';

// Effect validation and materialization preserve explicit packet timing, coefficients, and summon fields.
test('canonical strike timelines reject invalid or ambiguous hits', () => {
  const skillWithTicks = (ticks) => ({
    id: 930024,
    name: 'Invalid Tick Fixture',
    effects: [
      {
        type: 'strike',
        ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  });

  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          skillWithTicks([
            { atMs: 100, coefficient: 0.2 },
            { atMs: 50, coefficient: 0.5 }
          ])
        ]
      }),
    /chronological/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [skillWithTicks([{ atMs: 0, coefficient: -0.2 }])]
      }),
    /non-negative coefficient/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            ...skillWithTicks([{ atMs: 0, coefficient: 0.2 }]),
            effects: [
              {
                type: 'strike',
                coefficient: 0.2,
                ticks: [{ atMs: 0, coefficient: 0.2 }],
                timingAnchor: 'castStart',
                timingScale: 'fixed'
              }
            ]
          }
        ]
      }),
    /cannot use aggregate/
  );
});

test('canonical strikes distinguish one timestamp from an explicit packet timeline', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930027,
        name: 'Canonical Strike Forms',
        castTimeMs: 0,
        effects: [
          { type: 'strike', name: 'Single', coefficient: 1.8, hits: 1, atMs: 360 },
          { type: 'strike', name: 'Simultaneous', coefficient: 1.8, hits: 2, atMs: 360 },
          {
            type: 'strike',
            name: 'Timeline',
            ticks: [
              { atMs: 360, coefficient: 0.9 },
              { atMs: 860, coefficient: 0.9 }
            ]
          }
        ]
      }
    ]
  });
  const skill = catalog.skillsById.get(930027);
  const packets = skill.effects.map((effect) =>
    materializeSkillEffectApplications({
      skill,
      effect,
      start: 0,
      fullEnd: 0,
      baseEvent: { source: 'Fixture', sourceId: skill.id }
    }).map(({ at, event }) => [Math.round(at * 1000), event.coefficient])
  );

  assert.deepEqual(packets, [
    [[360, 1.8]],
    [
      [360, 0.9],
      [360, 0.9]
    ],
    [
      [360, 0.9],
      [860, 0.9]
    ]
  ]);
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930028,
            name: 'Untimed Aggregate',
            effects: [{ type: 'strike', coefficient: 1.8, hits: 2 }]
          }
        ]
      }),
    /explicit atMs/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930029,
            name: 'Interval Aggregate',
            effects: [{ type: 'strike', coefficient: 1.8, hits: 2, atMs: 360, intervalMs: 500 }]
          }
        ]
      }),
    /explicit tick timeline/
  );
});

test('strike ticks preserve independent summon formula fields at runtime', () => {
  const [application] = materializeSkillEffectApplications({
    skill: { id: 930044, name: 'Independent Summon Strike' },
    effect: {
      type: 'strike',
      ticks: [
        {
          atMs: 1000,
          coefficient: 0.2,
          name: 'Summon Pulse',
          weaponStrength: 2880,
          independentSummonStrike: true,
          summonUsesProfessionModifiers: true,
          summonInheritsAttributes: true,
          summonInheritsCriticalAttributes: true
        }
      ]
    },
    start: 0,
    fullEnd: 0,
    baseEvent: { source: 'fixture-summon', sourceId: 930044, actorType: 'summon' }
  });

  assert.deepEqual(
    {
      name: application.event.name,
      weaponStrength: application.event.weaponStrength,
      independentSummonStrike: application.event.independentSummonStrike,
      summonUsesProfessionModifiers: application.event.summonUsesProfessionModifiers,
      summonInheritsAttributes: application.event.summonInheritsAttributes,
      summonInheritsCriticalAttributes: application.event.summonInheritsCriticalAttributes
    },
    {
      name: 'Summon Pulse',
      weaponStrength: 2880,
      independentSummonStrike: true,
      summonUsesProfessionModifiers: true,
      summonInheritsAttributes: true,
      summonInheritsCriticalAttributes: true
    }
  );
});

test('canonical effects allow negative offsets only from cast end', () => {
  const effect = {
    type: 'strike',
    coefficient: 1,
    hits: 1,
    atMs: -40,
    timingAnchor: 'castEnd',
    timingScale: 'fixed'
  };
  const catalog = createCanonicalCatalog({
    generated: [{ id: 930025, name: 'Cast-End Offset Fixture', effects: [effect] }]
  });

  assert.equal(catalog.skillsById.get(930025).effects[0].atMs, -40);
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            id: 930025,
            name: 'Cast-Start Offset Fixture',
            effects: [{ ...effect, timingAnchor: 'castStart' }]
          }
        ]
      }),
    /may only be negative when anchored to castEnd/
  );
});

test('canonical condition timelines reject invalid or ambiguous applications', () => {
  const skillWithTicks = (ticks) => ({
    id: 930026,
    name: 'Invalid Condition Timeline Fixture',
    effects: [
      {
        type: 'condition',
        ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  });

  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          skillWithTicks([
            {
              atMs: 0,
              condition: 'Burning',
              stacks: 0,
              duration: 2
            }
          ])
        ]
      }),
    /positive stacks/
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          {
            ...skillWithTicks([
              {
                atMs: 0,
                condition: 'Burning',
                stacks: 1,
                duration: 2
              }
            ]),
            effects: [
              {
                type: 'condition',
                condition: 'Burning',
                ticks: [
                  {
                    atMs: 0,
                    condition: 'Burning',
                    stacks: 1,
                    duration: 2
                  }
                ],
                timingAnchor: 'castStart',
                timingScale: 'fixed'
              }
            ]
          }
        ]
      }),
    /cannot use aggregate/
  );
});
