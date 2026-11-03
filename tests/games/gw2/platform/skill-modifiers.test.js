import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
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
    data: { skills: skills },
    state: { create: () => ({}) },
    modifiers
  });

// References and damage contributors receive canonical skill names, preserving deliberate rule-specific labels.
test('skill-owned modifier labels follow their owner unless explicitly named', () => {
  const unnamed = { id: 'internal-rule-id', target: 'strikeDamage', operation: 'multiply', factor: 1.2 };
  const owner = skill(1, [unnamed], [strike([{ ...unnamed, id: 'internal-effect-id' }, bonus('named', 1.1)])]);
  const core = moduleFor([owner]);
  const rules = core.modifiers.modifierRules;
  assert.deepEqual(
    rules.map((rule) => rule.label),
    ['Skill 1', 'Skill 1', 'named']
  );
  const damageContributors = [];
  createModifierHooks({ rules }).modifyStrikeDamage(
    { event: packet(owner, owner.effects[0]), damageContributors },
    100
  );
  assert.deepEqual(
    damageContributors.map((entry) => entry.label),
    ['Skill 1', 'Skill 1', 'named']
  );
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

// Intrinsic rules share the selected evaluator and sample live state at impact.
test('native composition shares intrinsic rules with queries and reads impact-time state', () => {
  const core = moduleFor([
    skill(1, [
      {
        ...bonus('dynamic', 1),
        parameters: { perStack: 0.1 },
        factor: (context, _target, parameters) => 1 + context.runtime.stacks * parameters.perStack,
        when: (context) => context.runtime.enabled
      }
    ])
  ]);
  const family = defineNativeProfession({ id: 'modifier-fixture', name: 'Modifier fixture', modules: [core] });
  const runtime = family.runtimeFor({});
  assert.equal(family.runtimeFor({}), runtime);
  const hooks = family.resolveProfession({});
  assert.equal(hooks.modifyStrikeDamage, runtime.modifyStrikeDamage);
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
    { ...bonus('bad', 1), id: ' ' },
    { ...bonus('bad', 1), label: ' ' },
    { ...bonus('bad', 1), parameters: { bonus: NaN }, factor: () => 1 },
    { ...bonus('bad', 1), order: Infinity },
    bonus('bad', NaN),
    { ...bonus('bad', 1), operation: 'add' },
    { ...bonus('bad', 1), target: 'criticalDamage', operation: 'damage-additive', amount: 0.1 }
  ]) {
    assert.throws(() => createCanonicalCatalog({ skills: [skill(1, [declaration])] }), /modifier|Modifier/);
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
    /invalid for a condition effect/
  );
  const core = moduleFor([skill(1, [bonus('duplicate', 2)]), skill(2, [], [strike([bonus('duplicate', 2)])])]);
  assert.throws(
    () => defineNativeProfession({ id: 'duplicate', name: 'Duplicate', modules: [core] }),
    /Duplicate modifier rule/
  );
});

// Rebuilt catalogs revalidate current declarations while earlier catalogs retain their detached balance data.
test('skill modifier validation preserves snapshots and rejects invalid rebuilt declarations', () => {
  let factor = 1.5;
  const declaration = {
    ...bonus('live', 1),
    parameters: { bonus: 0.1 },
    factor: (_context, _target, parameters) => factor + parameters.bonus
  };
  const owner = skill(1, [declaration]);
  const catalog = createCanonicalCatalog({ skills: [owner] });
  const core = moduleFor([owner]);
  const family = defineNativeProfession({ id: 'rebuild', name: 'Rebuild', modules: [core] });
  const compiled = family.runtimeFor({});
  const context = { event: { skillId: 1 } };
  assert.equal(compiled.modifyStrikeDamage(context, 10), 16);

  declaration.parameters.bonus = NaN;
  assert.throws(() => createCanonicalCatalog({ skills: [owner] }), /parameter bonus must be a finite number/);
  assert.throws(() => moduleFor([owner]), /parameter bonus must be a finite number/);
  assert.equal(catalog.skills[0].modifiers[0].parameters.bonus, 0.1);
  assert.equal(compiled.modifyStrikeDamage(context, 10), 16);

  // Static validation retains executable numeric callbacks, whose results are checked during combat evaluation.
  factor = NaN;
  assert.throws(() => compiled.modifyStrikeDamage(context, 10), /factor must resolve to a non-negative finite number/);
});

