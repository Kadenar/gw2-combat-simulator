import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const simulate = createObservedProfessionSimulator(warriorProfession, {
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1000,
    conditionDamage: 1000,
    expertise: 0,
    concentration: 0
  }),
  target: { armor: 2597, health: 10000000, conditions: {} }
});

// Heal activation grants self boons at full health; other skills and an unselected trait grant nothing.
test('Restorative Strength grants five Might and Resistance for six seconds on healing skills', () => {
  for (const [specialization, skill] of [
    ['Core', 'Mending'],
    ['Berserker', 'Blood Reckoning'],
    ['Core', 'Kick']
  ]) {
    for (const selected of [false, true]) {
      const result = simulate(specialization, [skill], {
        selectedSkillIds: [warriorProfession.catalog.skillsByName.get(skill).id],
        selectedTraitIds: selected ? [TRAIT.RESTORATIVE_STRENGTH] : []
      });
      assert.deepEqual(result.warnings, []);
      const boons = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.RESTORATIVE_STRENGTH);
      assert.deepEqual(
        boons.map((event) => [event.kind, event.stacks, event.duration]),
        selected && skill !== 'Kick'
          ? [
              ['might', 5, 6],
              ['resistance', 1, 6]
            ]
          : []
      );
      for (const boon of boons) {
        assert.equal(boon.at, result.steps[0].start / 1000);
        assert.equal(boon.audience.recipients, 'self');
        assert.equal(boon.resolvedAudience.includesSelf, true);
      }
    }
  }
});

// The damage multiplier belongs only to Fierce Shot, not every rifle or longbow attack.
test('Crack Shot increases Fierce Shot strike damage by ten percent', () => {
  for (const [primaryWeapon, skill, factor] of [
    ['Rifle', 'Fierce Shot', 1.1],
    ['Rifle', 'Explosive Shell', 1],
    ['Longbow', 'Dual Shot', 1]
  ]) {
    const base = simulate('Core', [skill], { primaryWeapon, selectedTraitIds: [] });
    const enhanced = simulate('Core', [skill], { primaryWeapon, selectedTraitIds: [TRAIT.CRACK_SHOT] });
    assert.deepEqual(base.warnings, []);
    assert.deepEqual(enhanced.warnings, []);
    assert.ok(base.strikeDamage > 0);
    assertFlooredDamageMultiplier(enhanced.strikeDamage, base.strikeDamage, factor);
  }
});

// Each arrow applies its own one-second Burning at impact; condition ticks must not retrigger it.
test('Crack Shot applies one Burning per Dual Shot arrow only while selected', () => {
  for (const selected of [false, true]) {
    const result = simulate('Core', ['Dual Shot', { type: 'wait', durationMs: 2000 }], {
      primaryWeapon: 'Longbow',
      selectedTraitIds: selected ? [TRAIT.CRACK_SHOT] : []
    });
    assert.deepEqual(result.warnings, []);
    const arrows = result.events.filter((event) => event.type === 'damage' && event.skillId === ID.DUAL_SHOT);
    const burning = result.events.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.CRACK_SHOT);
    assert.equal(arrows.length, 2);
    assert.deepEqual(
      burning.map((event) => [event.at, event.condition, event.stacks, event.duration]),
      selected ? arrows.map((event) => [event.at, 'Burning', 1, 1]) : []
    );
    assert.equal(result.conditionDamage > 0, selected);
  }
});
