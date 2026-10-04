import assert from 'node:assert/strict';
import test from 'node:test';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  createCastDetailContext,
  createMaximumAmmoContext
} from '#gw2/platform/profession-definition/runtime-context.js';

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
  assert.equal(composeRuntimeHooks([{}]).castDetail(context, cast), undefined);
});

// Every callback category has a distinct contract; the composer must preserve more than field presence.
test('composition preserves notification order, transforms, suppression, and reaction updates', () => {
  const calls = [];
  const hooks = composeRuntimeHooks([
    {
      onCastStart: () => calls.push('first'),
      rechargeWork: (_context, _skill, work) => work + 2,
      prepareEvent: (_context, event) => ({ ...event, selected: true }),
      reactions: { 'damage.resolved': () => ({ first: true }) }
    },
    {
      onCastStart: () => calls.push('second'),
      rechargeWork: (_context, _skill, work) => work * 3,
      prepareEvent: (_context, event) => (event.selected ? null : event),
      reactions: { 'damage.resolved': (_context, event) => ({ second: event.first }) }
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
  assert.deepEqual(hooks.reactions['damage.resolved']({}, {}, {}), { first: true, second: true });
});

test('composition preserves retry boundaries, permanent denials, and exclusive policy precedence', () => {
  const retry = (retryAt) => ({ ready: false, retryAt, reason: 'wait', code: 'wait' });
  const denial = { ready: false, retryAt: null, reason: 'denied', code: 'denied' };
  const early = { availability: () => retry(2), endurance: { maximum: () => 10 }, playerAlacrityRechargeRate: 1.2 };
  const late = { availability: () => retry(5), endurance: { maximum: () => 20 }, playerAlacrityRechargeRate: 1.5 };
  const hooks = composeRuntimeHooks([late, early]);
  assert.equal(hooks.availability({ time: 0 }, {}, {}).retryAt, 5);
  assert.equal(hooks.endurance, early.endurance);
  assert.equal(hooks.playerAlacrityRechargeRate, 1.2);
  assert.equal(
    composeRuntimeHooks([early, { availability: () => denial }, late]).availability({ time: 0 }, {}, {}),
    denial
  );
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

test('declarative collections survive mechanic composition before native expansion', () => {
  const first = { traitTriggers: [{}], rechargeRules: [{}], backgroundTasks: ['first'], damageEffects: [{}] };
  const second = { traitTriggers: [{}], rechargeRules: [{}], backgroundTasks: ['second'], damageEffects: [{}] };
  const composed = composeRuntimeHooks([first, second]);
  for (const key of ['traitTriggers', 'rechargeRules', 'backgroundTasks', 'damageEffects'])
    assert.deepEqual(composed[key], [...first[key], ...second[key]]);
});