test('critical modifiers preserve scalar ordering, predicates, and skill/effect ownership', () => {
  // Multiplication follows the shared addition, while a packet-specific addition excludes sibling effects.
  const owner = skill(
    1,
    [{ ...bonus('critical-multiply', 2), target: 'criticalDamage', order: 1, when: (context) => context.enabled }],
    [strike(), strike([{ id: 'critical-add', target: 'criticalDamage', operation: 'add', amount: 0.25, order: 2 }])]
  );
  const core = moduleFor([owner, skill(2)], {
    modifierRules: [{ id: 'shared-critical-add', target: 'criticalDamage', operation: 'add', amount: 0.5, order: 0 }]
  });
  const hooks = createModifierHooks({ rules: core.modifiers.modifierRules });
  const context = { enabled: true, event: packet(owner, owner.effects[1]) };
  assert.equal(hooks.modifyCriticalDamage(context, 1.5), 4.25);
  assert.equal(hooks.modifyCriticalDamage({ ...context, enabled: false }, 1.5), 2.25);
  assert.equal(hooks.modifyCriticalDamage({ ...context, event: packet(owner, owner.effects[0]) }, 1.5), 4);
  assert.equal(hooks.modifyCriticalDamage({ ...context, event: { ...context.event, skillId: 2 } }, 1.5), 2);
  assert.equal(hooks.modifyStrikeDamage?.(context, 100) ?? 100, 100);
});

test('skill critical modifiers affect only the critical contribution during damage resolution', () => {
  // Critical chance weights only the enhanced critical contribution; normal damage stays unchanged.
  const owner = skill(
    1,
    [{ ...bonus('critical', 2), target: 'criticalDamage' }],
    [{ ...strike(), weaponStrength: 1000 }]
  );
  const other = skill(2, [], [{ ...strike(), weaponStrength: 1000 }]);
  const profession = defineNativeProfession({
    id: 'critical-fixture',
    name: 'Critical fixture',
    modules: [moduleFor([owner, other])]
  });
  for (const [precision, multiplier] of [
    [895, 1],
    [1000, 1.1 / 1.025],
    [4000, 2]
  ]) {
    const result = createProfessionSimulator(profession)(
      [
        { type: 'cast', skillId: 1 },
        { type: 'cast', skillId: 2 }
      ],
      {
        attributeInputs: baseAttributeInputs({ power: 1000, precision, ferocity: 0 }),
        target: { armor: 1000, conditions: {} }
      }
    );
    assert.deepEqual(result.warnings, []);
    const hit = (id) => result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === id);
    assertFlooredDamageMultiplier(hit(1).damage, hit(2).damage, multiplier);
  }
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

// Base-duration rules use the same ordered evaluator without affecting ordinary duration or damage hooks.
test('base-duration modifiers preserve live predicates, scalar order, and packet ownership', () => {
  const owner = skill(
    1,
    [
      {
        id: 'skill-duration',
        target: 'conditionBaseDuration',
        operation: 'multiply',
        order: 1,
        parameters: { perStack: 0.5 },
        factor: (context, _target, parameters) => 1 + context.runtime.stacks * parameters.perStack,
        when: (context) => context.condition === 'Bleeding'
      }
    ],
    [
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2 },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 2,
        modifiers: [
          {
            id: 'effect-duration',
            target: 'conditionBaseDuration',
            operation: 'add',
            amount: 0.25,
            order: 2
          }
        ]
      }
    ]
  );
  const core = moduleFor([owner, skill(2)], {
    modifierRules: [
      {
        id: 'shared-duration',
        target: 'conditionBaseDuration',
        operation: 'add',
        amount: 0.5,
        order: 0
      }
    ]
  });
  const profession = defineNativeProfession({ id: 'duration-hooks', name: 'Duration hooks', modules: [core] });
  const hooks = profession.runtimeFor({});
  const context = { condition: 'Bleeding', runtime: { stacks: 2 }, event: packet(owner, owner.effects[1]) };
  assert.equal(hooks.modifyConditionBaseDuration(context, 1), 3.25);
  context.runtime.stacks = 0;
  assert.equal(hooks.modifyConditionBaseDuration(context, 1), 1.75);
  context.runtime.stacks = 2;
  assert.equal(hooks.modifyConditionBaseDuration({ ...context, condition: 'Poisoned' }, 1), 1.75);
  const sibling = packet(owner, owner.effects[0], context.event);
  assert.equal(sibling.effectModifierIds, undefined);
  assert.equal(hooks.modifyConditionBaseDuration({ ...context, event: sibling }, 1), 3);
  assert.equal(hooks.modifyConditionBaseDuration({ ...context, event: { ...context.event, skillId: 2 } }, 1), 1.5);
  assert.equal(hooks.modifyConditionDuration?.(context, 1) ?? 1, 1);
  assert.equal(hooks.modifyStrikeDamage?.(context, 100) ?? 100, 100);
});

