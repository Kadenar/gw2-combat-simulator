import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

test('Adrenaline Rush grants adrenaline without damage or on-hit resource gains', () => {
  // The utility grant must remain independent of target contact and respect the adrenaline cap.
  for (const [initialResource, expected] of [
    [0, 3],
    [29, 30]
  ]) {
    const config = { specialization: 'Core', initialResource, primaryWeapon: 'Sword', secondaryWeapon: 'Sword' };
    const result = observeGw2Runtime({
      profession: warriorProfession.runtimeFor(config),
      config,
      rotation: ['Adrenaline Rush']
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.core.adrenaline.value, expected);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage'),
      false
    );
  }
});

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
  assert.equal(core.adrenaline.value, 6);
  assert.equal(Object.hasOwn(core, 'resource'), false);
});
