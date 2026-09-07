import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import {
  activeBoonStacks,
  boonActive,
  eventSkill,
  hasSelectedSkill,
  playerHealthFraction,
  selectedSkillNames,
  targetConditionActive,
  targetConditionCount,
  targetHealthFraction,
  vulnerabilityStacks
} from '#gw2/platform/combat/query/runtime-query.js';

function context(overrides = {}) {
  return {
    time: 5,
    config: {},
    ...overrides
  };
}

test('additive damage uses the live weapon set before and after a same-time swap', () => {
  const hit = { type: 'strike', at: 5 };
  const swap = { type: 'weapon_set', at: 5, weaponSet: 2 };
  const query = createGw2CombatQuery({
    profession: {
      id: 'test',
      ...createModifierHooks({
        rules: [
          {
            id: 'test.additive',
            target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
            operation: 'damage-additive',
            amount: 0.2
          }
        ]
      })
    },
    config: {
      sigilSets: [
        { strike: 1.05, condition: 1.1 },
        { strike: 1, condition: 1 }
      ]
    },
    events: [hit, swap]
  });
  const runtime = { activeWeaponSet: 1 };

  // The hit must remove the same sigil factor that the base multiplier used.
  assert.equal(query.strikeMultiplier(hit, hit.at, runtime), 1.25);
  assert.equal(query.conditionMultiplier('Burning', hit.at, hit, runtime), 1.3);
  runtime.activeWeaponSet = swap.weaponSet;
  assert.equal(query.strikeMultiplier(hit, hit.at, runtime), 1.2);
  assert.equal(query.conditionMultiplier('Burning', hit.at, hit, runtime), 1.2);
  assert.equal(query.strikeMultiplier(hit, hit.at), 1.2);
  assert.equal(query.conditionMultiplier('Burning', hit.at, hit), 1.2);
});

test('boon-dependent damage sees same-time buffs only after their live application', () => {
  const hit = { type: 'strike', at: 5 };
  const buff = {
    type: 'buff',
    kind: 'fury',
    at: 5,
    duration: 5,
    resolvedAudience: { includesSelf: true }
  };
  const query = createGw2CombatQuery({
    profession: {
      id: 'test',
      ...createModifierHooks({
        rules: [
          {
            id: 'test.fury',
            target: MODIFIER_TARGET.STRIKE_DAMAGE,
            operation: 'multiply',
            factor: 1.1,
            when: (current) => boonActive(current, 'fury')
          }
        ]
      })
    },
    events: [hit, buff]
  });
  const runtime = { boons: new Map() };

  // A completed timeline contains the buff even while the live hit precedes it.
  assert.equal(query.strikeMultiplier(hit, hit.at, runtime), 1);
  assert.equal(query.strikeMultiplier(hit, hit.at, {}), 1);
  assert.equal(query.strikeMultiplier(hit, hit.at), 1.1);
  assert.equal(boonActive(context({ runtime, config: { boons: { fury: true } } }), 'fury'), true);
  runtime.boons.set('fury', [{ ...buff, expiresAt: 10 }]);
  assert.equal(query.strikeMultiplier(hit, hit.at, runtime), 1.1);
  assert.equal(query.strikeMultiplier(hit, 10, runtime), 1);
});

test('live boon presence respects duration pools, audience, and application windows', () => {
  const applications = [0, 1].map((at) => ({
    at,
    duration: 3,
    expiresAt: at + 3,
    resolvedAudience: { includesSelf: true }
  }));
  const modifierContext = context({
    runtime: {
      boons: new Map([
        ['fury', applications],
        ['might', applications]
      ])
    }
  });

  // Duration stacks remain active after individual expiry times; intensity stacks do not.
  assert.equal(boonActive(modifierContext, 'fury'), true);
  assert.equal(boonActive({ ...modifierContext, time: 6 }, 'fury'), false);
  assert.equal(boonActive(modifierContext, 'might'), false);
  assert.equal(boonActive({ ...modifierContext, time: -1 }, 'might'), false);
  assert.equal(boonActive({ ...modifierContext, time: 0 }, 'might'), true);
  applications[1].resolvedAudience.includesSelf = false;
  assert.equal(boonActive(modifierContext, 'fury'), false);
});

test('runtime skill lookup preserves event, application, and context fallback precedence', () => {
  const skillsById = new Map([
    [1, { id: 1, name: 'Event' }],
    [2, { id: 2, name: 'Application' }],
    [3, { id: 3, name: 'Context' }]
  ]);
  const profession = { catalog: { skillsById } };

  assert.equal(
    eventSkill(context({ profession, event: { skillId: 1, application: { skillId: 2 } }, skillId: 3 })).id,
    1
  );
  assert.equal(eventSkill(context({ profession, event: { application: { skillId: 2 } }, skillId: 3 })).id, 2);
  assert.equal(eventSkill(context({ profession, event: {}, skillId: 3 })).id, 3);
  assert.equal(eventSkill(context({ profession, event: { skillId: 99 } })), undefined);
  assert.equal(eventSkill(context({ event: { skillId: 1 } })), undefined);
});

