import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Isolate the damage multiplier from the trait's Expertise conversion and from native skill schedules.
test('Strength of Shadows multiplies other damage bonuses for Torment without boosting Poison', () => {
  const sample = (selected, condition, actorType) =>
    runThief(
      [{ type: 'wait', durationMs: 2000 }],
      {
        specialization: 'Specter',
        selectedTraitIds: [TRAIT.LEAD_ATTACKS, ...(selected ? [TRAIT.STRENGTH_OF_SHADOWS] : [])],
        attributeInputs: baseAttributeInputs({ conditionDamage: 1000, vitality: 0 }),
        target: { armor: 2597, conditions: {} }
      },
      {
        initialize(runtime) {
          runtime.profession.core.leadAttackExpirations = Array(15).fill(10);
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              at: 0,
              kind: 'distracting-throw',
              duration: 10,
              stacks: 1,
              actorType: 'player',
              source: 'fixture',
              sourceId: 'fixture.bonus'
            }
          });
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at: 0.1,
              condition,
              duration: 1,
              stacks: 1,
              actorType,
              name: `${actorType} ${condition}`,
              source: 'fixture',
              sourceId: 'fixture.condition'
            }
          });
        }
      }
    );
  for (const [condition, actorType] of [
    ['Torment', 'player'],
    ['Poisoned', 'player']
  ]) {
    const name = `${actorType} ${condition}`;
    const baseline = sample(false, condition, actorType);
    const selected = sample(true, condition, actorType);
    assert.deepEqual(selected.warnings, []);
    const damage = (result) => result.resolvedEvents.find((event) => event.name === name).damage;
    assertFlooredDamageMultiplier(damage(selected), damage(baseline), name === 'player Torment' ? 1.2 : 1);
  }
});

// Life siphon uses flat Power scaling; armor and critical chance affect the separate weapon strike only.
test('Vampiric Slash siphon uses 1410 plus 0.2 Power and its vulnerable-target bonus', () => {
  for (const power of [1000, 2800])
    for (const vulnerable of [false, true]) {
      const result = runThief(
        [ID.VAMPIRIC_SLASH],
        {
          primaryWeapon: 'Spear',
          attributeInputs: baseAttributeInputs({ power, precision: 5000, ferocity: 1500 }),
          target: { armor: 6000, conditions: { Vulnerability: vulnerable ? 25 : 0 } }
        },
        {
          initialize(runtime) {
            runtime.profession.core.spearChainStage = 1;
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const siphon = result.resolvedEvents.find((event) => event.damageKind === 'life-steal');
      assert.equal(siphon.damage, Math.floor((1410 + 0.2 * power) * (vulnerable ? 1.5 : 1)));
      assert.equal(siphon.critEligible, false);
    }
});
