import assert from 'node:assert/strict';
import test from 'node:test';

import { runCombatLoop } from '#gw2/platform/combat-engine/loop.js';
import { createEntity, createRegistry, destroyEntity } from '#gw2/platform/combat-engine/registry.js';
import { createRandomSource } from '#gw2/platform/combat-engine/rng.js';
import { prepareEncounter, runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { setupEncounter } from '#gw2/platform/combat-engine/systems/setup.js';
import { encounter, flatStrike } from '../../fixtures/combat-engine.js';

// Stop at tick zero to exercise cached actor membership separately from the ticking systems.
function setup(conditions) {
  const registry = createRegistry(
    prepareEncounter(encounter({ terminationConditions: [...conditions, { type: 'TIME', time: 0 }] })),
    createRandomSource(1),
    false
  );
  setupEncounter(registry);
  return { registry, reason: () => runCombatLoop(registry, { total: 0, bySourceActor: new Map() }) };
}

test('simultaneously satisfied stop conditions retain configured order and downstate precedence', () => {
  const damage = { type: 'DAMAGE', actor: 'golem', damage: 100 };
  const time = { type: 'TIME', time: 1 };
  for (const [conditions, health, expected] of [
    [[damage, time], 1000, 'DAMAGE'],
    [[time, damage], 1000, 'TIME'],
    [[time, damage], 100, 'downstate']
  ]) {
    const result = runCombatEngine({
      encounter: encounter({
        skills: [flatStrike('Hit', 100)],
        casts: ['Hit'],
        targetAttributes: [['max_health', health]],
        terminationConditions: conditions
      })
    });
    assert.equal(result.ok, true, result.message);
    assert.equal(result.endTick, 1);
    assert.equal(result.terminatedBy, expected);
  }
});

test('named damage checks reuse matches, read live health, and refresh on actor replacement', (t) => {
  const { registry, reason } = setup([{ type: 'DAMAGE', actor: 'late', damage: 1 }]);
  assert.equal(reason(), 'TIME');
  const actor = createEntity(registry, 'late');
  registry.isActor.emplace(actor, true);
  registry.staticAttributes.emplace(actor, new Map([['max_health', 100]]));
  assert.equal(reason(), 'TIME');
  const names = t.mock.method(registry.names, 'get');
  registry.combatStats.get(actor).health = 99;
  assert.equal(reason(), 'DAMAGE');
  assert.equal(names.mock.callCount(), 0);
  destroyEntity(registry, actor);
  assert.equal(reason(), 'TIME');
  const replacement = createEntity(registry, 'late');
  registry.isActor.emplace(replacement, true);
  registry.staticAttributes.emplace(replacement, new Map([['max_health', 100]]));
  registry.combatStats.emplace(replacement, { health: 99 });
  assert.equal(reason(), 'DAMAGE');
});

test('empty rotation selectors include temporary actors and read live completion markers', () => {
  for (const type of ['ROTATION', 'ACTIVE_SKILLS']) {
    const { registry, reason } = setup([{ type, actor: '' }]);
    registry.rotation.forEach((actor) => registry.noMoreRotation.emplace(actor, true));
    assert.equal(reason(), type);
    const child = createEntity(registry);
    registry.isActor.emplace(child, true);
    registry.rotation.emplace(child, {
      rotation: { skillCasts: [] },
      currentIndex: 0,
      tickOffset: 0,
      repeat: false,
      queuedRotation: []
    });
    assert.equal(reason(), 'TIME');
    registry.noMoreRotation.emplace(child, true);
    const pending = type === 'ROTATION' ? registry.animation : registry.finishedSkillsActions;
    pending.emplace(child, type === 'ROTATION' ? { skillEntity: 0, duration: [1, 1], progress: [0, 0] } : []);
    assert.equal(reason(), 'TIME');
    pending.remove(child);
    assert.equal(reason(), type);
    registry.noMoreRotation.remove(child);
    destroyEntity(registry, child);
    assert.equal(reason(), type);
  }
});

test('empty damage names are exact matches and downstate ignores non-actors', () => {
  const { registry, reason } = setup([{ type: 'DAMAGE', actor: '', damage: 0 }]);
  registry.isDownstate.emplace(createEntity(registry), true);
  assert.equal(reason(), 'TIME');
  const actor = createEntity(registry, '');
  registry.isActor.emplace(actor, true);
  registry.staticAttributes.emplace(actor, new Map([['max_health', 100]]));
  assert.equal(reason(), 'DAMAGE');
});
