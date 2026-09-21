import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { onBuffApplied, onConditionApplied, onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Flat declarations must compile once per stage, preserving priorities, ties, and stage-scoped IDs.
test('mixed-stage reaction arrays retain dispatch ownership and stable order after compilation', () => {
  const calls = [];
  const reactions = Object.freeze([
    onResolvedDamage({ id: 'late', order: 20, handler: () => calls.push('late') }),
    onConditionApplied({ id: 'shared', handler: () => calls.push('condition') }),
    onResolvedDamage({ id: 'shared', order: 0, handler: () => calls.push('tie-first') }),
    onBuffApplied({ id: 'shared', handler: () => calls.push('buff') }),
    onResolvedDamage({ id: 'tie-second', order: 0, handler: () => calls.push('tie-second') }),
    onResolvedDamage({ id: 'early', order: -10, handler: () => calls.push('early') })
  ]);
  const profession = defineNativeProfession({
    id: 'mixed-reactions',
    name: 'Mixed reactions',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {},
        state: { scheduler: () => ({}) },
        mechanics: { resolution: { reactions } }
      })
    ]
  }).resolveRuntime({});
  const registry = createGw2ResolverReactionRegistry({ professionReactions: profession.eventReactions });
  for (const [stage, type, expected] of [
    ['damage.resolved', 'damage', ['early', 'tie-first', 'tie-second', 'late']],
    ['condition.applied', 'condition', ['condition']],
    ['buff.applied', 'buff', ['buff']],
    ['control.resolved', 'control', []]
  ]) {
    calls.length = 0;
    registry.dispatch(stage, {}, { type, at: 0 });
    assert.deepEqual(calls, expected);
  }
});

// Compiling and running a headless family must never evaluate application presentation factories.
test('native runtime compilation defers presentation until the application requests it', () => {
  let presentations = 0;
  const profession = defineNativeProfession({
    id: 'headless',
    name: 'Headless',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {},
        state: { scheduler: () => ({}) },
        presentation() {
          presentations += 1;
          return { resourceViews: () => [{ id: 'resource', maximum: 3, value: 1 }] };
        }
      })
    ]
  });
  const runtime = profession.resolveRuntime({});
  assert.equal(Object.hasOwn(runtime, 'ui'), false);
  assert.equal(Object.hasOwn(runtime, 'migrateBuild'), false);
  assert.deepEqual(simulateGw2({ profession: runtime, rotation: [] }).warnings, []);
  assert.deepEqual(simulateGw2({ profession, rotation: [] }).warnings, []);
  assert.equal(presentations, 0);
  const ui = profession.ui;
  assert.equal(presentations, 1);
  assert.equal(profession.ui, ui);
  assert.equal(ui.resourceViews({}).length, 1);
  assert.equal(profession.resolveRuntime({}), runtime);
});
