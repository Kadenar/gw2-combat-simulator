import assert from 'node:assert/strict';
import test from 'node:test';

import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { recordBuffApplication } from '#gw2/platform/combat/state/boons.js';
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

test('configured duration stacks bypass history and retain output caps without changing additive buffs', () => {
  // Fixed duration presence needs no live or scheduler history, but additive buffs still include active stacks.
  const boons = new Proxy(new Map(), { get: () => assert.fail('Configured duration boons must not read history') });
  for (const stateKey of ['runtime', 'state']) {
    for (const permanent of [true, 3]) {
      const current = context({ config: { boons: { vigor: permanent } }, [stateKey]: { boons } });
      for (const maximum of [0, 0.5, 1, 25]) {
        assert.equal(activeBoonStacks(current, 'vigor', maximum), Math.min(1, maximum));
      }
    }
  }

  for (const kind of ['might', 'stability', 'custom']) {
    const current = context({
      config: { boons: { [kind]: 3 } },
      runtime: {
        boons: new Map([[kind, [{ at: 0, expiresAt: 10, stacks: 2, resolvedAudience: { includesSelf: true } }]]])
      }
    });
    assert.equal(activeBoonStacks(current, kind), 5);
    assert.equal(activeBoonStacks(current, kind, 4), 4);
    assert.equal(activeBoonStacks({ ...current, time: 10 }, kind), 3);
  }
});

// Stack queries must agree with accumulated duration even after every original packet has expired.
test('duration boon stacks use capped presence in live and scheduler state', () => {
  for (const kind of ['fury', 'vigor', 'swiftness', 'protection', 'alacrity', 'quickness']) {
    const boons = new Map();
    for (const at of [0, 1]) {
      recordBuffApplication(boons, {
        type: 'buff',
        kind,
        at,
        duration: 5,
        stacks: 1,
        resolvedAudience: { includesSelf: true }
      });
    }

    for (const stateKey of ['runtime', 'state']) {
      const current = context({ [stateKey]: { boons } });
      assert.equal(activeBoonStacks({ ...current, time: -1 }, kind), 0);
      assert.equal(activeBoonStacks({ ...current, time: 1 }, kind), 1);
      assert.equal(activeBoonStacks({ ...current, time: 7 }, kind), 1);
      assert.equal(activeBoonStacks({ ...current, time: 10 }, kind), 0);
      assert.equal(activeBoonStacks({ ...current, time: 7 }, kind, 0), 0);
      assert.equal(activeBoonStacks({ ...current, config: { boons: { [kind]: true } } }, kind), 1);
      assert.equal(activeBoonStacks({ ...current, time: 100, config: { boons: { [kind]: 3 } } }, kind), 1);
    }

    const cap = kind === 'swiftness' ? 60 : 30;
    recordBuffApplication(boons, {
      type: 'buff',
      kind,
      at: 2,
      duration: 100,
      stacks: 1,
      resolvedAudience: { includesSelf: true }
    });
    assert.equal(activeBoonStacks(context({ time: 2 + cap - 1, runtime: { boons } }), kind), 1);
    assert.equal(activeBoonStacks(context({ time: 2 + cap, runtime: { boons } }), kind), 0);
  }
});

test('player boon stacks exclude summon copies in live and scheduler state', () => {
  // Copied packets must neither extend player Fury nor double player intensity stacks.
  for (const kind of ['fury', 'might', 'custom']) {
    const stacks = kind === 'fury' ? 1 : 3;
    const boons = new Map();
    for (const includesSelf of [true, false]) {
      recordBuffApplication(boons, {
        type: 'buff',
        kind,
        at: 0,
        duration: 5,
        stacks,
        resolvedAudience: { includesSelf, includesSummons: !includesSelf, companionIds: ['engineer.mech'] }
      });
    }

    for (const stateKey of ['runtime', 'state']) {
      const current = context({ time: 1, [stateKey]: { boons } });
      assert.equal(activeBoonStacks(current, kind), stacks);
      assert.equal(activeBoonStacks({ ...current, time: 6 }, kind), 0);
    }
  }
});

test('duration stack queries retain player audience filtering and live insertion order', () => {
  const state = {
    boons: new Map([['fury', [{ at: 0, expiresAt: 10, stacks: 1, resolvedAudience: { includesSelf: true } }]]])
  };
  const runtime = { boons: new Map() };
  const current = context({ time: 0, state, runtime });
  assert.equal(activeBoonStacks(current, 'fury'), 0);
  runtime.boons.set('fury', [{ at: 0, expiresAt: 10, stacks: 1, resolvedAudience: { includesSelf: false } }]);
  assert.equal(activeBoonStacks(current, 'fury'), 0);
  assert.equal(boonActive(current, 'fury'), false);
  runtime.boons.get('fury').push({ at: 0, expiresAt: 10, stacks: 1, resolvedAudience: { includesSelf: true } });
  assert.equal(activeBoonStacks(current, 'fury'), 1);
  assert.equal(boonActive(current, 'fury'), true);
  runtime.boons.set('custom', [
    { at: 0, expiresAt: 10, stacks: 3, resolvedAudience: { includesSelf: true } },
    { at: 0, expiresAt: 10, stacks: 2, resolvedAudience: { includesSelf: true } }
  ]);
  assert.equal(activeBoonStacks(current, 'custom'), 5);
  assert.equal(activeBoonStacks({ ...current, time: 10 }, 'custom'), 0);
});

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
  const schedulerApplication = { at: 0, expiresAt: 10, stacks: 4, resolvedAudience: { includesSelf: true } };
  const runtimeApplication = { at: 0, expiresAt: 10, stacks: 2, resolvedAudience: { includesSelf: true } };
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
