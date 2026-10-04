import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';

/** Minimal modules keep these checks about selected hook ownership rather than profession content. */
function module(id, hooks = {}) {
  return defineNativeModule({ id, data: {}, state: { create: () => ({}) }, hooks });
}

test('family bindings compose before selected modules and stay isolated across cached runtime modes', () => {
  const selected = [];
  const calls = [];
  const profession = defineNativeProfession({
    id: 'fixture',
    name: 'Fixture',
    modules: [
      module('Core', { initialize: () => calls.push('Core') }),
      module('Elite', { initialize: () => calls.push('Elite') })
    ],
    runtimeHooks(specialization) {
      selected.push(specialization);
      return {
        initialize: () => calls.push(`family:${specialization}`),
        tasks: { [`family:${specialization}`]: () => calls.push(specialization) }
      };
    }
  });
  const core = profession.runtimeFor({ specialization: 'Core' });
  const elite = profession.runtimeFor({ specialization: 'Elite' });
  const preview = profession.runtimeFor({ specialization: 'Elite' }, { traitTriggers: false });
  assert.equal(profession.runtimeFor({ specialization: 'Elite' }), elite);
  assert.notEqual(preview, elite);
  assert.deepEqual(selected, ['Core', 'Elite', 'Elite']);
  assert.equal(core.tasks['family:Elite'], undefined);
  assert.equal(elite.tasks['family:Core'], undefined);
  core.initialize({});
  elite.initialize({});
  assert.deepEqual(calls, ['family:Core', 'Core', 'family:Elite', 'Core', 'Elite']);
  assert.throws(() => profession.runtimeFor({ specialization: 'Unknown' }), /Unknown specialization/);
  assert.deepEqual(selected, ['Core', 'Elite', 'Elite']);
});

test('family bindings retain duplicate-owner and unsupported-hook validation', () => {
  const definition = { id: 'fixture', name: 'Fixture', modules: [module('Core', { tasks: { owned() {} } })] };
  assert.throws(() => defineNativeProfession({ ...definition, runtimeHooks: {} }), /runtimeHooks must be a function/);
  assert.throws(
    () =>
      defineNativeProfession({
        ...definition,
        runtimeHooks: () => ({ tasks: { owned() {} } })
      }).runtimeFor({}),
    /Duplicate hook tasks owner/
  );
  assert.throws(
    () =>
      defineNativeProfession({
        ...definition,
        runtimeHooks: () => ({ unsupported() {} })
      }).runtimeFor({}),
    /Unsupported runtime hook unsupported/
  );
});
