import assert from 'node:assert/strict';
import test from 'node:test';

import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/execution/availability.js';
import {
  createCastDetailContext,
  createMaximumAmmoContext
} from '#gw2/platform/profession-definition/runtime-context.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';

// A selected catalog owns missing-data errors even when a different run has a matching live profile.
test('ammunition profile lookup never borrows content from another context', () => {
  const profile = { id: 'capacity', maximumStacks: 2 };
  const live = createMaximumAmmoContext(() => ({}), new Set([1]), {
    balanceProfilesById: new Map([['capacity', profile]])
  });
  const preview = createMaximumAmmoContext(() => ({}), new Set(), {
    balanceProfilesById: new Map(),
    balanceDataContext: { professionId: 'fixture', patchId: 'preview' }
  });
  assert.equal(live.hasTrait('1'), true);
  assert.equal(preview.hasTrait(1), false);
  assert.equal(live.requireBalanceProfile('capacity'), profile);
  assert.throws(() => preview.requireBalanceProfile('capacity'), /profession=fixture patch=preview.*missing required/);
});

// Capacity transforms share one capability and preserve an intentional zero before later contributors run.
test('maximum ammunition composes ordered transforms including a disabled pool', () => {
  const context = createMaximumAmmoContext(() => ({}), new Set(), {});
  const skill = { id: 1 };
  const calls = [];
  const contribution = (transform) => ({
    maximumAmmo(actualContext, actualSkill, maximum) {
      assert.equal(actualContext, context);
      assert.equal(actualSkill, skill);
      calls.push(maximum);
      return transform(maximum);
    }
  });
  const hooks = composeRuntimeHooks([
    contribution((maximum) => maximum + 1),
    contribution(() => 0),
    contribution(() => undefined),
    contribution((maximum) => maximum + 2)
  ]);
  assert.equal(hooks.maximumAmmo(context, skill, 3), 2);
  assert.deepEqual(calls, [3, 4, 0, 0]);
  assert.equal(composeRuntimeHooks([contribution(() => 0)]).maximumAmmo(context, skill, 3), 0);
});

// Undefined preserves the prior contribution, while even an empty label is an intentional later override.
test('cast detail composition retains declaration order and the last defined label', () => {
  const context = createCastDetailContext(() => ({ variant: 'blade' }));
  const cast = { skill: { id: 1 } };
  const calls = [];
  const contribution = (id, result) => ({
    castDetail(actualContext, actualCast) {
      assert.equal(actualContext, context);
      assert.equal(actualCast, cast);
      calls.push(id);
      return result;
    }
  });
  assert.equal(
    composeRuntimeHooks([
      contribution('core', 'Core'),
      contribution('specialization', 'Sword'),
      contribution('trait', undefined)
    ]).castDetail(context, cast),
    'Sword'
  );
  assert.deepEqual(calls, ['core', 'specialization', 'trait']);
  assert.equal(
    composeRuntimeHooks([contribution('core', 'Core'), contribution('trait', '')]).castDetail(context, cast),
    ''
  );
  // Without contributors the slot is omitted, so callers observe no label.
  assert.equal(composeRuntimeHooks([{}]).castDetail?.(context, cast), undefined);
});

// Every callback category has a distinct contract; the composer must preserve more than field presence.
test('composition preserves notification order, transforms, suppression, and reaction updates', () => {
  const calls = [];
  const hooks = composeRuntimeHooks([
    {
      onCastStart: () => calls.push('first'),
      rechargeWork: (_context, _skill, work) => work + 2,
      prepareEvent: (_context, event) => ({ ...event, selected: true }),
      reactions: { 'damage.resolving': () => ({ coefficient: 2 }) }
    },
    {
      onCastStart: () => calls.push('second'),
      rechargeWork: (_context, _skill, work) => work * 3,
      prepareEvent: (_context, event) => (event.selected ? null : event),
      reactions: { 'damage.resolving': (_context, event) => ({ flatStrikeMultiplier: event.coefficient * 3 }) }
    },
    {
      prepareEvent: () => {
        throw new Error('Suppressed events cannot reach later preparation.');
      }
    }
  ]);
  hooks.onCastStart({}, {});
  assert.deepEqual(calls, ['first', 'second']);
  assert.equal(hooks.rechargeWork({}, {}, 4), 18);
  assert.equal(hooks.prepareEvent({}, { type: 'damage', at: 0 }), null);
  assert.deepEqual(hooks.reactions['damage.resolving']({}, { coefficient: 1 }, {}), {
    coefficient: 2,
    flatStrikeMultiplier: 6
  });
});