test('base-duration declarations reject invalid operations, factors, and effect targets', () => {
  const duration = { id: 'duration', target: 'conditionBaseDuration', operation: 'multiply', factor: 1.5 };
  const condition = { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2 };
  for (const rule of [
    { ...duration, operation: 'damage-additive', amount: 0.5 },
    { ...duration, factor: -1 },
    { ...duration, factor: Infinity }
  ]) {
    assert.throws(() => createCanonicalCatalog({ skills: [skill(1, [rule])] }), /modifier|Modifier/);
    assert.throws(() => normalizeSkillEffects([{ ...condition, modifiers: [rule] }]), /modifier|Modifier/);
  }

  assert.throws(() => normalizeSkillEffects([strike([duration])]), /invalid for a strike effect/);
  assert.throws(() => moduleFor([skill(1, [], [strike([duration])])]), /invalid for a strike effect/);
  assert.throws(
    () => normalizeSkillEffects([{ type: 'buff', kind: 'Test', duration: 1, modifiers: [duration] }]),
    /strike or condition effect/
  );
  const core = moduleFor([skill(1, [duration], [{ ...condition, modifiers: [duration] }])]);
  assert.throws(
    () => defineNativeProfession({ id: 'duplicate-duration', name: 'Duplicate', modules: [core] }),
    /Duplicate modifier rule/
  );
});

// Exercise real condition lifetimes: intrinsic changes precede the capped bonus, while zero suppresses application.
test('intrinsic base duration reaches condition resolution before the ordinary duration cap', () => {
  const condition = { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2 };
  const duration = (id, factor) => ({ id, target: 'conditionBaseDuration', operation: 'multiply', factor });
  const owner = skill(
    1,
    [{ ...duration('skill-duration', 1.5), when: (context) => context.condition === 'Bleeding' }],
    [
      { ...condition, name: 'Plain' },
      { ...condition, name: 'Enhanced', modifiers: [duration('effect-duration', 2)] },
      { ...condition, name: 'Different condition', condition: 'Poisoned' },
      { ...condition, name: 'Suppressed', condition: 'Burning', modifiers: [duration('zero-duration', 0)] }
    ]
  );
  const other = skill(2, [], [{ ...condition, name: 'Other skill' }]);
  const profession = defineNativeProfession({
    id: 'duration-fixture',
    name: 'Duration fixture',
    modules: [moduleFor([owner, other])]
  });
  const result = createProfessionSimulator(profession)(
    [
      { type: 'cast', skillId: 1 },
      { type: 'cast', skillId: 2 },
      { type: 'wait', durationMs: 15000 }
    ],
    {
      attributeInputs: baseAttributeInputs({ expertise: 3000 }),
      target: { armor: 1000, conditions: {} }
    }
  );
  assert.deepEqual(result.warnings, []);
  const applications = result.resolvedEvents.filter((event) => event.type === 'condition');
  for (const [name, duration] of [
    ['Plain', 6],
    ['Enhanced', 12],
    ['Different condition', 4],
    ['Other skill', 4]
  ]) {
    const application = applications.find((event) => event.name === name);
    assert.ok(application, name);
    assert.equal(application.effectiveDuration, duration, name);
    assert.equal(application.naturalExpiresAt - application.at, duration, name);
  }

  assert.equal(
    applications.some((event) => event.name === 'Suppressed'),
    false
  );
});

