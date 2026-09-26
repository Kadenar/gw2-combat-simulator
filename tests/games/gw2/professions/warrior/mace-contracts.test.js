import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(warriorProfession, { primaryWeapon: 'Mace', stats: {}, target: {} });

test('Counterblow arms one temporary Tactical Blow without dealing damage or granting adrenaline', () => {
  // The block reserves a single follow-up inside its original channel window.
  const block = simulate('Core', [ID.COUNTERBLOW]);
  assert.equal(
    block.events.some((event) => event.type === 'damage'),
    false
  );
  assert.equal(block.planningState.profession.adrenaline, 0);

  const flipped = simulate('Core', [ID.COUNTERBLOW, ID.TACTICAL_BLOW, ID.TACTICAL_BLOW]);
  assert.deepEqual(
    flipped.steps.filter((step) => !step.invalid).map((step) => step.skillId),
    [ID.COUNTERBLOW, ID.TACTICAL_BLOW]
  );
  assert.equal(flipped.steps[1].start, block.steps[0].end);
  assert.equal(flipped.planningState.profession.adrenaline, 6); // Five from the skill plus one ordinary strike.
  assert.equal(flipped.planningState.profession.availableFlips[ID.TACTICAL_BLOW], undefined);
  assert.ok(flipped.planningState.cooldowns.Counterblow.remaining > 0);

  for (const rotation of [
    [ID.TACTICAL_BLOW],
    [ID.COUNTERBLOW, { type: 'wait', durationMs: 3000 }, ID.TACTICAL_BLOW],
    [{ type: 'cast', skillId: ID.COUNTERBLOW, interruptAfterMs: 1 }, ID.TACTICAL_BLOW]
  ]) {
    const result = simulate('Core', rotation);
    assert.ok(result.steps.some((step) => step.skillId === ID.TACTICAL_BLOW && step.invalid));
  }
});

test('Mace damage and accompanying conditions or control resolve together before cast completion', () => {
  // Minimal casts and the required autoattack chain verify scheduling independently of the saved rotation.
  for (const [skillId, at] of [
    [ID.MACE_SMASH, 0.36],
    [ID.MACE_BASH, 0.44],
    [ID.PULVERIZE, 0.52],
    [ID.POMMEL_BASH, 0.2],
    [ID.SKULL_CRACK, 0.44]
  ]) {
    const chain = [ID.MACE_SMASH, ID.MACE_BASH, ID.PULVERIZE];
    const rotation = chain.includes(skillId) ? chain.slice(0, chain.indexOf(skillId) + 1) : [skillId];
    const result = simulate('Core', rotation, { initialResource: 30 });
    const step = result.steps.at(-1);
    const damage = result.events.find((event) => event.type === 'damage' && event.skillId === skillId);
    assert.equal(Math.round(damage.at * 1000 - step.start), at * 1000);
    assert.ok(damage.at * 1000 < step.end);
    for (const event of result.events.filter(
      (event) => event.skillId === skillId && ['condition', 'control'].includes(event.type)
    )) {
      assert.equal(event.at, damage.at);
    }
  }
});
