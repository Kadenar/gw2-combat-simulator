import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const config = { specialization: 'Untamed', initialUntamedState: 'Pet' };
const petActions = (result) =>
  result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');

// Every Unleashed command replaces autonomous work, preserving landed hits and cancelling pending contacts.
for (const skillId of [ID.VENOMOUS_OUTBURST, ID.RENDING_VINES, ID.ENVELOPING_HAZE]) {
  test(`Unleashed command ${skillId} retains off-target behavior under pet ownership`, () => {
    // Changing the packet owner must not make an intentionally missed command damage the target.
    const result = runRanger([{ type: 'cast', skillId, offTarget: true }, wait(6000)], config);
    assert.deepEqual(result.warnings, []);
    assert.ok(result.events.some((event) => event.type === 'action' && event.skillId === skillId));
    assert.equal(
      result.resolvedEvents.some(
        (event) => event.skillId === skillId && (event.damage > 0 || event.damageTicks?.some((tick) => tick.damage > 0))
      ),
      false
    );
  });

  for (const selectedPet of ['Hawk', 'Tiger', 'Pig']) {
    for (const requestedAt of [320, 600, 1200]) {
      test(`Unleashed command ${skillId} restarts ${selectedPet}'s autonomous attack at ${requestedAt} ms`, () => {
        const settings = { ...config, selectedPet };
        const baseline = runRanger(['__combat_start', wait(5000)], settings);
        const result = runRanger(['__combat_start', wait(requestedAt), skillId, wait(5000)], settings);
        assert.deepEqual(result.warnings, []);
        const command = result.events.find((event) => event.type === 'action' && event.skillId === skillId);
        const actions = petActions(result);
        const restarted = actions.find((event) => event.at === command.at);
        assert.ok(restarted);
        const previous = actions.find((event) => event.at < command.at);

        if (previous) {
          const landed = (output) =>
            output.resolvedEvents.filter(
              (event) => event.type === 'damage' && event.activationId === previous.activationId
            );
          assert.ok(previous.interrupted);
          assert.deepEqual(
            landed(result).map((event) => event.at),
            landed(baseline)
              .filter((event) => event.at <= command.at)
              .map((event) => event.at)
          );
        }

        assert.ok(
          result.resolvedEvents.some(
            (event) => event.type === 'damage' && event.activationId === restarted.activationId
          )
        );
        for (let index = 1; index < actions.length; index++) {
          assert.ok(actions[index].at >= actions[index - 1].endsAt);
        }
      });
    }
  }

  test(`Unleashed command ${skillId} preserves an already commanded pet skill and its damage`, () => {
    // Instant commands reset only AI work; an accepted manual command owns the pet lane until completion.
    const result = runRanger(
      ['__combat_start', wait(600), ID.FURIOUS_POUNCE, ID.UNLEASH_PET, wait(200), skillId, wait(6000)],
      { ...config, selectedPet: 'Tiger', initialUntamedState: 'Ranger' }
    );
    assert.deepEqual(result.warnings, []);
    const actions = petActions(result);
    const manual = actions.find((event) => event.skillId === ID.FURIOUS_POUNCE);
    const command = result.events.find((event) => event.type === 'action' && event.skillId === skillId);
    assert.ok(manual.at < command.at && manual.endsAt > command.at);
    assert.ok(!manual.interrupted && !manual.cancelled);
    assert.ok(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.activationId === manual.activationId)
    );
    assert.ok(actions.filter((event) => event.at > manual.at).every((event) => event.at >= manual.endsAt));
  });
}

for (const skillId of [ID.VENOMOUS_OUTBURST, ID.RENDING_VINES]) {
  test(`Delayed pet command ${skillId} resolves after same-time Sic Em regardless of command order`, () => {
    // The delayed impact must use buffs accepted after activation instead of resolving damage immediately.
    const strike = (rotation) => {
      const result = runRanger([...rotation, wait(1000)], { ...config, selectedPet: 'Tiger' });
      assert.deepEqual(result.warnings, []);
      return result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === skillId);
    };

    const baseline = strike([skillId]);
    const before = strike([ID.SIC_EM, skillId]);
    const after = strike([skillId, ID.SIC_EM]);
    assert.ok(after.damage > baseline.damage);
    assert.equal(after.damage, before.damage);
  });

  test(`Swapping pets before command ${skillId} impact retires its pending strike and conditions`, () => {
    // Delayed payloads belong to the launching companion and must not migrate onto the replacement pet.
    const result = runRanger([skillId, wait(120), ID.PET_SWAP, wait(1000)], {
      ...config,
      selectedPet: 'Tiger',
      selectedPet2: 'Hawk',
      target: { armor: 2597, defiant: true, conditions: {} }
    });
    assert.deepEqual(result.warnings, []);
    assert.ok(result.events.some((event) => event.type === 'ranger.pet-swapped'));
    assert.equal(
      result.resolvedEvents.some((event) => event.skillId === skillId && ['damage', 'condition'].includes(event.type)),
      false
    );
  });
}
