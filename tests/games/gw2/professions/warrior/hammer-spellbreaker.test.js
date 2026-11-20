import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorCatalog, warriorProfession } from '#gw2/professions/warrior/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const baseConfig = Object.freeze({
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 0,
    ferocity: 500,
    conditionDamage: 0,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    health: 4_000_000,
    defiant: false,
    conditions: {}
  },
  boons: { quickness: true }
});

const simulate = createObservedProfessionSimulator(warriorProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

function strike(skillId) {
  return warriorCatalog.skillsById.get(skillId).effects.find((effect) => effect.type === 'strike');
}

// Combo finishers determine interaction with active fields independently of packet calibration.
test('hammer skills expose their combo finishers', () => {
  assert.equal(strike(ID.STAGGERING_BLOW).comboFinishers[0].finisherType, 'Whirl');
  assert.equal(strike(ID.EARTHSHAKER).comboFinishers[0].finisherType, 'Blast');
  assert.equal(strike(ID.RUPTURING_SMASH).comboFinishers[0].finisherType, 'Blast');
});

test('Backbreaker resets Fierce Blow and hammer control triggers Defense traits', () => {
  const fierceStrike = (defiant) =>
    simulate('Core', ['Fierce Blow'], {
      primaryWeapon: 'Hammer',
      target: { defiant }
    }).resolvedEvents.find((event) => event.type === 'damage');

  const ordinary = fierceStrike(false);
  const defiant = fierceStrike(true);
  assert.equal(defiant.coefficient, ordinary.coefficient);
  assert.ok(defiant.damage > ordinary.damage);

  const reset = simulate('Core', ['Fierce Blow', 'Backbreaker', 'Fierce Blow'], { primaryWeapon: 'Hammer' });

  const baseline = simulate('Core', ['Fierce Blow', 'Fierce Blow'], { primaryWeapon: 'Hammer' });
  const secondFierce = (result) => result.steps.filter(({ skillName }) => skillName === 'Fierce Blow')[1].start;
  assert.ok(secondFierce(reset) < secondFierce(baseline));

  const defense = simulate(
    'Spellbreaker',
    [{ type: 'cast', skillId: 14387 }, '__cooldown_reset', { type: 'cast', skillId: 14387 }],
    {
      primaryWeapon: 'Hammer',
      initialResource: 20,
      selectedTraitIds: [TRAIT.CULL_THE_WEAK, TRAIT.MERCILESS_HAMMER],
      target: { defiant: true }
    }
  );
  const weaknesses = defense.events.filter((event) => event.sourceId === TRAIT.CULL_THE_WEAK);

  assert.equal(weaknesses.length, 1);
  assert.equal(weaknesses[0].condition, 'Weakness');
  // Reset fills the 20-point pool; the next burst spends 10, then control grants 7 and its hit grants 1.
  assert.equal(defense.planningState.profession[STATE.ADRENALINE].value, 18);
});

test("Spellbreaker only gains Attacker's Insight from control and lightning leap combos", () => {
  const insightConfig = {
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT]
  };
  const insightStacks = (result) => result.planningState.profession[STATE.ATTACKER_INSIGHT_EXPIRIES].length;

  const breaching = simulate('Spellbreaker', [69297], {
    ...insightConfig,
    primaryWeapon: 'Dagger',
    initialResource: 10,
    target: {}
  });

  assert.equal(insightStacks(breaching), 0);

  const breachingCombo = simulate('Spellbreaker', [ID.WINDS_OF_DISENCHANTMENT, 69297], {
    ...insightConfig,
    primaryWeapon: 'Dagger',
    initialResource: 10,
    target: {}
  });

  assert.equal(insightStacks(breachingCombo), 1);
  assert.equal(
    breachingCombo.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Breaching Strike' &&
        event.fieldType === 'Lightning' &&
        event.finisherType === 'Leap' &&
        event.outcome.name === 'Dazing Strike'
    ).length,
    1
  );

  const boonlessWinds = simulate(
    'Spellbreaker',
    [ID.WINDS_OF_DISENCHANTMENT],
    {
      ...insightConfig,
      target: {}
    },
    observationTail(5000)
  );
  assert.equal(insightStacks(boonlessWinds), 0);

  const breakEnchantments = simulate('Spellbreaker', [ID.BREAK_ENCHANTMENTS], {
    ...insightConfig,
    target: {}
  });

  assert.equal(insightStacks(breakEnchantments), 0);

  const bullsCharge = simulate('Spellbreaker', [ID.BULLS_CHARGE], {
    ...insightConfig,
    target: { defiant: true }
  });

  assert.equal(insightStacks(bullsCharge), 1);

  const bullsChargeCombo = simulate('Spellbreaker', [ID.WINDS_OF_DISENCHANTMENT, ID.BULLS_CHARGE], {
    ...insightConfig,
    target: { defiant: true }
  });

  assert.equal(insightStacks(bullsChargeCombo), 2);
  assert.equal(
    bullsChargeCombo.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === "Bull's Charge" &&
        event.fieldType === 'Lightning' &&
        event.finisherType === 'Leap' &&
        event.outcome.kind === 'control' &&
        event.outcome.name === 'Dazing Strike'
    ).length,
    1
  );

  assert.deepEqual(
    [
      warriorCatalog.skillsById.get(ID.WINDS_OF_DISENCHANTMENT).comboFields[0].fieldType,
      warriorCatalog.skillsById.get(ID.WINDS_OF_DISENCHANTMENT).comboFields[0].duration,
      warriorCatalog.skillsById.get(ID.BREACHING_STRIKE).comboFinishers[0].finisherType,
      warriorCatalog.skillsById.get(ID.BULLS_CHARGE).comboFinishers[0].finisherType
    ],
    ['Lightning', 5, 'Leap', 'Leap']
  );
});

test('"To the Limit!" restores endurance, grants flow, and triggers Thick Skin', () => {
  const core = simulate('Core', ['Dodge', '"To the Limit!"'], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.THICK_SKIN]
  });

  assert.equal(core.planningState.profession[STATE.ADRENALINE].value, 30);
  assert.equal(core.planningState.profession[STATE.ENDURANCE].value, 100);
  const protection = core.events.find((event) => event.sourceId === TRAIT.THICK_SKIN);

  assert.deepEqual({ boon: protection.kind, duration: protection.duration }, { boon: 'protection', duration: 3 });

  const bladesworn = simulate('Bladesworn', ['"To the Limit!"'], {
    initialResource: 0
  });

  assert.ok(bladesworn.planningState.profession[STATE.FLOW].value >= 30);
});
