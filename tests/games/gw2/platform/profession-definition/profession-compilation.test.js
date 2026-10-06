import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { resolveProfessionContract } from '#gw2/platform/profession-definition/compile-contract.js';

// Flat declarations must compile once per stage, preserving priorities, ties, and stage-scoped IDs.
test('mixed-stage reaction arrays retain dispatch ownership and stable order after compilation', () => {
  const calls = [];
  const reactions = Object.freeze([
    { stage: 'damage.resolved', id: 'late', order: 20, handler: () => calls.push('late') },
    { stage: 'condition.applied', id: 'shared', order: 0, handler: () => calls.push('condition') },
    { stage: 'damage.resolved', id: 'shared', order: 0, handler: () => calls.push('tie-first') },
    { stage: 'buff.applied', id: 'shared', order: 0, handler: () => calls.push('buff') },
    { stage: 'damage.resolved', id: 'tie-second', order: 0, handler: () => calls.push('tie-second') },
    { stage: 'damage.resolved', id: 'early', order: -10, handler: () => calls.push('early') }
  ]);
  const contributions = Object.groupBy(reactions, (reaction) => reaction.stage);
  const registry = createGw2ResolverReactionRegistry({ contributions });
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
  let familyPresentations = 0;
  const presentationCatalogs = [];
  const profession = defineNativeProfession({
    id: 'headless',
    name: 'Headless',
    presentation(catalog) {
      familyPresentations += 1;
      presentationCatalogs.push(catalog);
      return { resourceViews: () => [{ id: 'family-resource', maximum: 5, value: 2 }] };
    },
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {},
        state: { create: () => ({}) },
        presentation(catalog) {
          presentations += 1;
          presentationCatalogs.push(catalog);
          return { resourceViews: () => [{ id: 'resource', maximum: 3, value: 1 }] };
        }
      })
    ]
  });
  assert.equal(familyPresentations, 0);
  assert.equal(presentations, 0);
  const runtime = resolveProfessionContract(profession);
  // Resolution requires a family so an already-resolved runtime cannot bypass specialization selection.
  assert.throws(() => resolveProfessionContract(runtime), /profession family contract is required/);
  assert.throws(() => resolveProfessionContract(null), /profession family contract is required/);
  assert.equal(Object.hasOwn(runtime, 'ui'), false);
  assert.equal(Object.hasOwn(runtime, 'migrateBuild'), false);
  assert.deepEqual(simulateGw2({ profession, rotation: [] }).warnings, []);
  assert.equal(presentations, 0);
  assert.equal(familyPresentations, 0);
  const ui = profession.ui;
  assert.equal(presentations, 1);
  assert.equal(familyPresentations, 1);
  assert.equal(presentationCatalogs.length, 2);
  for (const catalog of presentationCatalogs) assert.equal(catalog, profession.catalog);
  assert.equal(profession.ui, ui);
  assert.deepEqual(
    ui.resourceViews({}).map(({ id }) => id),
    ['resource', 'family-resource']
  );
  // Repeated UI access and projections reuse the composed presentation without rebinding either factory.
  assert.equal(presentations, 1);
  assert.equal(familyPresentations, 1);
  assert.equal(profession.resolveProfession({}), runtime);
});
