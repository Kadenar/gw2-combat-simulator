import assert from 'node:assert/strict';
import test from 'node:test';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(necromancerProfession, {
  primaryWeapon: 'Axe',
  secondaryWeapon: 'Warhorn',
  initialResource: 0,
  selectedTraitIds: [],
  boons: { quickness: false, alacrity: false },
  stats: { power: 2000, precision: 1000, expertise: 0, concentration: 0, vitality: 1000 },
  target: { armor: 2597, health: 1000000000, conditions: {} }
});
const wait = (durationMs) => ({ type: 'wait', durationMs });

// Landing owns every mark packet; cancellation, trait selection, and combat state gate the proc.
test('Mark of Evasion triggers at dodge completion with bleeding and party regeneration', () => {
  const result = simulate('Core', ['Dodge', 'Dodge'], { selectedTraitIds: [TRAIT.MARK_OF_EVASION] });
  assert.deepEqual(result.warnings, []);
  for (const step of result.steps) {
    const packets = result.resolvedEvents.filter(
      (event) => event.sourceId === TRAIT.MARK_OF_EVASION && event.at === step.end / 1000
    );
    assert.equal(packets.find((event) => event.type === 'damage').coefficient, 0.33);
    const bleed = packets.find((event) => event.type === 'condition');
    assert.equal(bleed.condition, 'Bleeding');
    assert.equal(bleed.stacks, 2);
    assert.equal(bleed.duration, 8);
    const regeneration = packets.find((event) => event.kind === 'regeneration');
    assert.equal(regeneration.duration, 5);
    assert.equal(regeneration.audience.recipients, 'party');
  }

  for (const result of [
    simulate('Core', ['Dodge']),
    simulate('Core', [{ name: 'Dodge', interruptMs: 100 }, wait(1000)], {
      selectedTraitIds: [TRAIT.MARK_OF_EVASION]
    }),
    simulate('Core', ['Dodge', { type: 'combat-start' }], { selectedTraitIds: [TRAIT.MARK_OF_EVASION] })
  ]) {
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some((event) => event.sourceId === TRAIT.MARK_OF_EVASION),
      false
    );
  }
});

// A third dodge must wait for regeneration, and transformed bars still permit the shared action.
test('Necromancer dodge spends endurance and remains usable in shroud and Lich Form', () => {
  const result = simulate('Core', ['Dodge', 'Dodge', 'Dodge']);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[2].start, 10000);
  for (const form of ['Death Shroud', 'Lich Form']) {
    const transformed = simulate('Core', [form, 'Dodge'], { initialResource: 100 });
    assert.deepEqual(transformed.warnings, []);
    assert.ok(transformed.planningState.profession.endurance.value < 100);
  }
});

// A single swarm isolates its resource schedule and trait extension from any saved rotation.
test('Locust Swarm grants life force per impact and Banshee extends the swarm and party swiftness', () => {
  for (const [selectedTraitIds, lifeForce, duration, base] of [
    [[], 15, 15, 117],
    [[TRAIT.BANSHEES_WAIL], 22.5, 22.5, 175]
  ]) {
    const result = simulate('Core', ['Locust Swarm', wait(8000)], { selectedTraitIds });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.lifeForce.value, lifeForce);
    const strikes = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.LOCUST_SWARM
    );
    assert.equal(strikes[0].flatStrikeBase, base);
    assert.equal(strikes[0].flatStrikePowerCoeff, 0.08);
    // The scheduler rounds individual half-second deadlines to its action tick.
    for (let index = 0; index < strikes.length; index++) {
      assert.ok(Math.abs(strikes[index].at - index * 0.5) < 0.04);
    }

    const swiftness = result.resolvedEvents.find((event) => event.kind === 'swiftness');
    assert.equal(swiftness.duration, duration);
    assert.equal(swiftness.audience.recipients, 'party');
    const missed = simulate('Core', [{ name: 'Locust Swarm', offTarget: true }, wait(8000)], { selectedTraitIds });
    assert.equal(missed.planningState.profession.lifeForce.value, 0);
  }

  const clipped = simulate('Core', ['Locust Swarm']);
  assert.equal(clipped.planningState.profession.lifeForce.value, 1.5);
});
