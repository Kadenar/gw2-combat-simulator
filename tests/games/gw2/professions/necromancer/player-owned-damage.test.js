// Player-owned procs inherit outgoing bonuses without becoming player attacks or scaling allied siphons.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

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
      assertFlooredDamageMultiplier(event.damage, original[index].damage, 1.07);
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
    assert.equal(food[0].damage, selected ? Math.floor(325 * 1.1) : 325);
    assert.equal(food.at(-1).damage, 325);
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
  for (const [name, multiplier] of [
    ['Nightmare Weapon (Personal)', 1.1],
    ['Nightmare Weapon (Shared)', 1]
  ]) {
    const original = damage(baseline, name);
    const actual = damage(boosted, name);
    assert.ok(original.length > 0, name);
    assert.equal(actual.length, original.length);
    actual.forEach((event, index) => assertFlooredDamageMultiplier(event.damage, original[index].damage, multiplier));
  }
});

test('Soul Barbs scales Soul Shards once and preserves their low-target-health multiplier', () => {
  for (const startingHealthFraction of [1, 0.4]) {
    const run = (selected) =>
      simulate('Core', ['Death Shroud', 'End Death Shroud', 'Addle', 'Perforate'], {
        primaryWeapon: 'Spear',
        target: { armor: 2597, health: 1000000, startingHealthFraction, defiant: true },
        selectedTraitIds: selected ? [TRAIT.SOUL_BARBS] : []
      });
    const baseline = run(false);
    const boosted = run(true);
    assert.deepEqual(boosted.warnings, []);
    const original = damage(baseline, 'Soul Shards');
    const actual = damage(boosted, 'Soul Shards');
    assert.ok(original.length > 0);
    assert.equal(original[0].damage, Math.floor((1504 + 0.1 * 2000) * (startingHealthFraction < 0.5 ? 1.5 : 1)));
    assert.equal(actual.length, original.length);
    actual.forEach((event, index) => assertFlooredDamageMultiplier(event.damage, original[index].damage, 1.1));
  }
});