// Ownership is stable while profession scope delegates activation and audience to the authored predicate.
test('profession-scoped skill rules affect other skills only while their predicate is active', () => {
  const core = moduleFor([
    skill(1, [
      bonus('implicit-skill', 2),
      { ...bonus('explicit-skill', 2), scope: 'skill' },
      { ...bonus('profession-strike', 1.5), scope: 'profession', when: (context) => context.runtime.active },
      {
        ...bonus('profession-critical', 2),
        scope: 'profession',
        target: 'criticalDamage',
        when: (context) => context.runtime.active && context.event?.actorType === 'player'
      },
      {
        ...bonus('profession-duration', 2),
        scope: 'profession',
        target: 'conditionBaseDuration',
        when: (context) => context.runtime.active && context.condition === 'Bleeding'
      }
    ]),
    skill(2)
  ]);
  const profession = defineNativeProfession({ id: 'scope-fixture', name: 'Scope fixture', modules: [core] });
  const hooks = profession.runtimeFor({});
  const context = { event: { skillId: 2, actorType: 'player' }, runtime: { active: false }, condition: 'Bleeding' };
  assert.equal(hooks.modifyStrikeDamage(context, 100), 100);
  context.runtime.active = true;
  assert.equal(hooks.modifyStrikeDamage(context, 100), 150);
  assert.equal(hooks.modifyStrikeDamage({ ...context, event: { skillId: 1 } }, 100), 600);
  assert.equal(hooks.modifyCriticalDamage(context, 1.5), 3);
  assert.equal(hooks.modifyConditionBaseDuration(context, 1), 2);
  assert.equal(hooks.modifyConditionBaseDuration({ ...context, condition: 'Burning' }, 1), 1);
  // Profession scope adds no implicit player filter; only the critical rule declares one here.
  const summon = { ...context, event: { skillId: 2, actorType: 'summon' } };
  assert.equal(hooks.modifyStrikeDamage(summon, 100), 150);
  assert.equal(hooks.modifyCriticalDamage(summon, 1.5), 1.5);
  context.runtime.active = false;
  assert.equal(hooks.modifyStrikeDamage(context, 100), 100);
  assert.equal(hooks.modifyCriticalDamage(context, 1.5), 1.5);
  assert.equal(hooks.modifyConditionBaseDuration(context, 1), 1);
  for (const rule of core.modifiers.modifierRules) {
    assert.equal(rule.sourceSkillId, 1);
    assert.equal(Object.hasOwn(rule, 'scope'), false);
  }
});