test('selected skill queries normalize arrays, slot records, and embedded skill objects', () => {
  const arrayContext = context({ config: { selectedSkills: ['One', { id: 2, name: 'Two' }] } });
  const recordContext = context({ config: { selectedSkills: { Heal: 'Three', Utility1: { id: 4, name: 'Four' } } } });

  assert.deepEqual([...selectedSkillNames(arrayContext)], ['One', 'Two']);
  assert.deepEqual([...selectedSkillNames(recordContext)], ['Three', 'Four']);
  assert.equal(hasSelectedSkill(recordContext, 'Four'), true);
  assert.equal(hasSelectedSkill(recordContext, 'Missing'), false);
});

test('health fractions preserve explicit precedence and dynamic damage fallback', () => {
  assert.equal(
    targetHealthFraction(context({ config: { targetHealthFraction: 1.4, target: { healthFraction: 0.2 } } })),
    1
  );
  assert.equal(targetHealthFraction(context({ config: { target: { healthFraction: 0.2, health: 100 } } })), 0.2);
  assert.equal(
    targetHealthFraction(
      context({
        config: { target: { health: 100 } },
        runtime: { totals: { strike: 30, condition: 20 }, environmentDamage: 10 }
      })
    ),
    0.4
  );
  assert.equal(
    targetHealthFraction(
      context({
        config: { target: { health: 100, startingHealthFraction: 0.49 } },
        runtime: { totals: { strike: 9, condition: 0 } }
      })
    ),
    0.4
  );
  assert.equal(targetHealthFraction(context()), 1);
  assert.equal(playerHealthFraction(context({ config: { playerHealthFraction: -0.2 } })), 0);
  assert.equal(playerHealthFraction(context({ config: { playerHealthFraction: 1.2 } })), 1);
});

test('boon queries retain configured stacks and prefer live applications over scheduler state', () => {
  const schedulerApplication = { at: 0, expiresAt: 10, stacks: 4 };
  const runtimeApplication = { at: 0, expiresAt: 10, stacks: 2 };
  const modifierContext = context({
    config: { boons: { might: 3 } },
    state: { boons: new Map([['might', [schedulerApplication]]]) },
    runtime: { boons: new Map([['might', [runtimeApplication]]]) }
  });

  assert.equal(activeBoonStacks(modifierContext, 'might'), 5);
  assert.equal(boonActive(modifierContext, 'might'), true);
  assert.equal(
    boonActive(
      context({
        runtime: {
          boons: new Map([
            [
              'fury',
              [
                {
                  at: 0,
                  expiresAt: 10,
                  stacks: 1,
                  resolvedAudience: {
                    includesSelf: false,
                    includesSummons: true,
                    alliedPlayerCount: 0,
                    companionIds: ['summon:one'],
                    recipientCount: 1
                  }
                }
              ]
            ]
          ])
        }
      }),
      'fury'
    ),
    false
  );
  assert.equal(boonActive(context({ timeline: { timedActive: (kind) => kind === 'vigor' } }), 'vigor'), true);
});

test('target condition and vulnerability queries use canonical combat-query facts', () => {
  const active = new Set(['Bleeding', 'Vulnerability', 'Custom']);
  const modifierContext = context({
    config: { target: { conditions: { bleeding: true, Custom: true } } },
    runtime: { conditionState: new Map([['Vulnerability', { stacks: [] }]]) },
    query: {
      targetHasCondition: (condition) => active.has(condition),
      targetConditionStacks: (condition) => (condition === 'Vulnerability' ? 12 : 0)
    }
  });

  assert.equal(targetConditionCount(modifierContext), 3);
  assert.equal(vulnerabilityStacks(modifierContext), 12);
});

test('target condition activity prefers the query adapter and falls back to canonical target state', () => {
  const configured = context({ config: { target: { conditions: { burn: true } } } });
  const runtime = context({
    runtime: {
      conditionState: new Map([['Weakness', { stacks: [{ appliedAt: 0, expiresAt: 10, weight: 1 }] }]])
    }
  });

  assert.equal(targetConditionActive(configured, 'Burning'), true);
  assert.equal(targetConditionActive(runtime, 'Weakness'), true);
  assert.equal(targetConditionActive({ ...configured, query: { targetHasCondition: () => false } }, 'Burning'), false);
  assert.equal(targetConditionActive(context(), 'Burning'), false);
});
