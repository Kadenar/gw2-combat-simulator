import { MODIFIER_HOOK_NAMES } from '#gw2/platform/profession-definition/compiler/compile-contract.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { testProfession } from '#tests/fixtures/profession.js';

const packet = (sourceId, at) => ({
  type: 'buff',
  kind: 'ownership-fixture',
  duration: 2,
  stacks: 1,
  source: 'Fixture',
  sourceId,
  actorType: 'player',
  at
});

// Cancellation owns pending work, while preparation observes the state live at the surviving application.
test('owned effects prepare once at impact and retain their reserved identity', () => {
  const prepared = [];
  const references = [];
  const profession = {
    ...Object.fromEntries(MODIFIER_HOOK_NAMES.map((key) => [key, testProfession[key]])),
    id: 'effect-ownership-fixture',
    buffPolicies: () => [{ kind: 'ownership-fixture' }],
    catalog: createCanonicalCatalog({ generated: [] }),
    createState: () => ({ value: 1 }),
    initialize(runtime) {
      references.push(runtime.effects.emit({ receipt: true, kind: 'packet', event: packet('cancelled', 1) }));
      references.push(runtime.effects.emit({ receipt: true, kind: 'packet', event: packet('survivor', 1) }));
      runtime.schedule('change', 0.5);
    },
    effectOwner(_runtime, event) {
      return { id: String(event.sourceId), generation: 0 };
    },
    prepareEvent(runtime, event) {
      prepared.push({ sourceId: event.sourceId, at: runtime.time, eventOrder: event.eventOrder });
      return { ...event, stacks: runtime.profession.value };
    },
    tasks: {
      change(runtime) {
        runtime.profession.value = 3;
        runtime.cancelOwner({ id: 'cancelled', generation: 0 });
      }
    }
  };
  const result = runGw2Runtime({ profession, config: {}, rotation: [{ type: 'wait', durationMs: 1100 }] });
  assert.deepEqual(result.warnings, []);
  const survivor = result.events.find((event) => event.sourceId === 'survivor');
  assert.equal(survivor.stacks, 3);
  assert.equal(survivor.eventOrder, references[1].eventOrder);
  assert.ok(Object.isFrozen(references[1]));
  assert.equal(
    result.events.some((event) => event.sourceId === 'cancelled'),
    false
  );
  assert.deepEqual(
    prepared.filter((entry) => ['cancelled', 'survivor'].includes(entry.sourceId)),
    [{ sourceId: 'survivor', at: 1, eventOrder: references[1].eventOrder }]
  );
});

// Two independent modules must not silently assign competing cancellation lifetimes to the same packet.
test('composed ownership rules reject conflicts and accept the same owner', () => {
  const same = () => ({ id: 'shared', generation: 2 });
  assert.deepEqual(composeRuntimeHooks([{ effectOwner: same }, { effectOwner: same }]).effectOwner({}, packet(1, 1)), {
    id: 'shared',
    generation: 2
  });
  const hooks = composeRuntimeHooks([
    { effectOwner: same },
    { effectOwner: () => ({ id: 'different', generation: 2 }) }
  ]);
  assert.throws(() => hooks.effectOwner({}, packet(1, 1)), /Conflicting effect lifetime owners/);
});
