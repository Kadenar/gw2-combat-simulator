import assert from 'node:assert/strict';
import test from 'node:test';

import { CAST_READY, denyCast, retryCast } from '#gw2/platform/execution/availability.js';
import { resolveProfessionContract } from '#gw2/platform/profession-definition/compile-contract.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createGw2ResolverReactionRegistry } from '#gw2/platform/resolver/reaction-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Missing state must fail at composition, while explicitly stateless Core and elite modules remain valid.
test('native state factories require object fragments from every selected module', () => {
  const createState = (owner, fragment) => {
    const profession = defineNativeProfession({
      id: 'state-fixture',
      name: 'State fixture',
      modules: ['Core', 'Elite'].map((id) =>
        defineNativeModule({ id, data: {}, state: { create: () => (id === owner ? fragment : {}) } })
      )
    });
    return profession.runtimeFor({ specialization: 'Elite' }).createState({});
  };

  for (const owner of ['Core', 'Elite']) {
    for (const fragment of [undefined, null, false, 0, '', 1, 'invalid', []]) {
      assert.throws(() => createState(owner, fragment), {
        name: 'TypeError',
        message: `${owner} state factory must return an object.`
      });
    }

    assert.deepEqual(createState(owner, {}), { core: {}, specialization: { kind: 'Elite', state: {} } });
  }
});

// Native admission checks cost before profession hooks, merging waitable denials without running past permanent ones.
test('native availability combines cost and profession gates in order', () => {
  const calls = [];
  let professionResult = CAST_READY;
  const profession = defineNativeProfession({
    id: 'availability-fixture',
    name: 'Availability fixture',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {
          skills: [
            { id: 1, name: 'Cost probe', icon: 'fixture.png', effects: [], cost: { resource: 'energy', amount: 2 } }
          ]
        },
        state: { create: () => ({}) },
        hooks: {
          availability: () => {
            calls.push('profession');
            return professionResult;
          }
        }
      })
    ]
  });
  const runtime = profession.runtimeFor({});
  const skill = runtime.catalog.skillsById.get(1);
  const costDenial = (retryAt) => ({
    ready: false,
    retryAt,
    code: 'gw2.insufficient-energy',
    reason: 'Cost probe is unavailable - requires 2 energy.'
  });
  const wait = retryCast(3, 'profession.wait', 'Profession must wait');
  const permanent = denyCast('profession.denied', 'Profession rejects this command');
  for (const [readyAt, result, expected] of [
    [7, wait, { ...wait, retryAt: 7 }],
    [3, retryCast(7, 'later', 'Later gate'), retryCast(7, 'later', 'Later gate')],
    [7, CAST_READY, costDenial(7)],
    [2, retryCast(1, 'past', 'Past boundary'), retryCast(2, 'past', 'Past boundary')],
    [2, CAST_READY, CAST_READY],
    [null, wait, costDenial(null)],
    [null, permanent, costDenial(null)],
    [7, permanent, permanent]
  ]) {
    calls.length = 0;
    professionResult = result;
    const context = {
      time: 2,
      config: {},
      resourceController: {
        readyAt: (resource, amount) => {
          assert.equal(resource, 'energy');
          assert.equal(amount, 2);
          calls.push('cost');
          return readyAt;
        }
      }
    };
    assert.deepEqual(runtime.availability(context, skill, {}), expected);
    assert.deepEqual(calls, readyAt === null ? ['cost'] : ['cost', 'profession']);
  }

  // Build rejection still precedes both cost and profession checks.
  calls.length = 0;
  assert.equal(
    runtime.availability({ config: {} }, { ...skill, rotationInputExcluded: true }, {}).code,
    'gw2.build-unavailable'
  );
  assert.deepEqual(calls, []);
});

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