test('skill scope validation rejects unknown scopes and profession-scoped effect declarations', () => {
  for (const scope of ['global', null, 1]) {
    assert.throws(
      () => createCanonicalCatalog({ skills: [skill(1, [{ ...bonus('invalid-scope', 2), scope }])] }),
      /invalid skill modifier/
    );
  }

  for (const effect of [
    strike([{ ...bonus('effect-scope', 2), scope: 'profession' }]),
    {
      type: 'condition',
      condition: 'Bleeding',
      stacks: 1,
      duration: 2,
      modifiers: [{ ...bonus('effect-scope', 2), target: 'conditionBaseDuration', scope: 'profession' }]
    }
  ]) {
    assert.throws(() => normalizeSkillEffects([effect]), /cannot use profession scope on an effect/);
    assert.throws(() => moduleFor([skill(1, [], [effect])]), /cannot use profession scope on an effect/);
  }

  const owner = skill(1, [], [strike([{ ...bonus('explicit-effect', 2), scope: 'skill' }]), strike()]);
  const hooks = createModifierHooks({ rules: moduleFor([owner]).modifiers.modifierRules });
  assert.equal(hooks.modifyStrikeDamage({ event: packet(owner, owner.effects[0]) }, 100), 200);
  assert.equal(hooks.modifyStrikeDamage({ event: packet(owner, owner.effects[1]) }, 100), 100);
});

// New targets retain the same owner scoping and live activation as existing damage and base-duration rules.
test('condition damage, duration, and critical chance support profession scope and shared arithmetic', () => {
  for (const [target, hook, operation, input, expected] of [
    ['conditionDamage', 'modifyConditionDamage', 'damage-additive', 100, 150],
    ['conditionDuration', 'modifyConditionDuration', 'add', 1, 1.5],
    ['criticalChance', 'modifyCriticalChance', 'add', 0.1, 0.6]
  ]) {
    const core = moduleFor([
      skill(1, [
        { id: target, target, operation, amount: 0.5, scope: 'profession', when: (context) => context.enabled }
      ])
    ]);
    const hooks = createModifierHooks({ rules: core.modifiers.modifierRules });
    const context = { event: { skillId: 2 }, enabled: true };
    assert.equal(hooks[hook](context, input), expected);
    assert.equal(hooks[hook]({ ...context, enabled: false }, input), input);
  }
});

test('new skill targets reject incompatible operations and effect packet types', () => {
  for (const target of ['conditionDamage', 'conditionDuration', 'criticalChance']) {
    const rule = { ...bonus('new-target', 2), target };
    const invalidOperation = {
      ...rule,
      operation: target === 'conditionDamage' ? 'add' : 'damage-additive',
      amount: 0.5
    };
    assert.throws(() => createCanonicalCatalog({ skills: [skill(1, [invalidOperation])] }), /modifier|Modifier/);
    const wrongEffect =
      target === 'criticalChance'
        ? { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2, modifiers: [rule] }
        : strike([rule]);
    assert.throws(() => normalizeSkillEffects([wrongEffect]), /invalid for a .* effect/);
    assert.throws(() => moduleFor([skill(1, [], [wrongEffect])]), /invalid for a .* effect/);
  }
});

// Condition ticks must retain the declaring effect's identity without transferring its bonus to sibling applications.
test('condition damage combines additive bonuses and effect multipliers during resolution', () => {
  const condition = { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 };
  const owner = skill(
    1,
    [{ id: 'skill-condition-add', target: 'conditionDamage', operation: 'damage-additive', amount: 0.25 }],
    [
      { ...condition, name: 'Plain' },
      {
        ...condition,
        name: 'Enhanced',
        modifiers: [{ ...bonus('effect-condition-multiply', 2), target: 'conditionDamage' }]
      }
    ]
  );
  const other = skill(2, [], [{ ...condition, name: 'Other skill' }]);
  const profession = defineNativeProfession({
    id: 'condition-damage-fixture',
    name: 'Condition damage fixture',
    modules: [
      moduleFor([owner, other], {
        modifierRules: [
          { id: 'shared-condition-add', target: 'conditionDamage', operation: 'damage-additive', amount: 0.25 }
        ]
      })
    ]
  });
  const result = createProfessionSimulator(profession)(
    [
      { type: 'cast', skillId: 1 },
      { type: 'cast', skillId: 2 },
      { type: 'wait', durationMs: 5000 }
    ],
    {
      attributeInputs: baseAttributeInputs({ conditionDamage: 900, expertise: 0 }),
      target: { armor: 1000, conditions: {} }
    }
  );
  assert.deepEqual(result.warnings, []);
  for (const [name, factor] of [
    ['Plain', 1.5],
    ['Enhanced', 3],
    ['Other skill', 1.25]
  ]) {
    const application = result.resolvedEvents.find((event) => event.type === 'condition' && event.name === name);
    const tick = application.damageTicks.find((tick) => tick.fraction === 1);
    // Integral contributions isolate modifier composition from shared owner-packet rounding.
    // Bleeding deals 76 damage per full stack-second at 900 condition damage.
    assert.equal(tick.damage, 76 * factor, name);
  }
});

