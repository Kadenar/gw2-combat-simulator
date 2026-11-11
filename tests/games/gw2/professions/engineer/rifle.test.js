/** Rifle triggers share one expiring volley, consumed on acceptance even when interrupted. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, { primaryWeapon: 'Rifle' });
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });

test('either rifle trigger exposes one Rocket Burst and consuming it restores Rifle Burst', () => {
  for (const trigger of [ID.NET_SHOT, ID.OVERCHARGED_SHOT]) {
    const armed = simulate('Core', [cast(trigger)]);
    assert.deepEqual(armed.warnings, []);
    assert.equal(armed.planningState.availability[ID.ROCKET_BURST].ready, true);
    assert.equal(armed.planningState.availability[ID.RIFLE_BURST].ready, false);

    const spent = simulate('Core', [cast(trigger), cast(ID.ROCKET_BURST), cast(ID.RIFLE_BURST)]);
    assert.deepEqual(spent.warnings, []);
    assert.equal(spent.planningState.availability[ID.ROCKET_BURST].ready, false);
    assert.equal(spent.planningState.availability[ID.RIFLE_BURST].ready, true);
    assert.ok(spent.resolvedEvents.some((event) => event.name === 'Rocket Burst' && event.damage > 0));
  }
});

test('Rocket Burst rejects missing, expired, and already spent opportunities', () => {
  for (const rotation of [
    [cast(ID.ROCKET_BURST)],
    [cast(ID.NET_SHOT), wait(5000), cast(ID.ROCKET_BURST)],
    [cast(ID.NET_SHOT), cast(ID.ROCKET_BURST), cast(ID.ROCKET_BURST)]
  ]) {
    const result = simulate('Core', rotation);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0].message, /Rocket Burst/);
    assert.equal(result.planningState.availability[ID.ROCKET_BURST].ready, false);
  }
});

test('a second rifle trigger refreshes the expiry without banking another volley', () => {
  const result = simulate('Core', [cast(ID.NET_SHOT), wait(4000), cast(ID.OVERCHARGED_SHOT), wait(2000)]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.availability[ID.ROCKET_BURST].ready, true);
  assert.equal(observedRuntime(result).flips[ID.ROCKET_BURST].remainingUses, 1);
  const spent = simulate('Core', [cast(ID.NET_SHOT), cast(ID.OVERCHARGED_SHOT), cast(ID.ROCKET_BURST)]);
  assert.deepEqual(spent.warnings, []);
  assert.equal(spent.planningState.availability[ID.ROCKET_BURST].ready, false);
});

test('interrupting Rocket Burst still spends the opportunity', () => {
  const result = simulate('Core', [
    cast(ID.NET_SHOT),
    { ...cast(ID.ROCKET_BURST), interruptAfterMs: 0 },
    cast(ID.RIFLE_BURST)
  ]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.availability[ID.ROCKET_BURST].ready, false);
});
