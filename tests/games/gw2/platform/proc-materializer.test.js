import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { createCriticalSigilEvent } from '#gw2/platform/equipment/sigils/proc-events.js';
import { decideCriticalSigils } from '#gw2/platform/equipment/sigils/critical-procs.js';
import { createCriticalSigilDiagnostics } from '#gw2/platform/equipment/sigils/diagnostics.js';

test('sigil diagnostics correlate same-time causes and retain explicit suppression evidence', () => {
  const diagnostics = createCriticalSigilDiagnostics();
  const event = (eventOrder) => ({
    type: 'damage',
    at: 1,
    source: 'fixture',
    sourceId: 'same-name',
    actorType: 'player',
    eventOrder
  });
  const proc = { procs: [{ name: 'Earth', readyAt: 3 }] };
  const absent = { procs: [] };
  diagnostics.record(event(1), ['Earth'], { chance: 0.5, didCrit: true }, proc);
  diagnostics.record(event(2), ['Earth'], { chance: 0.5, didCrit: false }, absent);
  diagnostics.suppress(event(3), 'precombat', ['Earth']);
  assert.deepEqual(
    diagnostics
      .results()
      .map(({ causeEventOrder, claimed, suppression }) => ({ causeEventOrder, claimed, suppression })),
    [
      { causeEventOrder: 1, claimed: true, suppression: undefined },
      { causeEventOrder: 2, claimed: false, suppression: undefined },
      { causeEventOrder: 3, claimed: false, suppression: 'precombat' }
    ]
  );
});

test('sigil diagnostics preserve seeded output and explain suppression of a later planned hit', () => {
  const profession = defineProfession({
    id: 'sigil-diagnostic-fixture',
    name: 'Sigil diagnostic fixture',
    catalog: createCanonicalCatalog(),
    live: {
      initialize(context) {
        for (const at of [0.1, 10])
          context.emit({
            type: 'damage',
            at,
            source: 'fixture',
            sourceId: 'strike',
            actorType: 'player',
            coefficient: 1,
            weaponStrength: 1000
          });
      }
    }
  });
  const options = {
    profession,
    rotation: [{ type: 'wait', durationMs: 11000 }],
    config: {
      stats: { power: 1000, precision: 1945 },
      sigilSets: [{ names: ['Blight'] }],
      randomness: { mode: 'stochastic', seed: 42 }
    }
  };
  const plain = simulateGw2(options);
  const diagnostic = simulateGw2({ ...options, damageDiagnostics: true });
  assert.equal(plain.totalDamage, diagnostic.totalDamage);
  assert.deepEqual(
    plain.events.map((event) => event.didCrit),
    diagnostic.events.map((event) => event.didCrit)
  );
  assert.deepEqual(plain.procSteps, diagnostic.procSteps);
  assert.equal(plain.criticalSigilDiagnostics, undefined);
  assert.equal(
    simulateGw2({ ...options, damageDiagnostics: true, output: 'score' }).criticalSigilDiagnostics,
    undefined
  );
  assert.deepEqual(
    diagnostic.criticalSigilDiagnostics,
    simulateGw2({ ...options, damageDiagnostics: true }).criticalSigilDiagnostics
  );
  // A future impact beyond observation is explained without consuming a critical draw or claiming its proc.
  const clipped = simulateGw2({ ...options, rotation: [{ type: 'wait', durationMs: 1000 }], damageDiagnostics: true });
  const pending = clipped.criticalSigilDiagnostics.find((row) => row.at === 10);
  assert.equal(pending.suppression, 'observation-end');
  assert.equal(pending.claimed, false);
  assert.equal(pending.didCrit, undefined);
  const lethal = simulateGw2({
    ...options,
    damageDiagnostics: true,
    config: {
      ...options.config,
      stats: { power: 1000, precision: 4000 },
      target: { health: 1 }
    }
  });
  assert.deepEqual(
    lethal.criticalSigilDiagnostics.map(({ claimed, suppression }) => [claimed, suppression]),
    [
      [true, 'target-death'],
      [false, 'target-death']
    ]
  );
});

