import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createModifierHooks } from '#gw2/platform/combat/modifiers.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { normalizeSkillEffects } from '#gw2/platform/effects/validation.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const bonus = (id, factor) => ({ id, label: id, target: 'strikeDamage', operation: 'multiply', factor });
const strike = (modifiers) => ({ type: 'strike', coefficient: 1, ...(modifiers ? { modifiers } : {}) });
const skill = (id, modifiers = [], effects = [strike()]) => ({ id, name: `Skill ${id}`, modifiers, effects });
const moduleFor = (skills, modifiers) =>
  defineNativeModule({
    id: 'Core',
    data: { extraSkills: skills },
    state: { create: () => ({}) },
    modifiers
  });

// Materialize real packets so ownership survives serialization and never depends on a display name or effect index.
function packet(owner, effect, baseEvent = {}) {
  return JSON.parse(
    JSON.stringify(
      materializeSkillEffectApplications({
        skill: owner,
        effect,
        start: 0,
        fullEnd: 1,
        baseEvent: { skillId: owner.id, ...baseEvent }
      })[0].event
    )
  );
}

test('skill and effect bonuses use shared buckets while excluding sibling effects and other skills', () => {
  const owner = skill(1, [bonus('whole-skill', 2)], [strike(), strike([bonus('one-effect', 1.5)])]);
  const core = moduleFor([owner, skill(2)], {
    modifierRules: [
      {
        id: 'shared-additive',
        target: 'strikeDamage',
        operation: 'damage-additive',
        amount: 0.1
      }
    ]
  });
  const hooks = createModifierHooks({ rules: core.modifiers.modifierRules });
  const damageContributors = [];
  const enhanced = packet(owner, owner.effects[1]);
  assert.ok(Math.abs(hooks.modifyStrikeDamage({ event: enhanced, damageContributors }, 100) - 330) < 1e-10);
  assert.deepEqual(
    damageContributors.map(({ id }) => id),
    ['shared-additive', 'whole-skill', 'one-effect']
  );
  assert.ok(Math.abs(hooks.modifyStrikeDamage({ event: packet(owner, owner.effects[0]) }, 100) - 220) < 1e-10);
  assert.ok(Math.abs(hooks.modifyStrikeDamage({ event: { ...enhanced, skillId: 2 } }, 100) - 110) < 1e-10);
  // Reusing another packet as attribution must not transfer its effect-specific bonuses.
  const sibling = packet(owner, owner.effects[0], enhanced);
  assert.equal(sibling.effectModifierIds, undefined);
  assert.ok(Math.abs(hooks.modifyStrikeDamage({ event: sibling }, 100) - 220) < 1e-10);
  assert.ok(Math.abs(hooks.modifyStrikeDamage({ event: { ...enhanced, name: 'Renamed' } }, 100) - 330) < 1e-10);
});

test('native composition registers intrinsic rules once with the custom compiler and reads impact-time state', () => {
  let compilations = 0;
  const core = moduleFor(
    [
      skill(1, [
        {
          ...bonus('dynamic', 1),
          parameters: { perStack: 0.1 },
          factor: (context, _target, parameters) => 1 + context.runtime.stacks * parameters.perStack,
          when: (context) => context.runtime.enabled
        }
      ])
    ],
    {
      compileModifierRules(rules) {
        compilations += 1;
        return createModifierHooks({ rules });
      }
    }
  );
  const family = defineNativeProfession({ id: 'modifier-fixture', name: 'Modifier fixture', modules: [core] });
  const runtime = family.runtimeFor({});
  assert.equal(family.runtimeFor({}), runtime);
  assert.equal(compilations, 1);
  const hooks = createModifierHooks({ rules: core.modifiers.modifierRules });
  const context = { event: { skillId: 1 }, runtime: { stacks: 2, enabled: true } };
  assert.equal(hooks.modifyStrikeDamage(context, 100), 120);
  context.runtime.stacks = 5;
  assert.equal(hooks.modifyStrikeDamage(context, 100), 150);
  context.runtime.enabled = false;
  assert.equal(hooks.modifyStrikeDamage(context, 100), 100);
});

test('catalog validation rejects malformed intrinsic modifiers and registration rejects duplicate identities', () => {
  for (const declaration of [
    { ...bonus('bad', 1), target: 'attributePower' },
    { ...bonus('bad', 1), typo: true },
    bonus('bad', NaN),
    { ...bonus('bad', 1), when: true },
    { ...bonus('bad', 1), operation: 'add' }
  ]) {
    assert.throws(() => createCanonicalCatalog({ generated: [skill(1, [declaration])] }), /modifier|Modifier/);
    assert.throws(() => normalizeSkillEffects([strike([declaration])]), /modifier|Modifier/);
  }

  assert.throws(
    () =>
      normalizeSkillEffects([
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 1,
          duration: 1,
          modifiers: [bonus('bad', 1.5)]
        }
      ]),
    /strike effect/
  );
  const core = moduleFor([skill(1, [bonus('duplicate', 2)]), skill(2, [], [strike([bonus('duplicate', 2)])])]);
  assert.throws(
    () => defineNativeProfession({ id: 'duplicate', name: 'Duplicate', modules: [core] }),
    /Duplicate modifier rule/
  );
});

test('an effect bonus survives reordering but disappears when the effect declares no bonus', () => {
  const boosted = strike([bonus('effect', 1.5)]);
  const owner = skill(1, [], [strike(), boosted]);
  const hooks = createModifierHooks({ rules: moduleFor([owner]).modifiers.modifierRules });
  const reordered = { ...owner, effects: [boosted, strike()] };
  assert.equal(hooks.modifyStrikeDamage({ event: packet(reordered, reordered.effects[0]) }, 100), 150);
  assert.equal(hooks.modifyStrikeDamage({ event: packet(reordered, { ...boosted, modifiers: [] }) }, 100), 100);
});

test('effect ownership reaches damage resolution without multiplying a sibling strike', () => {
  // Exercise emission, scheduling, and damage resolution together rather than only invoking the modifier hook.
  const owner = skill(
    1,
    [],
    [
      { ...strike(), name: 'Initial', weaponStrength: 1000 },
      { ...strike([bonus('aftershock', 1.5)]), name: 'Aftershock', weaponStrength: 1000 }
    ]
  );
  const profession = defineNativeProfession({
    id: 'impact-fixture',
    name: 'Impact fixture',
    modules: [moduleFor([owner])]
  });
  const result = createProfessionSimulator(profession)([{ type: 'cast', skillId: 1 }], {
    attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, ferocity: 0 }),
    target: { armor: 1000, conditions: {} }
  });
  assert.deepEqual(result.warnings, []);
  const initial = result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Initial');
  const aftershock = result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Aftershock');
  assertFlooredDamageMultiplier(aftershock.damage, initial.damage, 1.5);
});