test('composition preserves retry boundaries, permanent denials, and exclusive policy precedence', () => {
  const retry = (retryAt) => ({ ready: false, retryAt, reason: 'wait', code: 'wait' });
  const denial = { ready: false, retryAt: null, reason: 'denied', code: 'denied' };
  // Complete policies let this test exercise precedence after resource declaration validation.
  const endurance = (maximum) => {
    const state = createResourceClock(maximum);
    return { state: () => state, maximum: () => maximum, regenerationRate: () => 0 };
  };

  const early = { availability: () => retry(2), endurance: endurance(10), playerAlacrityRechargeRate: 1.2 };
  const late = { availability: () => retry(5), endurance: endurance(20), playerAlacrityRechargeRate: 1.5 };
  const hooks = composeRuntimeHooks([late, early]);
  assert.equal(hooks.availability({ time: 0 }, {}, {}).retryAt, 5);
  assert.equal(hooks.endurance, early.endurance);
  assert.equal(hooks.playerAlacrityRechargeRate, 1.2);
  assert.equal(
    composeRuntimeHooks([early, { availability: () => denial }, late]).availability({ time: 0 }, {}, {}),
    denial
  );
});

// Retry deadlines and explanations have separate precedence; ready hooks cannot clear an earlier denial.
test('availability composition preserves the latest deadline, last denial, and current-time floor', () => {
  const early = retryCast(3, 'early', 'Early gate');
  const late = retryCast(7, 'late', 'Late gate');
  for (const [time, results, expected] of [
    [2, [late, CAST_READY, early, undefined], { ...early, retryAt: 7 }],
    [2, [early, late], late],
    [10, [late, early], { ...early, retryAt: 10 }],
    [10, [early, CAST_READY], { ...early, retryAt: 10 }],
    [2, [late, retryCast(7, 'tie', 'Tied gate')], retryCast(7, 'tie', 'Tied gate')],
    [2, [undefined, CAST_READY], CAST_READY]
  ]) {
    const hooks = composeRuntimeHooks(results.map((result) => ({ availability: () => result })));
    assert.deepEqual(hooks.availability({ time }, {}, {}), expected);
  }
});

// Permanent rejection stops evaluation even when an earlier gate requested a retry.
test('availability composition stops at the first permanent denial', () => {
  const denial = denyCast('denied', 'Cannot cast');
  for (const results of [[denial], [retryCast(7, 'wait', 'Wait'), denial]]) {
    const calls = [];
    const hooks = composeRuntimeHooks([
      ...results.map((result, index) => ({
        availability: () => {
          calls.push(index);
          return result;
        }
      })),
      { availability: () => assert.fail('Later availability gates must not execute.') }
    ]);
    assert.equal(hooks.availability({ time: 2 }, {}, {}), denial);
    assert.deepEqual(
      calls,
      results.map((_, index) => index)
    );
  }
});

test('named owners and unsupported fields fail instead of silently replacing or dropping behavior', () => {
  for (const key of ['tasks', 'eventHandlers', 'sideEffectHandlers']) {
    assert.throws(
      () => composeRuntimeHooks([{ [key]: { duplicate() {} } }, { [key]: { duplicate() {} } }]),
      /Duplicate hook/
    );
  }

  assert.throws(() => composeRuntimeHooks([{ futureHook() {} }]), /Unsupported runtime hook futureHook/);
  assert.throws(
    () =>
      composeRuntimeHooks([
        { effectOwner: () => ({ id: 'first', generation: 1 }) },
        { effectOwner: () => ({ id: 'second', generation: 1 }) }
      ]).effectOwner({}, {}),
    /Conflicting effect lifetime owners/
  );
});

// Contributor count and nesting are layout choices; a callback's result must not depend on either.
test('callbacks combine identically for one, many, and nested contributions and are omitted when absent', () => {
  const noChange = {
    maximumAmmo: () => undefined,
    castDetail: () => null,
    effectOwner: () => null,
    availability: () => undefined,
    onCastStart: () => 'ignored'
  };
  const layouts = [
    composeRuntimeHooks([noChange]),
    composeRuntimeHooks([noChange, {}]),
    composeRuntimeHooks([noChange, noChange]),
    composeRuntimeHooks([composeRuntimeHooks([noChange])]),
    composeRuntimeHooks([composeRuntimeHooks([noChange]), composeRuntimeHooks([{}])])
  ];
  for (const hooks of layouts) {
    assert.equal(hooks.maximumAmmo({}, {}, 3), 3);
    assert.equal(hooks.castDetail({}, {}), undefined);
    assert.equal(hooks.effectOwner({}, {}), undefined);
    assert.deepEqual(hooks.availability({ time: 0 }, {}, {}), { ready: true });
    assert.equal(hooks.onCastStart({}, {}), undefined);
  }

  const empty = composeRuntimeHooks([composeRuntimeHooks([{}]), {}]);
  for (const key of ['maximumAmmo', 'castDetail', 'effectOwner', 'availability', 'onCastStart', 'prepareEvent'])
    assert.equal(key in empty, false, key);
});

test('declarative collections survive mechanic composition before native expansion', () => {
  const first = { traitTriggers: [{}], rechargeRules: [{}], backgroundTasks: ['first'], damageEffects: [{}] };
  const second = { traitTriggers: [{}], rechargeRules: [{}], backgroundTasks: ['second'], damageEffects: [{}] };
  const composed = composeRuntimeHooks([first, second]);
  for (const key of ['traitTriggers', 'rechargeRules', 'backgroundTasks', 'damageEffects'])
    assert.deepEqual(composed[key], [...first[key], ...second[key]]);
});