// Ordinary duration is capped independently; intrinsic base-duration extensions still apply outside that cap.
test('skill and effect condition duration preserve the cap separately from base duration', () => {
  const condition = { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2 };
  const owner = skill(
    1,
    [
      { id: 'skill-duration-add', target: 'conditionDuration', operation: 'add', amount: 0.5 },
      { ...bonus('skill-base-duration', 1.5), target: 'conditionBaseDuration' }
    ],
    [
      { ...condition, name: 'Plain' },
      {
        ...condition,
        name: 'Enhanced',
        modifiers: [{ ...bonus('effect-duration-multiply', 2), target: 'conditionDuration' }]
      }
    ]
  );
  const other = skill(2, [], [{ ...condition, name: 'Other skill' }]);
  const profession = defineNativeProfession({
    id: 'capped-duration-fixture',
    name: 'Capped duration fixture',
    modules: [moduleFor([owner, other])]
  });
  const result = createProfessionSimulator(profession)(
    [
      { type: 'cast', skillId: 1 },
      { type: 'cast', skillId: 2 },
      { type: 'wait', durationMs: 8000 }
    ],
    {
      attributeInputs: baseAttributeInputs({ expertise: 0 }),
      target: { armor: 1000, conditions: {} }
    }
  );
  assert.deepEqual(result.warnings, []);
  for (const [name, duration] of [
    ['Plain', 4.5],
    ['Enhanced', 6],
    ['Other skill', 2]
  ]) {
    const application = result.resolvedEvents.find((event) => event.type === 'condition' && event.name === name);
    assert.equal(application.effectiveDuration, duration, name);
    assert.equal(application.naturalExpiresAt - application.at, duration, name);
  }
});

// Critical chance modifies strike probability, stays with its owner, and is capped by damage resolution.
test('skill and effect critical chance preserve sibling isolation and the probability cap', () => {
  const owner = skill(
    1,
    [{ id: 'skill-critical-add', target: 'criticalChance', operation: 'add', amount: 0.25 }],
    [
      { ...strike(), name: 'Plain', weaponStrength: 1000 },
      {
        ...strike([{ ...bonus('effect-critical-multiply', 8), target: 'criticalChance' }]),
        name: 'Enhanced',
        weaponStrength: 1000
      }
    ]
  );
  const other = skill(2, [], [{ ...strike(), name: 'Other skill', weaponStrength: 1000 }]);
  const profession = defineNativeProfession({
    id: 'critical-chance-fixture',
    name: 'Critical chance fixture',
    modules: [moduleFor([owner, other])]
  });
  const result = createProfessionSimulator(profession)(
    [
      { type: 'cast', skillId: 1 },
      { type: 'cast', skillId: 2 }
    ],
    {
      attributeInputs: baseAttributeInputs({ power: 1000, precision: 895, ferocity: 0 }),
      target: { armor: 1000, conditions: {} }
    }
  );
  assert.deepEqual(result.warnings, []);
  for (const [name, chance] of [
    ['Plain', 0.25],
    ['Enhanced', 1],
    ['Other skill', 0]
  ]) {
    const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.name === name);
    assert.equal(hit.criticalChance, chance, name);
  }
});
