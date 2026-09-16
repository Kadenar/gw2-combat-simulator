import assert from 'node:assert/strict';
import test from 'node:test';

import { runCombatLoop } from '#gw2/platform/combat-engine/loop.js';
import { addEffectToActor } from '#gw2/platform/combat-engine/mutations.js';
import { createEntity, createRegistry, destroyEntity } from '#gw2/platform/combat-engine/registry.js';
import { createRandomSource } from '#gw2/platform/combat-engine/rng.js';
import { prepareEncounter, runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { calculateRelativeAttributes, relativeAttribute } from '#gw2/platform/combat-engine/systems/attributes.js';
import { setupCombatStats } from '#gw2/platform/combat-engine/systems/combat.js';
import { setupEncounter } from '#gw2/platform/combat-engine/systems/setup.js';
import { damageEvents, encounter, flatStrike, skill } from '../../fixtures/combat-engine.js';

// Small encounters isolate cache invalidation and same-tick ordering from saved-rotation regressions.
const hit = (key = 'Hit', overrides = {}) => flatStrike(key, 0, { damage_coefficient: 1, ...overrides });
const modifier = (condition, attribute = 'power', addend = 1000) => ({ condition, attribute, addend });
const trait = (attributeModifiers) => ({ unique_effect_key: 'Stats', attribute_modifiers: attributeModifiers });
const burning = { effect: 'BURNING', base_duration_ms: 10, direction: 'OUTGOING' };

function run(configuration, options = {}) {
  const result = runCombatEngine({ encounter: configuration, ...options });
  assert.equal(result.ok, true, result.message);
  return result;
}

function setup(configuration) {
  const registry = createRegistry(prepareEncounter(configuration), createRandomSource(1), true);
  setupEncounter(registry);
  setupCombatStats(registry);
  calculateRelativeAttributes(registry);
  const named = (name) => [...registry.names].find(([, value]) => value === name)[0];
  return { registry, player: named('player'), target: named('golem') };
}

test('pulse conditions affect same-tick strikes and expire without leaving cached bonuses', () => {
  const result = run(
    encounter({
      skills: [hit('Ignite', { pulse_on_tick_list: [[0], [0]], on_pulse_effect_applications: [burning] }), hit()],
      casts: ['Ignite', ['Hit', 5], ['Hit', 12]],
      playerBuild: { permanent_unique_effects: [trait([modifier({ effect_on_target: 'BURNING' })])] }
    })
  );
  assert.deepEqual(
    damageEvents(result).map((event) => event.damage),
    [1000, 1000, 500]
  );
  assert.equal(result.events.filter((event) => event.type === 'effect_application').length, 1);
});

test('on-strike applications follow their triggering strike and are consumed exactly once', () => {
  const result = run(
    encounter({
      skills: [hit('Ignite', { on_strike_effect_applications: [burning] }), hit()],
      casts: ['Ignite', ['Hit', 5]],
      playerBuild: { permanent_unique_effects: [trait([modifier({ effect_on_target: 'BURNING' })])] }
    })
  );
  assert.deepEqual(
    damageEvents(result).map((event) => event.damage),
    [500, 1000]
  );
  assert.equal(result.events.filter((event) => event.type === 'effect_application').length, 1);
});

test('unchanged inputs reuse attribute maps across damage and idle ticks', (t) => {
  const { registry, player, target } = setup(
    encounter({
      skills: [hit()],
      casts: ['Hit', ['Hit', 10]],
      terminationConditions: [{ type: 'TIME', time: 20 }]
    })
  );
  const values = registry.relativeAttributes.get(player).get(target);
  const resets = t.mock.method(values, 'clear');
  runCombatLoop(registry, { total: 0, bySourceActor: new Map() });
  calculateRelativeAttributes(registry);
  assert.equal(resets.mock.callCount(), 0);
  assert.equal(registry.relativeAttributes.get(player).get(target), values);

  addEffectToActor(registry, 'MIGHT', player, player, '', 100, 1);
  assert.ok(registry.recalculateAttributes.size > 0);
  calculateRelativeAttributes(registry);
  assert.equal(registry.relativeAttributes.get(player).get(target), values);
  assert.equal(resets.mock.callCount(), 1);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1030);
  calculateRelativeAttributes(registry);
  assert.equal(resets.mock.callCount(), 1);
});

test('equipment and cooldown presence invalidate nested attribute predicates', () => {
  const { registry, player, target } = setup(
    encounter({
      skills: [skill('Recharge')],
      playerBuild: {
        permanent_unique_effects: [
          trait([
            modifier({ and: [{ weapon_set: 'set_2' }, { not: [{ bundle: 'Kit' }] }] }),
            modifier({ depends_on_skill_off_cooldown: 'Recharge' }, 'power', 100)
          ])
        ]
      }
    })
  );
  const power = () => {
    calculateRelativeAttributes(registry);
    return relativeAttribute(registry, player, target, 'power');
  };

  assert.equal(power(), 1100);
  registry.currentWeaponSet.emplaceOrReplace(player, 'set_2');
  assert.equal(power(), 2100);
  registry.bundle.emplace(player, 'Kit');
  assert.equal(power(), 1100);
  registry.bundle.remove(player);
  assert.equal(power(), 2100);
  const recharge = [...registry.isSkill.entries()].find(([, entry]) => entry.skillKey === 'Recharge')[0];
  registry.cooldown.emplace(recharge, { duration: [10, 10], progress: [0, 0] });
  assert.equal(power(), 2000);
  registry.cooldown.remove(recharge);
  assert.equal(power(), 2100);
});

