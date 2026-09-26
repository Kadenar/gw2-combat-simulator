import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

test('an unaffordable burst cannot partially spend the live adrenaline pool', () => {
  // Acceptance owns spending: insufficient resources reject the command without changing its pool.
  const config = { specialization: 'Core', initialResource: 6, primaryWeapon: 'Axe' };
  const result = observeGw2Runtime({
    profession: warriorProfession.runtimeFor(config),
    config,
    rotation: ['Eviscerate']
  });
  assert.equal(result.steps[0].invalid, true);
  assert.match(result.warnings[0], /requires 10 adrenaline/);
  const core = observedRuntime(result).profession.core;
  assert.equal(core.adrenaline, 6);
  assert.equal(Object.hasOwn(core, 'resource'), false);
});
