import assert from 'node:assert/strict';
import { test } from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { SHARED_STATE_IDS as STATE } from '#gw2/platform/results/state-ids.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const simulate = createObservedProfessionSimulator(revenantProfession, {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  primaryWeapon: 'Scepter',
  secondaryWeapon: 'Sword',
  boons: { quickness: true },
  attributeInputs: baseAttributeInputs({ power: 2000 }),
  target: { armor: 2597 }
});
const tail = { kind: 'tail', durationMs: 6000 };
const auraDamage = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.BLOSSOMING_AURA);
// Reached tiers scale the final strike through a captured factor, never by rewriting its authored coefficient.
const auraEffects = revenantCatalog.skillsById.get(ID.BLOSSOMING_AURA).effects;
const pulseCoefficient = auraEffects.find((effect) => effect.name === 'Pulsing Damage').ticks[0].coefficient;
const finalEffect = auraEffects.find((effect) => effect.name === 'Final Damage');
const finalFactor = (tier) => 1 + tier * finalEffect.damageIncreasePerStack;
const finalRatio = (tier) => (finalFactor(tier) * finalEffect.coefficient) / pulseCoefficient;

test('Enemy Attraction requires a mature tether and releases it with vulnerability and control', () => {
  // Follow-ups own the active tether; the pull consumes it and starts the parent recharge.
  const inactive = simulate('Core', ['Otherworldly Attraction (enemy)']);
  assert.ok(inactive.warnings.some(({ message: warning }) => warning.includes('unavailable')));
  const early = simulate('Core', ['Otherworldly Bond', 'Otherworldly Attraction (enemy)']);
  assert.ok(early.warnings.some(({ message: warning }) => warning.includes('unavailable')));
  const result = simulate('Core', [
    'Otherworldly Bond',
    { type: 'wait', durationMs: 4000 },
    'Otherworldly Attraction (enemy)'
  ]);
  assert.deepEqual(result.warnings, []);
  const effects = result.events.filter((event) => event.skillId === ID.OTHERWORLDLY_ATTRACTION_ENEMY);
  assert.ok(
    effects.some(
      (event) =>
        event.type === 'condition' && event.condition === 'Vulnerability' && event.stacks === 6 && event.duration === 10
    )
  );
  assert.ok(effects.some((event) => event.type === 'control' && event.controlKind === 'pull'));
  assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.OTHERWORLDLY_ATTRACTION_ENEMY], undefined);
  assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.DEACTIVATE_OTHERWORLDLY_BOND], undefined);
  assert.ok(result.planningState.cooldownsBySkillId[ID.OTHERWORLDLY_BOND].remainingMs > 0);
});

test('Tether cancellation, expiry and weapon swap close follow-ups and start recharge', () => {
  // Every release path must sever the pending pull, including one that never matured.
  for (const ending of [
    [{ type: 'wait', durationMs: 1000 }, 'Deactivate Otherworldly Bond'],
    [{ type: 'wait', durationMs: 7000 }],
    ['Swap Weapons']
  ]) {
    const result = simulate('Core', ['Otherworldly Bond', ...ending], { weaponSet2Primary: 'Staff' });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.OTHERWORLDLY_ATTRACTION_ENEMY], undefined);
    assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.DEACTIVATE_OTHERWORLDLY_BOND], undefined);
    assert.ok(result.planningState.cooldownsBySkillId[ID.OTHERWORLDLY_BOND].remainingMs > 0);
  }
});

test('Blossoming Aura keeps a fixed fuse after attachment regardless of cast speed', () => {
  // The lasting effect's cadence and cooldown are independent of the initial casting animation.
  for (const quickness of [false, true]) {
    const result = simulate('Core', ['Blossoming Aura'], { boons: { quickness } }, tail);
    const damage = auraDamage(result);
    assert.deepEqual(result.warnings, []);
    // Natural expiry detonates at the tier its last pulse reached.
    const tier = damage.filter((event) => event.name === 'Pulsing Damage').length - 1;
    assert.equal(damage.at(-1).coefficient, finalEffect.coefficient);
    assert.equal(damage.at(-1).metadata.revenantBlossomingAuraDamageFactor, finalFactor(tier));
    assertFlooredDamageMultiplier(damage.at(-1).damage, damage[0].damage, finalRatio(tier));
    assert.equal(result.planningState.cooldownsBySkillId[ID.BLOSSOMING_AURA].readyAtMs, 6400);
    assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.DETONATE_BLOSSOMING_AURA], undefined);
  }
});

test('Manual Aura detonation uses the reached tier and cancels future pulses without restarting cooldown', () => {
  for (let tier = 0; tier < 4; tier += 1) {
    const result = simulate(
      'Core',
      ['Blossoming Aura', { type: 'wait', durationMs: tier * 1000 }, 'Detonate Blossoming Aura'],
      {},
      tail
    );
    const damage = auraDamage(result);
    assert.deepEqual(result.warnings, []);
    assert.equal(damage.filter((event) => event.name === 'Pulsing Damage').length, tier + 1);
    const final = damage.find((event) => event.name === 'Final Damage');
    assert.equal(final.coefficient, finalEffect.coefficient);
    assert.equal(final.metadata.revenantBlossomingAuraDamageFactor, finalFactor(tier));
    assertFlooredDamageMultiplier(final.damage, damage[0].damage, finalRatio(tier));
    assert.equal(result.planningState.cooldownsBySkillId[ID.BLOSSOMING_AURA].readyAtMs, 6400);
    assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.DETONATE_BLOSSOMING_AURA], undefined);
  }
});

test('Aura stays attached and remains manually detonatable across a legend swap', () => {
  const result = simulate('Core', ['Blossoming Aura', 'Swap Legends', 'Detonate Blossoming Aura'], {}, tail);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    auraDamage(result).map((event) => event.name),
    ['Pulsing Damage', 'Final Damage']
  );
  assert.equal(result.planningState.cooldownsBySkillId[ID.BLOSSOMING_AURA].readyAtMs, 6400);
});

// Finisher classification determines whether the skill can interact with a combo field.
test('Rejuvenating Assault owns a whirl finisher', () => {
  assert.ok(
    revenantCatalog.skillsById
      .get(ID.REJUVENATING_ASSAULT)
      .comboFinishers.some((finisher) => finisher.finisherType === 'Whirl')
  );
});
