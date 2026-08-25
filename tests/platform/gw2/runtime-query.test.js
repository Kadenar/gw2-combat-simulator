import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeBoonStacks,
  boonActive,
  eventSkill,
  hasSelectedSkill,
  playerHealthFraction,
  selectedSkillNames,
  targetConditionCount,
  targetHealthFraction,
  vulnerabilityStacks
} from '../../../js/platform/gw2/combat/query/runtime-query.js';

function context(overrides = {}) {
  return {
    time: 5,
    config: {},
    ...overrides
  };
}

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
      context({ config: { target: { health: 100 } }, runtime: { totals: { strike: 30, condition: 20 } } })
    ),
    0.5
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
      context({ runtime: { boons: new Map([['fury', [{ at: 0, expiresAt: 10, stacks: 1, affectsSelf: false }]]]) } }),
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