test('critical sigil decisions use sampled outcomes and strict deadlines without mutating inputs', () => {
  const hit = { type: 'damage', at: 2, source: 'fixture', sourceId: 1, actorType: 'player', coefficient: 1 };
  const state = Object.freeze({
    readyAt: new Map([
      ['Earth', 2],
      ['Air', 3],
      ['Doom', 9]
    ])
  });
  const decide = (event = hit, chance = 0.5, didCrit = true) =>
    decideCriticalSigils(event, ['Earth', 'Air', 'Earth'], { chance, didCrit }, state);
  assert.deepEqual(decide(), { procs: [] });
  assert.deepEqual(decide({ ...hit, at: 2.000001 }), { procs: [{ name: 'Earth', readyAt: 4.000001 }] });
  assert.deepEqual(decide({ ...hit, at: 3 }), { procs: [{ name: 'Earth', readyAt: 5 }] });
  assert.deepEqual(decide({ ...hit, at: 3.000001 }), {
    procs: [
      { name: 'Earth', readyAt: 5.000001 },
      { name: 'Air', readyAt: 6.000001 }
    ]
  });
  for (const change of [
    { offTarget: true },
    { cancelled: true },
    { noCrit: true },
    { flatDamage: 10 },
    { coefficient: 0 },
    { actorType: 'summon' }
  ])
    assert.deepEqual(decide({ ...hit, at: 4, ...change }), { procs: [] });
  assert.deepEqual(decide({ ...hit, at: 4 }, 0), { procs: [] });
  assert.deepEqual(decide({ ...hit, at: 4 }, 0.5, false), { procs: [] });
  assert.equal(decide({ ...hit, at: 4, actorType: 'effect', canTriggerCriticalSigils: true }).procs.length, 2);
  assert.deepEqual(
    [...state.readyAt],
    [
      ['Earth', 2],
      ['Air', 3],
      ['Doom', 9]
    ]
  );
  assert.throws(
    () => createCriticalSigilEvent('Future', { effect: 'unsupported' }, ''),
    /Unsupported critical sigil effect/
  );
});

test('Blight procs supply condition-dependent readiness and expire without recursive relic output', () => {
  // Poison creates a later scheduling opportunity, and the resolver sees the same condition at that time.
  const observed = [];
  const profession = defineProfession({
    id: 'blight-facts-fixture',
    name: 'Blight facts fixture',
    catalog: createCanonicalCatalog(),
    live: {
      initialize(context) {
        context.emit({
          type: 'damage',
          at: 0.1,
          coefficient: 1,
          weaponStrength: 1000,
          source: 'fixture',
          sourceId: 'strike',
          actorType: 'player'
        });
        for (const at of [0.2, 4.1]) context.schedule('fixture.consume-poison', at);
      },
      tasks: {
        'fixture.consume-poison': (context) => {
          const poisoned =
            context.conditionState.get('Poisoned')?.stacks.some((stack) => stack.expiresAt > context.time) ?? false;
          observed.push(poisoned);
          if (poisoned)
            context.emit({
              type: 'marker',
              at: context.time,
              name: 'Poison opportunity',
              source: 'fixture',
              sourceId: 'follow-up',
              actorType: 'player'
            });
        }
      },
      reactions: {
        'condition.applied': (context, event) => {
          if (event.sourceId === 'sigil.blight')
            assert.equal(context.query.targetConditionStacks('Poisoned', 0.2, context), 2);
        }
      }
    }
  });
  const config = { stats: { power: 1000, precision: 4000 }, sigilSets: [{ names: ['Blight'] }], relic: 'Shackles' };
  const result = simulateGw2({ profession, config, rotation: [{ type: 'wait', durationMs: 5000 }] });
  assert.deepEqual(observed, [true, false]);
  assert.equal(result.events.filter((event) => event.sourceId === 'follow-up').length, 1);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === 'sigil.blight').length,
    1
  );
  assert.ok(result.events.every((event) => event.sourceId !== 'relic.shackles'));
});

// Identical short histories expose equipment eligibility without depending on a saved rotation.
test('critical sigil cooldowns persist across weapon swaps and cannot proc while unequipped', () => {
  for (const startingWeaponSet of [1, 2]) {
    const otherSet = startingWeaponSet === 1 ? 2 : 1;
    for (const startsEquipped of [false, true]) {
      const profession = defineProfession({
        id: 'sigil-cooldown-fixture',
        name: 'Sigil cooldown fixture',
        catalog: createCanonicalCatalog(),
        live: {
          initialize(context) {
            const owner = { source: 'Fixture', sourceId: 'fixture', actorType: 'player' };
            for (const at of [0.1, 0.3, 0.5]) {
              context.emit({ ...owner, type: 'damage', at, coefficient: 1, weaponStrength: 1000 });
            }

            context.emit({ ...owner, type: 'weapon_set', at: 0.2, weaponSet: otherSet });
            if (startsEquipped) {
              context.emit({ ...owner, type: 'weapon_set', at: 0.4, weaponSet: startingWeaponSet });
            }
          }
        }
      });
      const equippedSet = startsEquipped ? startingWeaponSet : otherSet;
      const config = {
        startingWeaponSet,
        stats: { power: 1000, precision: 4000 },
        sigilSets: [1, 2].map((set) => ({ names: set === equippedSet ? ['Earth'] : [] }))
      };
      const rotation = [{ type: 'wait', durationMs: 1000 }];
      const scheduled = simulateGw2({ profession, config, rotation: rotation });
      const resolved = simulateGw2({ profession, config, rotation });
      for (const events of [scheduled.events, resolved.resolvedEvents]) {
        assert.deepEqual(
          events.filter((event) => event.sourceId === 'sigil.earth').map((event) => event.at),
          [startsEquipped ? 0.1 : 0.3]
        );
      }
    }
  }
});

