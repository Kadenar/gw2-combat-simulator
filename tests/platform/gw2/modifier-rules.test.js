import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierHooks, MODIFIER_TARGET } from '../../../js/platform/gw2/combat/modifiers/rules.js';

function context({
  sigils = {
    strike: 1.08,
    strikeAdd: 0.08,
    condition: 1.05,
    conditionAdd: 0.05
  },
  active = true
} = {}) {
  return {
    active,
    time: 1,
    timeline: {
      activeSigilSetAt: () => sigils
    }
  };
}

test('modifier rules apply scalar operations in stable order', () => {
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.add-last',
        target: MODIFIER_TARGET.CRITICAL_DAMAGE,
        operation: 'add',
        amount: 2,
        order: 20
      },
      {
        id: 'test.multiply-first',
        target: MODIFIER_TARGET.CRITICAL_DAMAGE,
        operation: 'multiply',
        factor: 3,
        order: 10
      },
      {
        id: 'test.multiply-tie',
        target: MODIFIER_TARGET.CRITICAL_DAMAGE,
        operation: 'multiply',
        factor: 2,
        order: 20
      }
    ]
  });

  assert.equal(hooks.modifyCriticalDamage(context(), 1), 10);
});

test('modifier rules compose declarative attribute targets', () => {
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.power-add',
        target: MODIFIER_TARGET.ATTRIBUTE_POWER,
        operation: 'add',
        amount: 100
      },
      {
        id: 'test.power-multiply',
        target: MODIFIER_TARGET.ATTRIBUTE_POWER,
        operation: 'multiply',
        factor: 1.1
      },
      {
        id: 'test.other-attributes',
        target: [
          MODIFIER_TARGET.ATTRIBUTE_PRECISION,
          MODIFIER_TARGET.ATTRIBUTE_FEROCITY,
          MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE,
          MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
          MODIFIER_TARGET.ATTRIBUTE_VITALITY
        ],
        operation: 'add',
        amount: 25
      }
    ]
  });
  const initial = {
    power: 1000,
    precision: 900,
    ferocity: 500,
    conditionDamage: 700,
    healingPower: 300,
    vitality: 1000
  };

  assert.deepEqual(hooks.modifyAttributes(context(), initial), {
    power: 1210,
    precision: 925,
    ferocity: 525,
    conditionDamage: 725,
    healingPower: 325,
    vitality: 1025
  });
  assert.equal(initial.power, 1000);
});

test('critical chance rules expose their active contributions', () => {
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.named-critical-chance',
        label: 'Named bonus',
        target: MODIFIER_TARGET.CRITICAL_CHANCE,
        operation: 'add',
        amount: 0.15
      },
      {
        id: 'test.dynamic-critical-chance',
        target: MODIFIER_TARGET.CRITICAL_CHANCE,
        operation: 'add',
        amount: 0.2
      }
    ]
  });
  const criticalChanceContributors = [];

  assert.equal(hooks.modifyCriticalChance({ ...context(), criticalChanceContributors }, 0.4), 0.75);
  assert.deepEqual(
    criticalChanceContributors.map(({ id, label }) => ({ id, label })),
    [
      { id: 'test.named-critical-chance', label: 'Named bonus' },
      { id: 'test.dynamic-critical-chance', label: 'Dynamic' }
    ]
  );
  assert.ok(Math.abs(criticalChanceContributors[0].amount - 0.15) < 1e-12);
  assert.ok(Math.abs(criticalChanceContributors[1].amount - 0.2) < 1e-12);
});

test('target arrays and functional amounts resolve for the active target', () => {
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.shared-damage',
        target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
        operation: 'damage-additive',
        amount: (_context, target) => (target === MODIFIER_TARGET.STRIKE_DAMAGE ? 0.1 : 0.2)
      }
    ]
  });

  assert.ok(Math.abs(hooks.modifyStrikeDamage(context(), 1.08) - 1.18) < 1e-12);
  assert.ok(Math.abs(hooks.modifyConditionDamage(context(), 1.05) - 1.25) < 1e-12);
});

