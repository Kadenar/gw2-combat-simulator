import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const config = {
  specialization: 'Untamed',
  selectedPet: 'Carrion Devourer',
  initialUntamedState: 'Ranger',
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 })
};
const wait = (durationMs) => ({ type: 'wait', durationMs });

// Each projectile carries half the skill's coefficient and one of its two total bleeding stacks.
test('Twin Darts splits damage and bleeding between its two pet-owned projectiles', () => {
  const result = runRanger(['__combat_start', wait(1600)], config);
  assert.deepEqual(result.warnings, []);
  const packets = result.resolvedEvents.filter(({ skillId }) => skillId === ID.TWIN_DARTS);
  const strikes = packets.filter(({ type }) => type === 'damage');
  const bleeds = packets.filter(({ type }) => type === 'condition');
  assert.ok(strikes.length > 0);
  assert.equal(
    strikes.reduce((sum, { coefficient }) => sum + coefficient, 0),
    0.3
  );
  assert.deepEqual(
    bleeds.map(({ stacks, duration }) => [stacks, duration]),
    [
      [1, 2],
      [1, 2]
    ]
  );
  assert.ok(packets.every(({ actorType }) => actorType === 'summon'));
  assert.equal(rangerCatalog.skillsById.get(ID.TWIN_DARTS).effects[0].comboFinishers[0].chance, 0.2);
});

// Preserve the game's stat-ownership bug while ordinary attacks retain independent pet attributes.
test('Poisonous Cloud scales with Ranger power and condition damage on Untamed', () => {
  const simulate = (stats) =>
    runRanger(['__combat_start', ID.POISONOUS_CLOUD, wait(8000)], {
      ...config,
      attributeInputs: baseAttributeInputs({ ...config.attributeInputs?.weaponSets[0].commonTotals, ...stats })
    });
  const base = simulate({});
  const boosted = simulate({ power: 4000, conditionDamage: 1000 });
  for (const result of [base, boosted]) {
    assert.deepEqual(result.warnings, []);
    const cloud = result.resolvedEvents.filter(({ skillId }) => skillId === ID.POISONOUS_CLOUD);
    const strikes = cloud.filter(({ type }) => type === 'damage');
    const poison = cloud.filter(({ type }) => type === 'condition');
    assert.ok(strikes.length > 0);
    assert.ok(poison.length > 0);
    assert.ok(strikes.every(({ coefficient, actorType }) => coefficient === 0.2 && actorType === 'player'));
    assert.ok(
      poison.every(({ stacks, duration, actorType }) => stacks === 1 && duration === 6 && actorType === 'player')
    );
  }

  for (const type of ['damage', 'condition']) {
    const damage = (result) =>
      result.resolvedEvents.find((event) => event.skillId === ID.POISONOUS_CLOUD && event.type === type).damage;
    assert.ok(damage(boosted) > damage(base));
  }

  const dart = (result) =>
    result.resolvedEvents.find((event) => event.skillId === ID.TWIN_DARTS && event.type === 'damage').damage;
  assert.equal(dart(boosted), dart(base));
});

// Both versions must emit control so disabling traits observe the knockback.
test('pet and Soulbeast Tail Lash trigger Carnivore', () => {
  for (const [specialization, skillId] of [
    ['Untamed', ID.PET_TAIL_LASH],
    ['Soulbeast', ID.TAIL_LASH]
  ]) {
    const result = runRanger(['__combat_start', skillId, wait(3000)], {
      ...config,
      specialization,
      selectedTraitIds: [TRAIT.CARNIVORE]
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(rangerCatalog.skillsById.get(skillId).cooldown, 20);
    assert.ok(
      result.events.some(
        (event) => event.skillId === skillId && event.type === 'control' && event.controlKind === 'knockback'
      )
    );
    assert.ok(result.resolvedEvents.some((event) => event.sourceId === TRAIT.CARNIVORE && event.damage > 0));
  }
});
