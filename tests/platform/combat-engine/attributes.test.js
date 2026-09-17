import assert from 'node:assert/strict';
import test from 'node:test';

import { runCombatLoop } from '#gw2/platform/combat-engine/loop.js';
import { addEffectToActor, applySideEffects } from '#gw2/platform/combat-engine/mutations.js';
import {
  createEntity,
  createRegistry,
  destroyEntity,
  markAttributesDirty
} from '#gw2/platform/combat-engine/registry.js';
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
  markAttributesDirty(registry);
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

test('removing static attributes drops obsolete actor pairs', () => {
  const { registry, player, target } = setup(encounter());
  registry.staticAttributes.remove(target);
  calculateRelativeAttributes(registry);
  assert.equal(registry.relativeAttributes.has(target), false);
  assert.equal(registry.relativeAttributes.get(player).has(target), false);
});

test('actor-local invalidation updates source and target pairs without rebuilding unrelated pairs', (t) => {
  const { registry, player, target } = setup(
    encounter({
      playerBuild: { permanent_unique_effects: [trait([modifier({ effect_on_target: 'BURNING' })])] }
    })
  );
  const unaffected = registry.relativeAttributes.get(player).get(0);
  const resets = t.mock.method(unaffected, 'clear');
  addEffectToActor(registry, 'BURNING', target, player, '', 100, 1);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  assert.equal(relativeAttribute(registry, player, 0, 'power'), 1000);
  assert.equal(resets.mock.callCount(), 0);
  registry.staticAttributes.emplaceOrReplace(
    target,
    new Map([...registry.staticAttributes.get(target), ['power', 3000]])
  );
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, target, player, 'power'), 3000);
  assert.equal(resets.mock.callCount(), 0);
});

test('reparenting and destroying a modifier invalidates its former and current owner', () => {
  const { registry, player, target } = setup(encounter());
  const holder = createEntity(registry);
  registry.owner.emplace(holder, player);
  registry.isAttributeModifier.emplace(holder, [
    {
      condition: { not: [], or: [], and: [] },
      attribute: 'power',
      multiplier: 2,
      addend: 0
    }
  ]);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  registry.owner.emplaceOrReplace(holder, target);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, 0, 'power'), 1000);
  assert.equal(relativeAttribute(registry, target, 0, 'power'), 2000);
  destroyEntity(registry, holder);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, target, 0, 'power'), 1000);
});

test('a global counter invalidates pairs that do not include the counter owner', () => {
  const { registry, player, target } = setup(
    encounter({
      playerBuild: {
        permanent_unique_effects: [
          trait([
            modifier({
              threshold: {
                threshold_type: 'lower_bound_inclusive',
                threshold_value: 1,
                counter_value_subject_to_threshold: 'Global'
              }
            })
          ])
        ]
      },
      targetBuild: {
        counters: [
          { counter_key: 'Global', counter_modifiers: [{ counter_key: 'Global', operation: 'add', value: 1 }] }
        ]
      }
    })
  );
  assert.equal(relativeAttribute(registry, player, 0, 'power'), 1000);
  applySideEffects(registry, target, () => true);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, 0, 'power'), 2000);
});

test('empty newer holders still consume considered-stack slots before contributing holders', () => {
  const { registry, player, target } = setup(
    encounter({
      playerBuild: {
        permanent_unique_effects: [
          {
            unique_effect_key: 'Capped',
            max_stored_stacks: 2,
            max_considered_stacks: 1,
            attribute_modifiers: [modifier({})]
          },
          { unique_effect_key: 'Capped', max_stored_stacks: 2, max_considered_stacks: 1 }
        ]
      }
    })
  );
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
  assert.equal(relativeAttribute(registry, player, player, 'power'), 1000);
});