test('resolver-backed modifier rules receive frozen named parameters', () => {
  let receivedParameters = null;
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.parameterized',
        target: MODIFIER_TARGET.CRITICAL_CHANCE,
        operation: 'add',
        parameters: { perStack: 0.02 },
        amount: (current, _target, parameters) => {
          receivedParameters = parameters;

          return Number(current.stacks || 0) * parameters.perStack;
        }
      }
    ]
  });

  assert.equal(hooks.modifyCriticalChance({ ...context(), stacks: 3 }, 0.1), 0.16);
  assert.deepEqual(receivedParameters, { perStack: 0.02 });
  assert.equal(Object.isFrozen(receivedParameters), true);
});

test('inactive rules do not call their numeric resolver', () => {
  let calls = 0;
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.inactive',
        target: MODIFIER_TARGET.CRITICAL_CHANCE,
        operation: 'add',
        amount: () => {
          calls += 1;

          return 0.1;
        },
        when: (current) => current.active
      }
    ]
  });

  assert.equal(hooks.modifyCriticalChance(context({ active: false }), 0.5), 0.5);
  assert.equal(calls, 0);
  assert.equal(hooks.modifyCriticalChance(context(), 0.5), 0.6);
  assert.equal(calls, 1);
});

test('damage rules rebuild one additive bucket before multiplication', () => {
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.additive-one',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'damage-additive',
        amount: 0.1
      },
      {
        id: 'test.additive-two',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'damage-additive',
        amount: 0.2
      },
      {
        id: 'test.multiplier',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 1.5
      }
    ]
  });

  assert.ok(Math.abs(hooks.modifyStrikeDamage(context(), 1.08) - 1.38 * 1.5) < 1e-12);
});

test('damage bucket policies can exclude the active sigil', () => {
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.additive',
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'damage-additive',
        amount: 0.1
      }
    ],
    damageBuckets: {
      strikeDamage: {
        includeSigil: (current) => !current.illusion
      }
    }
  });

  assert.ok(Math.abs(hooks.modifyStrikeDamage({ ...context(), illusion: true }, 1.08) - 1.1) < 1e-12);
  assert.ok(Math.abs(hooks.modifyStrikeDamage({ ...context(), illusion: false }, 1.08) - 1.18) < 1e-12);

  const nourysContext = {
    ...context(),
    damageAdditiveBonus: 0.25
  };

  assert.ok(Math.abs(hooks.modifyStrikeDamage({ ...nourysContext, illusion: true }, 1.33) - 1.35) < 1e-12);
  assert.ok(Math.abs(hooks.modifyStrikeDamage({ ...nourysContext, illusion: false }, 1.33) - 1.43) < 1e-12);
});

test('empty modifier sets preserve scalar and coherent damage inputs', () => {
  const hooks = createModifierHooks();

  assert.equal(hooks.modifyCriticalChance(context(), 0.5), 0.5);
  assert.equal(hooks.modifyConditionDuration(context(), 1.25), 1.25);
  assert.equal(hooks.modifyStrikeDamage(context(), 1.08), 1.08);
  assert.equal(hooks.modifyConditionDamage(context(), 1.05), 1.05);
  assert.deepEqual(hooks.modifyAttributes(context(), { power: 1000 }), {
    power: 1000
  });
  assert.equal(Object.isFrozen(hooks), true);
  assert.equal(Object.isFrozen(hooks.modifyStrikeDamage), true);
});

test('scalar modifier hooks leave clamping to their consumer', () => {
  const hooks = createModifierHooks({
    rules: [
      {
        id: 'test.duration',
        target: MODIFIER_TARGET.CONDITION_DURATION,
        operation: 'add',
        amount: 0.25
      }
    ]
  });

  assert.equal(hooks.modifyConditionDuration(context(), 1.9), 2.15);
});

