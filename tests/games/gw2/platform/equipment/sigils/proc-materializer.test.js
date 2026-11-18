import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createProcRegistry, isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import { createCriticalSigilRequest } from '#gw2/platform/equipment/sigils/proc-events.js';
import { createSigilRuntime } from '#gw2/platform/equipment/sigils/runtime.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// Exercise complete transactions through the owner without constructing unrelated resolver stores.
function criticalFixture(names = ['Earth', 'Air', 'Earth']) {
  const captured = captureEffectEmissions();
  const context = {
    config: { sigilSets: [{ names }, { names }] },
    activeWeaponSet: 1,
    procs: createProcRegistry(() => ({})),
    effects: captured.effects
  };
  return { sigil: createSigilRuntime(), context, ...captured };
}

const criticalHit = { type: 'damage', at: 2, source: 'fixture', sourceId: 1, actorType: 'player', coefficient: 1 };

test('critical sigils commit deduplicated procs and preserve strict cooldowns across weapon sets', () => {
  const { sigil, context, events, announcements } = criticalFixture();
  const { procs } = context;
  procs.setDeadline(`sigil.${SIGIL_IDS.EARTH}`, 2);
  procs.setDeadline(`sigil.${SIGIL_IDS.AIR}`, 3);
  procs.setDeadline(`sigil.${SIGIL_IDS.DOOM}`, 9);
  const trigger = (at) => sigil.criticalHit(context, { ...criticalHit, at }, { chance: 0.5, didCrit: true });
  trigger(2);
  assert.deepEqual(events, []);
  trigger(2.04);
  assert.deepEqual(
    events.map(({ sourceId }) => sourceId),
    [`sigil.${SIGIL_IDS.EARTH}`]
  );
  assert.equal(procs.deadline(`sigil.${SIGIL_IDS.EARTH}`), 4.04);
  context.activeWeaponSet = 2;
  trigger(3);
  assert.equal(events.length, 1);
  trigger(3.04);
  assert.deepEqual(
    events.map(({ sourceId }) => sourceId),
    [`sigil.${SIGIL_IDS.EARTH}`, `sigil.${SIGIL_IDS.AIR}`]
  );
  assert.equal(procs.deadline(`sigil.${SIGIL_IDS.AIR}`), 6.04);
  assert.equal(procs.deadline(`sigil.${SIGIL_IDS.DOOM}`), 9);
  assert.equal(announcements.length, 2);
});

test('critical sigils reject ineligible hits without emissions or cooldown claims', () => {
  const { sigil, context, events, announcements } = criticalFixture();
  for (const change of [
    { type: 'marker' },
    { offTarget: true },
    { cancelled: true },
    { canCrit: false },
    { flatDamage: 10 },
    { flatStrikeBase: 10 },
    { flatStrikePowerCoeff: 1 },
    { coefficient: 0 },
    { actorType: 'summon' }
  ])
    sigil.criticalHit(context, { ...criticalHit, ...change }, { chance: 1, didCrit: true });
  for (const critical of [{ chance: 0, didCrit: true }, { chance: 0.5, didCrit: false }, { chance: 1 }])
    sigil.criticalHit(context, criticalHit, critical);
  assert.deepEqual(events, []);
  assert.deepEqual(announcements, []);
  assert.equal(context.procs.deadline(`sigil.${SIGIL_IDS.EARTH}`), 0);
  assert.equal(context.procs.deadline(`sigil.${SIGIL_IDS.AIR}`), 0);
  sigil.criticalHit(
    context,
    { ...criticalHit, actorType: 'effect', canTriggerCriticalSigils: true },
    { chance: 0.5, didCrit: true }
  );
  assert.equal(events.length, 2);
  assert.equal(announcements.length, 2);
});

// Reentry during packet, profile or announcement delivery must find every selected proc already reserved.
test('critical sigils reserve all selected cooldowns before reentrant delivery', () => {
  for (const names of [
    ['Earth', 'Air'],
    ['Strength', 'Air']
  ]) {
    const { sigil, context } = criticalFixture(names);
    const trigger = () => sigil.criticalHit(context, criticalHit, { chance: 1, didCrit: true });
    const captured = captureEffectEmissions({
      submit: trigger,
      announce: trigger
    });
    context.effects = captured.effects;
    trigger();
    assert.deepEqual(
      captured.events.map(({ sourceId }) => sourceId),
      names.map((name) => `sigil.${SIGIL_IDS[name.toUpperCase()]}`)
    );
    assert.deepEqual(
      captured.announcements.map(({ announcement }) => announcement.name),
      names.map((name) => `Sigil of ${name}`)
    );
  }
});

