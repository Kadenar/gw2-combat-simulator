import assert from 'node:assert/strict';
import test from 'node:test';

import { findCounter } from '#gw2/platform/combat-engine/queries.js';
import { createEntity, createRegistry, destroyEntity } from '#gw2/platform/combat-engine/registry.js';
import { createRandomSource } from '#gw2/platform/combat-engine/rng.js';
import { prepareEncounter } from '#gw2/platform/combat-engine/run.js';
import { onEveryTickHooks } from '#gw2/platform/combat-engine/systems/hooks.js';
import { setupEncounter } from '#gw2/platform/combat-engine/systems/setup.js';
import { encounter, skill } from '../../fixtures/combat-engine.js';

const always = { not: [], or: [], and: [] };

function setup(skills = []) {
  const registry = createRegistry(
    prepareEncounter(
      encounter({
        skills,
        playerBuild: { counters: [{ counter_key: 'Value' }] }
      })
    ),
    createRandomSource(1),
    false
  );
  setupEncounter(registry);
  const named = (name) => [...registry.names].find(([, value]) => value === name)[0];
  return { registry, player: named('player'), target: named('golem'), counter: findCounter(registry, 'Value') };
}

function counterHook(registry, actor, operation, value, condition = always) {
  const holder = createEntity(registry);
  registry.owner.emplace(holder, actor);
  registry.isCounterModifier.emplace(holder, [{ counterKey: 'Value', operation, value, condition }]);
  return holder;
}

// Index reuse must preserve live predicate evaluation, sparse-pool ordering, and same-tick registration boundaries.
test('tick indexes reuse stable holders and refresh after swap-and-pop removal, replacement, and clear', (t) => {
  const { registry, player, counter } = setup();
  counterHook(registry, player, 'ADD', 1);
  const set = counterHook(registry, player, 'SET', 10);
  const subtract = counterHook(registry, player, 'SUBTRACT', 2);
  onEveryTickHooks(registry);
  assert.equal(counter.value, 11);
  const scans = t.mock.method(registry.isCounterModifier, 'forEach');
  onEveryTickHooks(registry);
  assert.equal(scans.mock.callCount(), 0, 'unchanged pools must not be rescanned');
  destroyEntity(registry, set);
  counter.value = 0;
  onEveryTickHooks(registry);
  assert.equal(counter.value, -1);
  registry.isCounterModifier.emplaceOrReplace(subtract, [
    { counterKey: 'Value', operation: 'SET', value: 20, condition: always }
  ]);
  onEveryTickHooks(registry);
  assert.equal(counter.value, 21);
  registry.isCounterModifier.clear();
  onEveryTickHooks(registry);
  assert.equal(counter.value, 21);
});

test('tick indexes refresh after ownership changes and reevaluate counter predicates on every visit', () => {
  const { registry, player, target, counter } = setup();
  const holder = counterHook(registry, player, 'SET', 10);
  counterHook(registry, player, 'ADD', 1, {
    ...always,
    threshold: {
      thresholdType: 'upper_bound_exclusive',
      thresholdValue: 5,
      counterValueSubjectToThreshold: 'Value'
    }
  });
  onEveryTickHooks(registry);
  assert.equal(counter.value, 10);
  // The target runs first. Moving SET to it must let the later player's predicate observe 10.
  registry.owner.emplaceOrReplace(holder, target);
  counter.value = 0;
  onEveryTickHooks(registry);
  assert.equal(counter.value, 10);
  registry.isCounterModifier.remove(holder);
  counter.value = 0;
  onEveryTickHooks(registry);
  onEveryTickHooks(registry);
  assert.equal(counter.value, 2);
});

test('hooks added to the current trigger pool wait until the next visit, while later pools see additions immediately', () => {
  const { registry, player } = setup([
    skill('Payoff'),
    skill('Spawn', {
      skill_triggers: [{ skill_key: 'Payoff' }],
      source_actor_skill_triggers: [{ skill_key: 'Payoff' }]
    })
  ]);
  registry.isSkillTrigger.clear();
  registry.isSourceActorSkillTrigger.clear();
  onEveryTickHooks(registry); // Warm empty indexes before dynamic registration.
  const holder = createEntity(registry);
  registry.owner.emplace(holder, player);
  registry.isSkillTrigger.emplace(holder, {
    skillTrigger: { condition: always, skillKey: 'Spawn' },
    alreadyTriggered: false
  });
  onEveryTickHooks(registry);
  assert.deepEqual(
    registry.rotation.get(player).queuedRotation.map((cast) => cast.skill),
    ['Payoff']
  );
  const queuedChildren = () =>
    [...registry.rotation.entries()]
      .filter(([entity]) => registry.owner.has(entity))
      .flatMap(([, rotation]) => rotation.queuedRotation.map((cast) => cast.skill));
  assert.deepEqual(queuedChildren(), ['Spawn']);
  onEveryTickHooks(registry);
  assert.deepEqual(queuedChildren(), ['Payoff', 'Spawn']);
});

test('stage-bound counters retain missing-reference errors even when excluded from tick execution', () => {
  const { registry, player } = setup();
  const holder = counterHook(registry, player, 'ADD', 1, { ...always, onlyAppliesOnStrikes: true });
  registry.isCounterModifier.emplaceOrReplace(holder, [
    {
      counterKey: 'Missing',
      operation: 'ADD',
      value: 1,
      condition: { ...always, onlyAppliesOnStrikes: true }
    }
  ]);
  assert.throws(() => onEveryTickHooks(registry), { code: 'engine.unknown-counter' });
});
