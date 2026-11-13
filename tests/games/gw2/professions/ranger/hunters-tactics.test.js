// Exercise the bonus window through resolved hits, including refresh, expiry, and excluded owners.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { wait } from '#tests/helpers/commands.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const config = {
  specialization: 'Soulbeast',
  primaryWeapon: 'Longbow',
  selectedTraitIds: [TRAIT.HUNTERS_TACTICS],
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, ferocity: 0 }),
  target: { armor: 2597, defiant: true, conditions: {} }
};

function hit(runtime, at, actorType = 'player') {
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'damage',
      at,
      actorType,
      source: actorType === 'player' ? 'ranger' : 'ranger-pet',
      sourceId: ID.LONG_RANGE_SHOT,
      skillId: ID.LONG_RANGE_SHOT,
      skillName: 'Test strike',
      name: 'Test strike',
      coefficient: 1,
      hits: 1,
      canCrit: true,
      weaponStrength: 1000
    }
  });
}

test("Hunter's Tactics refreshes after a hit and expires eight seconds after the last qualifying hit", () => {
  const result = runRanger(
    [wait(16000)],
    { ...config, target: { ...config.target } },
    {
      timeline: [
        { at: 1, run: (runtime) => hit(runtime, 1) },
        { at: 6, run: (runtime) => hit(runtime, 6) },
        {
          at: 7,
          run: (runtime) => {
            runtime.config.target.defiant = false;
          }
        },
        { at: 9, run: (runtime) => hit(runtime, 9) },
        { at: 14, run: (runtime) => hit(runtime, 14) }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage');
  const base = hits[0].criticalChance;
  for (const [index, bonus] of [0, 0.1, 0.1, 0].entries())
    assert.ok(Math.abs(hits[index].criticalChance - base - bonus) < 1e-9);
  assert.equal(result.events.filter((event) => event.kind === 'hunters-tactics').length, 2);
});

test("Hunter's Tactics ignores pet hits and non-flanking player hits", () => {
  for (const [actorType, defiant] of [
    ['summon', true],
    ['player', false]
  ]) {
    const result = runRanger(
      [wait(2000)],
      { ...config, specialization: 'Core', target: { ...config.target, defiant } },
      {
        timeline: [{ at: 1, run: (runtime) => hit(runtime, 1, actorType) }]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.some((event) => event.kind === 'hunters-tactics'),
      false
    );
  }
});

// Capped critical chance isolates the restored strike bonus from the trait's critical chance bonus.
test("Hunter's Tactics increases subsequent strike damage even when critical chance is capped", () => {
  const capped = { ...config, attributeInputs: baseAttributeInputs({ power: 2000, precision: 4000, ferocity: 0 }) };
  const rotation = [ID.LONG_RANGE_SHOT, ID.LONG_RANGE_SHOT];
  const baseline = runRanger(rotation, { ...capped, selectedTraitIds: [] });
  const active = runRanger(rotation, capped);
  assert.ok(active.events.some((event) => event.kind === 'hunters-tactics'));
  const damage = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage').map((event) => event.damage);
  assert.deepEqual(active.warnings, []);
  assert.equal(damage(active)[0], damage(baseline)[0]);
  assertFlooredDamageMultiplier(damage(active)[1], damage(baseline)[1], 1.1);
});