test('critical sigil materialization rejects unsupported effects', () => {
  assert.throws(
    () => createCriticalSigilRequest(999999, { effect: 'unsupported' }, { at: 0 }),
    /Unsupported critical sigil effect/
  );
});

test('Blight procs supply condition-dependent readiness and expire without recursive relic output', () => {
  // Poison creates a later scheduling opportunity, and the resolver sees the same condition at that time.
  const observed = [];
  const appliedStacks = [];
  const profession = defineTestProfession({
    id: 'blight-facts-fixture',
    name: 'Blight facts fixture',
    catalog: createCanonicalCatalog(),
    hooks: {
      initialize(context) {
        context.effects.emit({
          kind: 'packet',
          event: {
            type: 'damage',
            at: 0.1,
            coefficient: 1,
            weaponStrength: 1000,
            source: 'fixture',
            sourceId: 'strike',
            actorType: 'player'
          }
        });
        for (const at of [0.2, 4.1]) context.schedule('fixture.consume-poison', at);
      },
      tasks: {
        'fixture.consume-poison': (context) => {
          const poisoned = context.combat.targetHasCondition('Poisoned', context.time);
          observed.push(poisoned);

          if (poisoned)
            context.effects.emit({
              kind: 'packet',
              event: {
                type: 'marker',
                at: context.time,
                name: 'Poison opportunity',
                source: 'fixture',
                sourceId: 'follow-up',
                actorType: 'player'
              }
            });
        }
      },
      reactions: {
        'condition.applied': (context, event) => {
          if (event.sourceId === `sigil.${SIGIL_IDS.BLIGHT}`)
            appliedStacks.push(context.combat.targetConditionStacks('Poisoned', 0.2, context));
        }
      }
    }
  });
  const config = {
    attributeInputs: baseAttributeInputs({ power: 1000, precision: 4000 }),
    sigilSets: [{ names: ['Blight'] }],
    relic: 'Shackles'
  };
  const result = simulateGw2({ profession, config, rotation: [{ type: 'wait', durationMs: 5000 }] });
  assert.deepEqual(observed, [true, false]);
  // Immediate sigil applications enter live state one stack at a time before later readiness checks.
  assert.deepEqual(appliedStacks, [1, 2]);
  assert.equal(result.events.filter((event) => event.sourceId === 'follow-up').length, 1);
  assert.equal(
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === `sigil.${SIGIL_IDS.BLIGHT}`)
      .reduce((sum, event) => sum + event.stacks, 0),
    2
  );
  assert.ok(result.events.every((event) => event.sourceId !== `relic.${RELIC_IDS.SHACKLES}`));
});

// Identical short histories expose equipment eligibility without depending on a saved rotation.
test('critical sigil cooldowns persist across weapon swaps and cannot proc while unequipped', () => {
  for (const startingWeaponSet of [1, 2]) {
    const otherSet = startingWeaponSet === 1 ? 2 : 1;
    for (const startsEquipped of [false, true]) {
      const profession = defineTestProfession({
        id: 'sigil-cooldown-fixture',
        name: 'Sigil cooldown fixture',
        catalog: createCanonicalCatalog(),
        hooks: {
          initialize(context) {
            const owner = { source: 'Fixture', sourceId: 'fixture', actorType: 'player' };
            for (const at of [0.1, 0.3, 0.5]) {
              context.effects.emit({
                kind: 'packet',
                event: { ...owner, type: 'damage', at, coefficient: 1, weaponStrength: 1000 }
              });
            }

            context.effects.emit({
              kind: 'packet',
              event: { ...owner, type: 'weapon_set', at: 0.2, weaponSet: otherSet }
            });

            if (startsEquipped) {
              context.effects.emit({
                kind: 'packet',
                event: { ...owner, type: 'weapon_set', at: 0.4, weaponSet: startingWeaponSet }
              });
            }
          }
        }
      });
      const equippedSet = startsEquipped ? startingWeaponSet : otherSet;
      const config = {
        startingWeaponSet,
        attributeInputs: baseAttributeInputs({ power: 1000, precision: 4000 }),
        sigilSets: [1, 2].map((set) => ({ names: set === equippedSet ? ['Earth'] : [] }))
      };
      const rotation = [{ type: 'wait', durationMs: 1000 }];
      const scheduled = simulateGw2({ profession, config, rotation: rotation });
      const resolved = simulateGw2({ profession, config, rotation });
      for (const events of [scheduled.events, resolved.resolvedEvents]) {
        assert.deepEqual(
          events.filter((event) => event.sourceId === `sigil.${SIGIL_IDS.EARTH}`).map((event) => event.at),
          [startsEquipped ? 0.12 : 0.32]
        );
      }
    }
  }
});