test('expiring conversion holders remove their bonuses from retained maps', () => {
  const result = run(
    encounter({
      skills: [
        skill('Might', {
          pulse_on_tick_list: [[0], [0]],
          on_pulse_effect_applications: [{ effect: 'MIGHT', base_duration_ms: 5, direction: 'SELF' }]
        }),
        hit()
      ],
      casts: ['Might', ['Hit', 2], ['Hit', 7]]
    })
  );
  assert.deepEqual(
    damageEvents(result).map((event) => event.damage),
    [515, 500]
  );
});

test('same-tick counter changes refresh effect-duration attributes and preserve audited durations', () => {
  const configuration = encounter({
    skills: [
      hit('Hit', {
        pulse_on_tick_list: [[0], [0]],
        on_pulse_effect_applications: [{ effect: 'FURY', base_duration_ms: 100, direction: 'SELF' }],
        on_strike_effect_applications: [{ effect: 'FURY', base_duration_ms: 100, direction: 'SELF' }]
      })
    ],
    casts: ['Hit'],
    playerBuild: {
      counters: [{ counter_key: 'Hits' }],
      permanent_unique_effects: [
        {
          ...trait([
            modifier(
              {
                threshold: {
                  threshold_type: 'lower_bound_inclusive',
                  threshold_value: 1,
                  counter_value_subject_to_threshold: 'Hits'
                }
              },
              'boon_duration_multiplier',
              1
            )
          ]),
          counter_modifiers: [
            { condition: { only_applies_on_strikes: true }, counter_key: 'Hits', operation: 'add', value: 1 }
          ]
        }
      ]
    }
  });
  const result = run(configuration);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'effect_application').map((event) => event.durationMs),
    [100, 200]
  );
  assert.equal(run(configuration, { output: 'score' }).totalDamage, result.totalDamage);
});

test('health-dependent attributes refresh after health is committed', () => {
  const result = run(
    encounter({
      skills: [hit()],
      casts: ['Hit', ['Hit', 2]],
      targetAttributes: [['max_health', 10000]],
      playerBuild: {
        permanent_unique_effects: [
          trait([
            modifier({
              threshold: {
                threshold_type: 'upper_bound_exclusive',
                threshold_value: 1,
                target_health_pct_subject_to_threshold: true
              }
            })
          ])
        ]
      }
    })
  );
  assert.deepEqual(
    damageEvents(result).map((event) => event.damage),
    [500, 1000]
  );
});

test('random attribute predicates reroll on later consuming ticks without audit-only draws', (t) => {
  const configuration = encounter({
    skills: [hit()],
    casts: ['Hit', ['Hit', 2]],
    playerBuild: {
      permanent_unique_effects: [
        trait([
          modifier({
            or: [
              {
                threshold: {
                  threshold_type: 'upper_bound_exclusive',
                  threshold_value: 50,
                  generate_random_number_subject_to_threshold: true
                }
              }
            ]
          })
        ])
      ]
    }
  });
  const { registry } = setup(configuration);
  registry.recalculateAttributes.emplaceOrReplace(0, true);
  const draws = t.mock.method(registry.random, 'real', () => (registry.tick === 1 ? 0 : 99));
  runCombatLoop(registry, { total: 0, bySourceActor: new Map() });
  assert.deepEqual(
    registry.auditEvents.filter((event) => event.type === 'damage').map((event) => event.damage),
    [1000, 500]
  );
  assert.equal(draws.mock.callCount(), 6, 'one predicate draw per target pair on each consuming tick');
  assert.equal(run(configuration).totalDamage, run(configuration, { output: 'score' }).totalDamage);
});

test('actor creation, destruction, and static replacements update cached pairs', () => {
  const { registry, player, target } = setup(encounter());
  const extra = createEntity(registry, 'extra');
  registry.isActor.emplace(extra, true);
  registry.staticAttributes.emplace(extra, registry.staticAttributes.get(target));
  calculateRelativeAttributes(registry);
  assert.ok(registry.relativeAttributes.get(player).has(extra));
  destroyEntity(registry, extra);
  calculateRelativeAttributes(registry);
  assert.equal(registry.relativeAttributes.get(player).has(extra), false);
  registry.staticAttributes.emplaceOrReplace(
    player,
    new Map([...registry.staticAttributes.get(player), ['power', 2000]])
  );
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
});
