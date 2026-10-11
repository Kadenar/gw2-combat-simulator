import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

// Explicit combat inputs isolate field, burst, and observation contracts from saved benchmark equipment.
function simulate(rotation, overrides = {}) {
  const config = {
    specialization: 'Berserker',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Torch',
    initialResource: 30,
    selectedTraitIds: [],
    attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, conditionDamage: 0 }),
    target: { armor: 2597 },
    ...overrides
  };
  return runGw2Runtime({ profession: warriorProfession.runtimeFor(config), config, rotation });
}

test('Warrior leaps retain fire fields that expire during travel', () => {
  // A leap binds its field at launch, so a field that expires in flight still grants the aura on landing.
  for (const leap of ['Savage Leap', 'Sundering Leap']) {
    const result = simulate(['Flames of War', { type: 'wait', durationMs: 4600 }, leap], {
      selectedSkillIds: [ID.SUNDERING_LEAP],
      selectedTraitIds: [TRAIT.KING_OF_FIRES]
    });
    const aura = result.resolvedEvents.find((event) => event.type === 'aura' && event.skillName === leap);
    const field = result.events.find((event) => event.type === 'combo_field');
    assert.deepEqual(result.warnings, []);
    assert.ok(aura);
    assert.ok(aura.at > field.expiresAt);
    if (leap === 'Sundering Leap') {
      assert.ok(result.procSteps.some((proc) => proc.skill === 'King of Fires' && proc.sourceSkill === leap));
    }
  }
});

test('Combustive Shot captures its adrenaline tier and scales the field lifetime', () => {
  for (const tier of [1, 2, 3]) {
    const result = simulate(['Combustive Shot'], {
      primaryWeapon: 'Longbow',
      secondaryWeapon: '',
      initialResource: tier * 10
    });
    assert.deepEqual(result.warnings, []);
    const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.COMBUSTIVE_SHOT);
    assert.equal(
      result.events.find((event) => event.type === 'damage' && event.skillId === ID.COMBUSTIVE_SHOT).metadata
        .warriorBurstTier,
      tier
    );
    assert.equal(action.comboFields[0].duration, tier * 3);
  }
});

test('a primal-burst critical hit grants an aura that detonates no earlier than cast completion', () => {
  const result = simulate(['__combat_start', 'Berserk', 'Scorched Earth', { type: 'wait', durationMs: 2500 }], {
    primaryWeapon: 'Longbow',
    secondaryWeapon: '',
    selectedTraitIds: [TRAIT.KING_OF_FIRES],
    attributeInputs: baseAttributeInputs({ power: 1000, precision: 5000 }),
    target: { armor: 2597, health: 100_000_000 }
  });
  assert.deepEqual(result.warnings, []);
  const criticalHit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.SCORCHED_EARTH && event.didCrit
  );
  const kingProc = result.procSteps.find((proc) => proc.type === 'trait_proc' && proc.skill === 'King of Fires');
  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.SCORCHED_EARTH);
  assert.equal(kingProc.start, Math.round(Math.max(action.endsAt, criticalHit.at) * 1000));
  assert.equal(kingProc.sourceSkill, 'Scorched Earth');
});

test('a final persistent Berserker packet does not extend the rotation horizon', () => {
  const result = simulate(['__combat_start', 'Flames of War'], {
    selectedTraitIds: [TRAIT.KING_OF_FIRES],
    target: { armor: 2597, health: 1000 }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillId === ID.FLAMES_OF_WAR);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.rotationEndTime, action.endsAt);
  assert.equal(result.planningState.atSeconds, result.rotationEndTime);
  assert.equal(result.deathTime, null);
  assert.ok(result.events.every((event) => event.at <= result.rotationEndTime));
  assert.ok(result.resolvedEvents.every((event) => event.at <= result.rotationEndTime));
  assert.equal(
    result.procSteps.some((proc) => proc.type === 'trait_proc' && proc.skill === 'King of Fires'),
    false
  );
});