test('sigil cooldown boundaries use exact canonical instants', () => {
  // Equivalent floating-point timestamps share a blocked deadline; the next canonical instant is ready.
  assert.equal(isInternalCooldownReady(5.96, 6), false);
  assert.equal(isInternalCooldownReady(6, 6), false);
  assert.equal(isInternalCooldownReady(6.04, 6), true);
  assert.equal(isInternalCooldownReady(0.1 + 0.2, 0.3), false);
});

test('computed combat boundaries admit opening procs but exclude the preceding microsecond', () => {
  // Decimal addition must not put the opening hit before combat or admit a genuinely earlier hit.
  const profession = defineTestProfession({
    id: 'combat-boundary-fixture',
    name: 'Combat Boundary Fixture',
    catalog: createCanonicalCatalog({
      skills: [
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
  const config = { attributeInputs: baseAttributeInputs({ precision: 4000 }), sigilSets: [{ names: ['Air'] }] };
  const rotation = [{ type: 'wait', durationMs: 100 }, 'Strike', { type: 'combat-start', concurrentOffsetMs: 200 }];
  const scheduled = simulateGw2({ profession, config, rotation: rotation });
  assert.equal(scheduled.combatStartTime, 0.32);
  const sigilTimes = (events) =>
    events
      .filter((event) => event.type === 'damage' && event.sourceId === `sigil.${SIGIL_IDS.AIR}`)
      .map((event) => event.at);
  assert.deepEqual(sigilTimes(scheduled.events), [0.32]);
  assert.deepEqual(sigilTimes(simulateGw2({ profession, config, rotation }).resolvedEvents), [0.32]);
});

test('missed attacks leave consecutive swaps out of combat', () => {
  // A retained cast must not impose combat recharge when its hostile effects miss.
  const profession = defineTestProfession({
    id: 'missed-swap-fixture',
    name: 'Missed Swap Fixture',
    catalog: createCanonicalCatalog({
      skills: [
        { id: 1, name: 'Strike', type: 'Utility', castTimeMs: 1000, effects: [{ type: 'strike', coefficient: 1 }] },
        {
          id: 2,
          name: 'Swap Weapons',
          inputCategory: 'weapon-swap',
          type: 'Action',
          castTimeMs: 0,
          cooldown: 10,
          rechargeIgnoresAlacrity: true,
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
      result.steps.filter((step) => step.skillName === 'Swap Weapons').map((step) => step.start),
      offTarget ? [1000, 1000] : [1000, 11000]
    );

    if (offTarget) assert.equal(result.totalDamage, 0);
  }
});

test('critical facts follow weapon swaps without proc sigils', () => {
  const defaults = defaultSimulationConfig();
  const stats = {
    ...defaults.attributeInputs.weaponSets[0].commonTotals,
    precision: 895
  };
  const result = simulateMesmer(
    ['__combat_start', 'Swap Weapons', 'Flying Cutter'],
    defaultSimulationConfig({
      food: 'Cilantro Lime Sous-Vide Steak',
      weaponSet2Primary: 'Dagger',
      weaponSet2Secondary: 'Sword',
      stats,
      attributeInputs: baseAttributeInputs(
        { ...{}, ...stats },
        {
          ...{},
          ...{
            ...stats,
            precision: 3100
          }
        }
      ),
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
      attributeInputs: baseAttributeInputs({ ...defaults.attributeInputs.weaponSets[0].commonTotals, precision: 4000 }),
      sigilSets: [{ names: ['Torment'], strikeAdd: 0, conditionAdd: 0 }, { names: [] }]
    })
  );

  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Sigil of Torment').map((step) => step.start),
    [360]
  );
});