test('value changes reuse attribute metadata while modifiers and conversions evaluate live predicates', (t) => {
  const { registry, player, target } = setup(
    encounter({
      playerBuild: {
        permanent_unique_effects: [
          {
            ...trait([modifier({ weapon_set: 'set_2' })]),
            attribute_conversions: [
              { condition: { weapon_set: 'set_2' }, from: 'power', to: 'condition_damage', multiplier: 0.1 }
            ]
          }
        ]
      }
    })
  );
  const modifiers = t.mock.method(registry.isAttributeModifier, 'forEach');
  const conversions = t.mock.method(registry.isAttributeConversion, 'forEach');
  registry.currentWeaponSet.emplaceOrReplace(player, 'set_2');
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  assert.equal(relativeAttribute(registry, player, target, 'condition_damage'), 200);
  registry.currentWeaponSet.emplaceOrReplace(player, 'set_1');
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
  assert.equal(relativeAttribute(registry, player, target, 'condition_damage'), 0);
  assert.equal(modifiers.mock.callCount(), 0);
  assert.equal(conversions.mock.callCount(), 0);
});

test('replacing skill-group predicates refreshes transitive attribute dependencies', () => {
  const { registry, player, target } = setup(
    encounter({
      skills: [skill('Ready'), skill('Blocked')],
      playerAttributes: [['max_health', 100]],
      playerBuild: {
        conditional_skill_groups: [{ skill_key: 'Selected', conditional_skill_keys: [{ skill_key: 'Ready' }] }],
        permanent_unique_effects: [trait([modifier({ depends_on_skill_off_cooldown: 'Selected' })])]
      }
    })
  );
  const [groupEntity, group] = [...registry.isConditionalSkillGroup.entries()][0];
  const member = group.conditionalSkillKeys[0];
  const blocked = [...registry.isSkill.entries()].find(([, entry]) => entry.skillKey === 'Blocked')[0];
  registry.cooldown.emplace(blocked, { duration: [100, 100], progress: [0, 0] });
  registry.isConditionalSkillGroup.emplaceOrReplace(groupEntity, {
    ...group,
    conditionalSkillKeys: [
      {
        ...member,
        condition: {
          ...member.condition,
          threshold: { thresholdType: 'lower_bound_inclusive', thresholdValue: 0.5, healthPctSubjectToThreshold: true }
        }
      },
      { ...member, skillKey: 'Blocked' }
    ]
  });
  calculateRelativeAttributes(registry);
  assert.equal(registry.attributeDependencies.has('health'), true);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  registry.combatStats.emplaceOrReplace(player, { health: 1 });
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
  registry.isConditionalSkillGroup.emplaceOrReplace(groupEntity, group);
  calculateRelativeAttributes(registry);
  assert.equal(registry.attributeDependencies.has('health'), false);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
});

test('cached stack admission refreshes when caps or holder definitions change', () => {
  const { registry, player, target } = setup(
    encounter({
      playerBuild: {
        permanent_unique_effects: [
          { ...trait([modifier({})]), max_stored_stacks: 2, max_considered_stacks: 1 },
          { ...trait([]), max_stored_stacks: 2, max_considered_stacks: 1 }
        ]
      }
    })
  );
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
  const [holder, entries] = [...registry.isAttributeModifier.entries()].find(([, entries]) => entries.length > 0);
  const effect = registry.owner.get(holder);
  registry.isUniqueEffect.emplaceOrReplace(effect, { ...registry.isUniqueEffect.get(effect), maxConsideredStacks: 2 });
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  registry.isAttributeModifier.emplaceOrReplace(holder, [{ ...entries[0], addend: 500 }]);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1500);
  registry.isAttributeModifier.remove(holder);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
});

test('unrelated effect and ownership churn retains holder metadata while predicates stay live', (t) => {
  const { registry, player, target } = setup(
    encounter({
      playerBuild: { permanent_unique_effects: [trait([modifier({ effect_on_target: 'BURNING' })])] }
    })
  );
  const modifiers = t.mock.method(registry.isAttributeModifier, 'forEach');
  const conversions = t.mock.method(registry.isAttributeConversion, 'forEach');
  const burning = addEffectToActor(registry, 'BURNING', target, player, '', 100, 1);
  const unrelated = createEntity(registry);
  registry.owner.emplace(unrelated, player);
  registry.owner.emplaceOrReplace(unrelated, target);
  const unique = [...registry.isUniqueEffect.entries()][0][1];
  registry.isUniqueEffect.emplace(unrelated, unique);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  destroyEntity(registry, burning);
  destroyEntity(registry, unrelated);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
  assert.equal(modifiers.mock.callCount(), 0);
  assert.equal(conversions.mock.callCount(), 0);
});