test('sigil cooldown boundaries use exact canonical instants', () => {
  // Equivalent floating-point timestamps share a blocked deadline; the next canonical instant is ready.
  assert.equal(isInternalCooldownReady(5.999999, 6), false);
  assert.equal(isInternalCooldownReady(6, 6), false);
  assert.equal(isInternalCooldownReady(6.000001, 6), true);
  assert.equal(isInternalCooldownReady(0.1 + 0.2, 0.3), false);
});

test('computed combat boundaries admit opening procs but exclude the preceding microsecond', () => {
  // Decimal addition must not put the opening hit before combat or admit a genuinely earlier hit.
  const profession = defineProfession({
    id: 'combat-boundary-fixture',
    name: 'Combat Boundary Fixture',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 1,
          name: 'Strike',
          type: 'Utility',
          castTimeMs: 200,
          effects: [
            {
              type: 'strike',
              timingAnchor: 'castStart',
              ticks: [
                { atMs: 199.999, coefficient: 1 },
                { atMs: 200, coefficient: 1 }
              ]
            }
          ]
        }
      ]
    })
  });
  const config = { stats: { precision: 4000 }, sigilSets: [{ names: ['Air'] }] };
  const rotation = [{ type: 'wait', durationMs: 100 }, 'Strike', { type: 'combat-start', concurrentOffsetMs: 200 }];
  const scheduled = simulateGw2({ profession, config, rotation: rotation });
  assert.equal(scheduled.combatStartTime, 0.3);
  const sigilTimes = (events) =>
    events.filter((event) => event.type === 'damage' && event.sourceId === 'sigil.air').map((event) => event.at);
  assert.deepEqual(sigilTimes(scheduled.events), [0.3]);
  assert.deepEqual(sigilTimes(simulateGw2({ profession, config, rotation }).resolvedEvents), [0.3]);
});

test('missed attacks leave consecutive swaps out of combat', () => {
  // A retained cast must not impose combat recharge when its hostile effects miss.
  const profession = defineProfession({
    id: 'missed-swap-fixture',
    name: 'Missed Swap Fixture',
    catalog: createCanonicalCatalog({
      generated: [
        { id: 1, name: 'Strike', type: 'Utility', castTimeMs: 1000, effects: [{ type: 'strike', coefficient: 1 }] },
        {
          id: 2,
          name: 'Swap Weapons',
          inputCategory: 'weapon-swap',
          type: 'Action',
          castTimeMs: 0,
          cooldown: 10,
          effects: []
        }
      ]
    })
  });
  for (const offTarget of [true, false]) {
    const result = simulateGw2({
      profession,
      rotation: [{ name: 'Strike', offTarget }, 'Swap Weapons', 'Swap Weapons']
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
      offTarget ? [1000, 1000] : [1000, 11000]
    );
    if (offTarget) assert.equal(result.totalDamage, 0);
  }
});

test('critical facts follow weapon swaps without proc sigils', () => {
  const defaults = defaultSimulationConfig();
  const stats = {
    ...defaults.stats,
    precision: 895
  };
  const result = simulateMesmer(
    ['__combat_start', 'Swap Weapons', 'Flying Cutter'],
    defaultSimulationConfig({
      food: 'Cilantro Lime Sous-Vide Steak',
      weaponSet2Primary: 'Dagger',
      weaponSet2Secondary: 'Sword',
      stats,
      weaponSetStats: [
        stats,
        {
          ...stats,
          precision: 3100
        }
      ],
      boons: {
        ...defaults.boons,
        fury: false
      },
      sigilSets: [{ names: [] }, { names: [] }],
      randomness: { mode: 'stochastic', seed: 1 }
    })
  );
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Flying Cutter');

  assert.ok(hits.length > 0);
  assert.ok(hits.every((event) => event.didCrit === true));
});

test('sigils block a hit at the exact internal-cooldown boundary', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      '__combat_start',
      { name: '__wait', waitMs: 40 },
      'Flying Cutter',
      { name: '__wait', waitMs: 4560 },
      'Flying Cutter'
    ],
    defaultSimulationConfig({
      stats: { ...defaults.stats, precision: 4000 },
      sigilSets: [{ names: ['Torment'], strike: 1, condition: 1 }, { names: [] }]
    })
  );

  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Sigil of Torment').map((step) => step.start),
    [360]
  );
});
