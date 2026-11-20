// Player-owned procs inherit outgoing bonuses without becoming player attacks or scaling allied siphons.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(necromancerProfession, {
  initialResource: 100,
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 3100 }),
  target: { armor: 2597 }
});
const damage = (result, name) => result.resolvedEvents.filter((event) => event.name === name && event.damage > 0);

test('Claw scales player-owned Splinter Weapon and Explosive Growth without changing proc identity', () => {
  const run = (relic) =>
    simulate(
      'Ritualist',
      [
        'Grasping Darkness',
        { type: 'wait', durationMs: 1000 },
        'Splinter Weapon',
        "Ritualist's Shroud",
        'Anguish',
        'Essence Blast'
      ],
      { relic, primaryWeapon: 'Greatsword', selectedTraitIds: [TRAIT.EXPLOSIVE_GROWTH] }
    );
  const baseline = run('');
  const claw = run('Claw');
  assert.deepEqual(claw.warnings, []);
  for (const name of ['Splinter Weapon', 'Explosive Growth']) {
    const original = damage(baseline, name);
    const boosted = damage(claw, name);
    assert.ok(original.length > 0, name);
    assert.equal(boosted.length, original.length);
    boosted.forEach((event, index) => {
      assert.equal(event.actorType, 'effect');
      assert.equal(event.ownerActorType, 'player');
      assert.ok(event.damage > original[index].damage);
    });
  }
});

test('Soul Barbs scales food life steal only during its active window', () => {
  for (const selected of [false, true]) {
    const result = simulate(
      'Core',
      [
        'Death Shroud',
        'Life Blast',
        'Life Blast',
        'End Death Shroud',
        { type: 'wait', durationMs: 16000 },
        'Dusk Strike',
        'Fading Twilight',
        'Chilling Scythe'
      ],
      {
        primaryWeapon: 'Greatsword',
        food: 'Cilantro Lime Sous-Vide Steak',
        selectedTraitIds: selected ? [TRAIT.SOUL_BARBS] : []
      }
    );
    assert.deepEqual(result.warnings, []);
    const food = damage(result, 'Nourishment');
    assert.ok(food.length >= 2);

    if (selected) assert.ok(food[0].damage > food.at(-1).damage);
    else assert.equal(food[0].damage, food.at(-1).damage);
  }
});

test('Soul Barbs scales personal Nightmare Weapon but leaves shared recipient siphons unchanged', () => {
  const run = (selected) =>
    simulate(
      'Ritualist',
      [
        'Summon Bone Minions',
        'Nightmare Weapon',
        "Ritualist's Shroud",
        'Anguish',
        'Essence Blast',
        { type: 'wait', durationMs: 3000 }
      ],
      { selectedTraitIds: selected ? [TRAIT.SOUL_BARBS] : [] }
    );
  const baseline = run(false);
  const boosted = run(true);
  assert.deepEqual(boosted.warnings, []);
  for (const name of ['Nightmare Weapon (Personal)', 'Nightmare Weapon (Shared)']) {
    const original = damage(baseline, name);
    const actual = damage(boosted, name);
    assert.ok(original.length > 0, name);
    assert.equal(actual.length, original.length);
    actual.forEach((event, index) => {
      if (name === 'Nightmare Weapon (Personal)') assert.ok(event.damage > original[index].damage);
      else assert.equal(event.damage, original[index].damage);
    });
  }
});