test('holder metadata follows ancestor reassignment and admits holders that gain ownership', () => {
  for (const name of ['isAttributeModifier', 'isAttributeConversion']) {
    const { registry, player, target } = setup(encounter());
    const holder = createEntity(registry);
    const parent = createEntity(registry);
    const ancestor = createEntity(registry);
    registry.owner.emplace(parent, ancestor);
    registry.owner.emplace(ancestor, player);
    const condition = { not: [], or: [], and: [] };
    const entry =
      name === 'isAttributeModifier'
        ? { condition, attribute: 'power', multiplier: 1, addend: 100 }
        : { condition, from: 'power', to: 'power', multiplier: 0, addend: 100 };
    registry[name].emplace(holder, [entry]);
    markAttributesDirty(registry);
    calculateRelativeAttributes(registry);
    assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
    registry.owner.emplace(holder, parent);
    calculateRelativeAttributes(registry);
    assert.equal(relativeAttribute(registry, player, target, 'power'), 1100);
    registry.owner.emplaceOrReplace(ancestor, target);
    calculateRelativeAttributes(registry);
    assert.equal(relativeAttribute(registry, player, 0, 'power'), 1000);
    assert.equal(relativeAttribute(registry, target, 0, 'power'), 1100);
    registry.owner.remove(holder);
    calculateRelativeAttributes(registry);
    assert.equal(relativeAttribute(registry, target, 0, 'power'), 1000);
  }
});

test('stack metadata tracks empty holders and effect component removal and clearing', () => {
  const { registry, player, target } = setup(
    encounter({
      playerBuild: {
        permanent_unique_effects: [
          { ...trait([modifier({})]), max_stored_stacks: 2, max_considered_stacks: 1 },
          { ...trait([]), max_stored_stacks: 2, max_considered_stacks: 1 }
        ]
      }
    })
  );
  const [newer, unique] = [...registry.isUniqueEffect.entries()][0];
  registry.isUniqueEffect.emplaceOrReplace(newer, { ...unique, uniqueEffectKey: 'Different' });
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  registry.isUniqueEffect.emplaceOrReplace(newer, unique);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
  registry.isUniqueEffect.clear();
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  const parents = [...registry.isAttributeModifier.entries()].map(([entity]) => registry.owner.get(entity));
  for (const parent of parents) registry.isEffect.emplace(parent, { effect: 'FURY', groupedWithNumStacks: 1 });
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 1000);
  registry.isEffect.remove(newer);
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
  registry.isEffect.clear();
  calculateRelativeAttributes(registry);
  assert.equal(relativeAttribute(registry, player, target, 'power'), 2000);
});

test('ownership-led holder views preserve swap-and-pop order and leading-pool changes', () => {
  const registry = createRegistry(prepareEncounter(encounter()), createRandomSource(1), false);
  const actor = createEntity(registry);
  registry.isActor.emplace(actor, true);
  registry.staticAttributes.emplace(actor, new Map([['power', 1000]]));
  const unrelated = createEntity(registry);
  const add = createEntity(registry);
  const multiply = createEntity(registry);
  const orphan = createEntity(registry);
  const condition = { not: [], or: [], and: [] };
  registry.owner.emplace(unrelated, actor);
  registry.owner.emplace(add, actor);
  registry.owner.emplace(multiply, actor);
  registry.isAttributeModifier.emplace(add, [{ condition, attribute: 'power', multiplier: 1, addend: 100 }]);
  registry.isAttributeModifier.emplace(multiply, [{ condition, attribute: 'power', multiplier: 2, addend: 0 }]);
  registry.isAttributeModifier.emplace(orphan, []);
  const power = () => {
    calculateRelativeAttributes(registry);
    return relativeAttribute(registry, actor, actor, 'power');
  };

  assert.equal(power(), 2100);
  registry.owner.remove(unrelated);
  assert.equal(power(), 2200);
  registry.owner.emplace(unrelated, actor);
  registry.owner.emplace(createEntity(registry), actor);
  assert.equal(power(), 2100);
  registry.owner.clear();
  assert.equal(power(), 1000);
});
