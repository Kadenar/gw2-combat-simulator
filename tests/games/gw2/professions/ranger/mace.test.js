import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Minimal mace cycles isolate stack ownership, recharge, and expiry from the saved benchmark rotation.
const run = createObservedProfessionSimulator(rangerProfession, {
  primaryWeapon: 'Mace',
  secondaryWeapon: 'Mace',
  selectedPet: 'Tiger',
  selectedTraitIds: [],
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, ferocity: 0 }),
  target: { armor: 2597, defiant: true, conditions: { Vulnerability: 25 } }
});
const simulate = (...args) => {
  const result = run(...args);
  assert.deepEqual(result.warnings, []);
  return result;
};

const cycle = [ID.FLOURISH, ID.OAKEN_CUDGEL, ID.THISTLEGUARD, ID.WILD_STRIKES];
const chain = [ID.GERMINATE, ID.BURGEON, ID.CULTIVATE];
const wait = (durationMs) => ({ type: 'wait', durationMs });
const buffs = (result, kind) => result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === kind);
const stacks = (result, kind) =>
  observedRuntime(result).mechanics.combat.activeBuffStacks(
    kind,
    result.rotationEndTime,
    kind === 'natures-strength' ? 5 : 1
  );

test('mace disables activate Claw for subsequent player strikes, while cancelled non-hits do not', () => {
  // Control ownership must reach equipment reactions without granting a proc for an abandoned attack.
  for (const skillId of [ID.OAKEN_CUDGEL, ID.WILD_STRIKES]) {
    const rotation = [skillId, ID.GERMINATE];
    const ordinary = simulate('Core', rotation, { relic: '' });
    const equipped = simulate('Core', rotation, { relic: 'Claw' });
    const hit = (result) =>
      result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.GERMINATE);
    assertFlooredDamageMultiplier(hit(equipped).damage, hit(ordinary).damage, 1.07);
    assert.equal(buffs(equipped, 'relic-claw').length, 1);
    assert.equal(buffs(equipped, 'relic-claw')[0].triggeredBy, equipped.steps[0].skill);

    const cancelled = simulate('Core', [{ type: 'cast', skillId, interruptAfterMs: 0 }, ID.GERMINATE], {
      relic: 'Claw'
    });
    assert.equal(buffs(cancelled, 'relic-claw').length, 0);
  }
});

test('qualifying mace hits grant their stack rewards once and interrupted non-hits grant none', () => {
  for (const [id, amount] of [
    [ID.CULTIVATE, 1],
    [ID.FLOURISH, 1],
    [ID.OAKEN_CUDGEL, 1],
    [ID.THISTLEGUARD, 1],
    [ID.WILD_STRIKES, 2],
    [ID.GERMINATE, 0],
    [ID.BURGEON, 0]
  ]) {
    const prefix = id === ID.CULTIVATE ? chain.slice(0, 2) : id === ID.BURGEON ? chain.slice(0, 1) : [];
    const result = simulate('Core', [...prefix, id]);
    assert.deepEqual(result.warnings, []);
    assert.equal(stacks(result, 'natures-strength'), amount);
    const cancelled = simulate('Core', [...prefix, { type: 'cast', skillId: id, interruptAfterMs: 0 }]);
    assert.equal(stacks(cancelled, 'natures-strength'), 0);
  }
});

test("five stacks consume Nature's Strength and reset all mace recharges including the triggering skill", () => {
  const result = simulate('Core', [ID.SIC_EM, ...cycle, ...cycle]);
  assert.deepEqual(result.warnings, []);
  assert.equal(buffs(result, 'force-of-nature').length, 1);
  assert.equal(stacks(result, 'natures-strength'), 0);
  for (let index = 5; index < result.steps.length; index++) {
    assert.equal(result.steps[index].start, result.steps[index - 1].end, result.steps[index].skill);
  }

  const force = buffs(result, 'force-of-nature')[0];
  const stability = buffs(result, 'stability').find((event) => event.at === force.at && event.stacks === 5);
  assert.ok(stability);
  assert.ok(observedRuntime(result).cooldownController.readyAt(ID.SIC_EM) > result.rotationEndTime);
});

test('Cultivate and Rampant Growth can build stacks but cannot trigger Force of Nature', () => {
  const prefix = Array(5).fill(chain).flat();
  const capped = simulate('Core', [...prefix, ...chain]);
  assert.equal(stacks(capped, 'natures-strength'), 5);
  assert.equal(buffs(capped, 'force-of-nature').length, 0);
  const triggered = simulate('Core', [...prefix, ID.FLOURISH]);
  assert.equal(buffs(triggered, 'force-of-nature').length, 1);
  assert.equal(stacks(triggered, 'natures-strength'), 0);

  for (const count of [0, 4, 5]) {
    const ambush = simulate('Untamed', [...Array(count).fill(chain).flat(), ID.UNLEASH_RANGER, ID.RAMPANT_GROWTH], {
      initialUntamedState: 'Pet'
    });
    assert.deepEqual(ambush.warnings, []);
    assert.equal(stacks(ambush, 'natures-strength'), Math.min(count + 1, 5));
    assert.equal(buffs(ambush, 'force-of-nature').length, 0);
  }
});

test("Nature's Strength expires independently of boon duration and cannot trigger from stale stacks", () => {
  const result = simulate('Core', [ID.FLOURISH, wait(26000), ID.OAKEN_CUDGEL, ID.THISTLEGUARD, ID.WILD_STRIKES], {
    attributeInputs: baseAttributeInputs({ concentration: 1500 })
  });
  assert.equal(stacks(result, 'natures-strength'), 4);
  assert.equal(buffs(result, 'force-of-nature').length, 0);
});
