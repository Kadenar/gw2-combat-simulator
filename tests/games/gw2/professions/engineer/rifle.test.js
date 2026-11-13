/** Rifle charges expire independently and are spent one at a time, including interrupted casts. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, { primaryWeapon: 'Rifle' });
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const charges = (result) => observedRuntime(result).profession.core.rocketBurstChargeExpiries;
const waitUntil = (result, at) => wait(Math.round((at - result.planningState.atSeconds) * 1000));

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

test('either rifle trigger loses its unused charge at its five-second deadline', () => {
  for (const trigger of [ID.NET_SHOT, ID.OVERCHARGED_SHOT]) {
    const rotation = [cast(trigger)];
    let grantedAt;
    const armed = runEngineer(
      rotation,
      { primaryWeapon: 'Rifle' },
      {
        extend: (native) => ({
          onCastCommit(runtime, accepted) {
            native.onCastCommit?.(runtime, accepted);

            if (accepted.skill.id === trigger) grantedAt = runtime.time;
          }
        })
      }
    );
    const [expiresAt] = charges(armed);
    assert.equal(Math.round((expiresAt - grantedAt) * 1000), 5000);

    const before = simulate('Core', [...rotation, waitUntil(armed, expiresAt - 0.001)]);
    assert.deepEqual(before.warnings, []);
    assert.equal(before.planningState.availability[ID.ROCKET_BURST].ready, true);

    const expired = simulate('Core', [...rotation, waitUntil(armed, expiresAt)]);
    assert.deepEqual(expired.warnings, []);
    assert.deepEqual(charges(expired), []);
    assert.equal(expired.planningState.availability[ID.ROCKET_BURST].ready, false);
    assert.equal(expired.planningState.availability[ID.RIFLE_BURST].ready, true);
  }
});

test('Rocket Burst rejects missing, expired, and already spent charges', () => {
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

test('both rifle triggers bank charges that each permit one Rocket Burst', () => {
  const rotation = [cast(ID.NET_SHOT), cast(ID.OVERCHARGED_SHOT)];
  const result = simulate('Core', rotation);
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).flips[ID.ROCKET_BURST].remainingUses, 2);

  const remaining = simulate('Core', [...rotation, cast(ID.ROCKET_BURST)]);
  assert.deepEqual(remaining.warnings, []);
  assert.deepEqual(charges(remaining), charges(result).slice(1));
  assert.equal(remaining.planningState.availability[ID.ROCKET_BURST].ready, true);
  assert.equal(remaining.planningState.availability[ID.RIFLE_BURST].ready, false);
  assert.equal(observedRuntime(remaining).flips[ID.ROCKET_BURST].remainingUses, 1);

  const spent = simulate('Core', [...rotation, cast(ID.ROCKET_BURST), cast(ID.ROCKET_BURST), cast(ID.RIFLE_BURST)]);
  assert.deepEqual(spent.warnings, []);
  assert.deepEqual(charges(spent), []);
  assert.equal(spent.planningState.availability[ID.ROCKET_BURST].ready, false);
  assert.equal(spent.planningState.availability[ID.RIFLE_BURST].ready, true);
});

test('a later grant preserves the first deadline and survives the first charge expiry', () => {
  const first = simulate('Core', [cast(ID.NET_SHOT)]);
  const rotation = [cast(ID.NET_SHOT), wait(2000), cast(ID.OVERCHARGED_SHOT)];
  const armed = simulate('Core', rotation);
  const [firstExpiry, secondExpiry] = charges(armed);
  assert.equal(firstExpiry, charges(first)[0]);
  assert.ok(secondExpiry > firstExpiry);

  const result = simulate('Core', [...rotation, waitUntil(armed, firstExpiry)]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(charges(result), [secondExpiry]);
  assert.equal(result.planningState.availability[ID.ROCKET_BURST].ready, true);
  assert.equal(result.planningState.availability[ID.RIFLE_BURST].ready, false);
  assert.equal(observedRuntime(result).flips[ID.ROCKET_BURST].remainingUses, 1);

  const expired = simulate('Core', [...rotation, waitUntil(armed, secondExpiry)]);
  assert.deepEqual(expired.warnings, []);
  assert.deepEqual(charges(expired), []);
  assert.equal(expired.planningState.availability[ID.ROCKET_BURST].ready, false);
  assert.equal(expired.planningState.availability[ID.RIFLE_BURST].ready, true);
});

test('spending the oldest charge leaves the later deadline intact through the spent charge expiry', () => {
  const rotation = [cast(ID.NET_SHOT), wait(2000), cast(ID.OVERCHARGED_SHOT)];
  const armed = simulate('Core', rotation);
  const [firstExpiry, secondExpiry] = charges(armed);
  const spentRotation = [...rotation, cast(ID.ROCKET_BURST)];
  const spent = simulate('Core', spentRotation);
  const result = simulate('Core', [...spentRotation, waitUntil(spent, firstExpiry)]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(charges(result), [secondExpiry]);
  assert.equal(result.planningState.availability[ID.ROCKET_BURST].ready, true);

  const expired = simulate('Core', [...spentRotation, waitUntil(spent, secondExpiry)]);
  assert.deepEqual(expired.warnings, []);
  assert.deepEqual(charges(expired), []);
  assert.equal(expired.planningState.availability[ID.ROCKET_BURST].ready, false);
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
