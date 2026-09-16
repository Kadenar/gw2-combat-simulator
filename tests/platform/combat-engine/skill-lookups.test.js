import assert from 'node:assert/strict';
import test from 'node:test';

import { addEffectToActor, addSkillToActor } from '#gw2/platform/combat-engine/mutations.js';
import { getSkillEntity } from '#gw2/platform/combat-engine/queries.js';
import { createEntity, createRegistry, destroyEntity } from '#gw2/platform/combat-engine/registry.js';
import { createRandomSource } from '#gw2/platform/combat-engine/rng.js';
import { prepareEncounter } from '#gw2/platform/combat-engine/run.js';
import { setupEncounter } from '#gw2/platform/combat-engine/systems/setup.js';
import { encounter, skill } from '../../fixtures/combat-engine.js';

function setup(configuration = encounter({ skills: [skill('Hit')], targetBuild: { skills: [skill('Hit')] } })) {
  const registry = createRegistry(prepareEncounter(configuration), createRandomSource(1), false);
  setupEncounter(registry);
  const named = (name) => [...registry.names].find(([, value]) => value === name)[0];
  return { registry, player: named('player'), target: named('golem') };
}

// Direct indexes must respect exact ownership, packed ordering, and component lifetimes without caching group decisions.
test('direct lookups reuse the index and refresh after rename, reassignment, destruction, and entity recycling', (t) => {
  const { registry, player, target } = setup();
  const playerHit = getSkillEntity(registry, 'Hit', player);
  const targetHit = getSkillEntity(registry, 'Hit', target);
  assert.notEqual(playerHit, targetHit);
  const scans = t.mock.method(registry.isSkill, 'forEach');
  assert.equal(getSkillEntity(registry, 'Hit', player), playerHit);
  assert.equal(addSkillToActor(registry, registry.isSkill.get(playerHit), player), playerHit);
  assert.equal(scans.mock.callCount(), 0);

  const configured = registry.isSkill.get(playerHit);
  registry.isSkill.emplaceOrReplace(playerHit, { ...configured, skillKey: 'Renamed' });
  assert.equal(getSkillEntity(registry, 'Renamed', player), playerHit);
  assert.throws(() => getSkillEntity(registry, 'Hit', player), { code: 'engine.unknown-skill' });
  registry.owner.emplaceOrReplace(playerHit, target);
  assert.equal(getSkillEntity(registry, 'Renamed', target), playerHit);
  assert.throws(() => getSkillEntity(registry, 'Renamed', player), { code: 'engine.unknown-skill' });
  destroyEntity(registry, playerHit);
  assert.throws(() => getSkillEntity(registry, 'Renamed', target), { code: 'engine.unknown-skill' });
  const recycled = createEntity(registry);
  assert.notEqual(recycled, playerHit);
  registry.owner.emplace(recycled, player);
  registry.isSkill.emplace(recycled, configured);
  assert.equal(getSkillEntity(registry, 'Hit', player), recycled);
  registry.isSkill.clear();
  assert.throws(() => getSkillEntity(registry, 'Hit', player), { code: 'engine.unknown-skill' });
});

test('duplicate direct keys preserve the first matching view entry after swap-and-pop removal', () => {
  const { registry, player } = setup();
  const original = getSkillEntity(registry, 'Hit', player);
  const duplicate = createEntity(registry);
  registry.owner.emplace(duplicate, player);
  registry.isSkill.emplace(duplicate, registry.isSkill.get(original));
  assert.equal(getSkillEntity(registry, 'Hit', player), duplicate);
  destroyEntity(registry, duplicate);
  assert.equal(getSkillEntity(registry, 'Hit', player), original);
});

test('conditional groups reevaluate effects and cooldowns, while a matching direct skill takes precedence', () => {
  const { registry, player } = setup(
    encounter({
      skills: [skill('Ready'), skill('Fallback'), skill('Gate')],
      playerBuild: {
        conditional_skill_groups: [
          {
            skill_key: 'Attack',
            conditional_skill_keys: [
              { skill_key: 'Ready', condition: { effect_on_source: 'MIGHT', depends_on_skill_off_cooldown: 'Gate' } },
              { skill_key: 'Fallback' }
            ]
          }
        ]
      }
    })
  );
  const ready = getSkillEntity(registry, 'Ready', player);
  const fallback = getSkillEntity(registry, 'Fallback', player);
  const gate = getSkillEntity(registry, 'Gate', player);
  assert.equal(getSkillEntity(registry, 'Attack', player), fallback);
  addEffectToActor(registry, 'MIGHT', player, player, '', 100, 1);
  assert.equal(getSkillEntity(registry, 'Attack', player), ready);
  registry.cooldown.emplace(gate, { duration: [10, 10], progress: [0, 0] });
  assert.equal(getSkillEntity(registry, 'Attack', player), fallback);
  registry.cooldown.remove(gate);
  assert.equal(getSkillEntity(registry, 'Attack', player), ready);
  const direct = addSkillToActor(registry, { ...registry.isSkill.get(ready), skillKey: 'Attack' }, player);
  assert.equal(getSkillEntity(registry, 'Attack', player), direct);
  destroyEntity(registry, direct);
  assert.equal(getSkillEntity(registry, 'Attack', player), ready);
});