test('modifier declarations reject invalid schemas with the rule id', () => {
  const invalidRules = [
    [{ target: 'criticalChance', operation: 'add', amount: 1 }, /<missing/],
    [{ id: 'bad.target', target: 'unsupported', operation: 'add', amount: 1 }, /bad\.target/],
    [
      {
        id: 'bad.targets',
        target: [],
        operation: 'add',
        amount: 1
      },
      /bad\.targets/
    ],
    [
      {
        id: 'bad.operation',
        target: 'criticalChance',
        operation: 'divide',
        amount: 1
      },
      /bad\.operation/
    ],
    [{ id: 'bad.amount', target: 'criticalChance', operation: 'add' }, /bad\.amount/],
    [
      {
        id: 'bad.factor',
        target: 'criticalDamage',
        operation: 'multiply',
        factor: 0
      },
      /bad\.factor/
    ],
    [
      {
        id: 'bad.damage-additive',
        target: 'criticalChance',
        operation: 'damage-additive',
        amount: 0.1
      },
      /bad\.damage-additive/
    ],
    [
      {
        id: 'bad.damage-add',
        target: 'strikeDamage',
        operation: 'add',
        amount: 0.1
      },
      /bad\.damage-add/
    ],
    [
      {
        id: 'bad.when',
        target: 'criticalChance',
        operation: 'add',
        amount: 0.1,
        when: true
      },
      /bad\.when/
    ],
    [
      {
        id: 'bad.order',
        target: 'criticalChance',
        operation: 'add',
        amount: 0.1,
        order: Number.NaN
      },
      /bad\.order/
    ],
    [
      {
        id: 'bad.numeric-string',
        target: 'criticalChance',
        operation: 'add',
        amount: '0.1'
      },
      /bad\.numeric-string/
    ],
    [
      {
        id: 'bad.parameters',
        target: 'criticalChance',
        operation: 'add',
        parameters: { value: Number.NaN },
        amount: () => 0.1
      },
      /bad\.parameters/
    ],
    [
      {
        id: 'bad.static-parameters',
        target: 'criticalChance',
        operation: 'add',
        parameters: { value: 0.1 },
        amount: 0.1
      },
      /bad\.static-parameters/
    ]
  ];

  for (const [rule, pattern] of invalidRules) {
    assert.throws(() => createModifierHooks({ rules: [rule] }), pattern);
  }

  assert.throws(
    () =>
      createModifierHooks({
        rules: [
          {
            id: 'bad.duplicate',
            target: 'criticalChance',
            operation: 'add',
            amount: 0.1
          },
          {
            id: 'bad.duplicate',
            target: 'criticalDamage',
            operation: 'add',
            amount: 0.1
          }
        ]
      }),
    /bad\.duplicate/
  );
});

test('modifier declarations and resolvers reject invalid runtime values', () => {
  assert.throws(
    () =>
      createModifierHooks({
        rules: [
          {
            id: 'bad.static',
            target: 'criticalChance',
            operation: 'add',
            amount: Number.POSITIVE_INFINITY
          }
        ]
      }),
    /bad\.static/
  );

  const amountHooks = createModifierHooks({
    rules: [
      {
        id: 'bad.runtime-amount',
        target: 'criticalChance',
        operation: 'add',
        amount: () => Number.NaN
      }
    ]
  });

  assert.throws(() => amountHooks.modifyCriticalChance(context(), 0), /bad\.runtime-amount/);

  const amountTypeHooks = createModifierHooks({
    rules: [
      {
        id: 'bad.runtime-amount-type',
        target: 'criticalChance',
        operation: 'add',
        amount: () => '0.1'
      }
    ]
  });

  assert.throws(() => amountTypeHooks.modifyCriticalChance(context(), 0), /bad\.runtime-amount-type/);

  const factorHooks = createModifierHooks({
    rules: [
      {
        id: 'bad.runtime-factor',
        target: 'criticalDamage',
        operation: 'multiply',
        factor: () => 0
      }
    ]
  });

  assert.throws(() => factorHooks.modifyCriticalDamage(context(), 1), /bad\.runtime-factor/);
});

test('modifier bucket policies reject unsupported declarations and results', () => {
  assert.throws(
    () =>
      createModifierHooks({
        damageBuckets: { criticalChance: { includeSigil: true } }
      }),
    /criticalChance/
  );
  assert.throws(
    () =>
      createModifierHooks({
        damageBuckets: { strikeDamage: { includeSigil: 'yes' } }
      }),
    /strikeDamage/
  );

  const hooks = createModifierHooks({
    damageBuckets: {
      strikeDamage: { includeSigil: () => 'yes' }
    }
  });

  assert.throws(() => hooks.modifyStrikeDamage(context(), 1.08), /strikeDamage/);
});
