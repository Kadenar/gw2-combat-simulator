import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Strength of Shadows boosts the thief's Torment while leaving Poison untouched.
test('Strength of Shadows applies only to Torment', () => {
  const sample = (selected, condition, actorType) =>
    runThief(
      [{ type: 'wait', durationMs: 2000 }],
      {
        specialization: 'Specter',
        selectedTraitIds: selected ? [TRAIT.STRENGTH_OF_SHADOWS] : [],
        attributeInputs: baseAttributeInputs({ conditionDamage: 1000, vitality: 0 }),
        target: { armor: 2597, conditions: {} }
      },
      {
        initialize(runtime) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at: 0.1,
              condition,
              duration: 1,
              stacks: 1,
              actorType,
              name: `${actorType} ${condition}`,
              source: 'fixture',
              sourceId: 'fixture.condition'
            }
          });
        }
      }
    );
  for (const [condition, actorType] of [
    ['Torment', 'player'],
    ['Poisoned', 'player']
  ]) {
    const name = `${actorType} ${condition}`;
    const baseline = sample(false, condition, actorType);
    const selected = sample(true, condition, actorType);
    assert.deepEqual(selected.warnings, []);
    const damage = (result) => result.resolvedEvents.find((event) => event.name === name).damage;

    if (condition === 'Torment') assert.ok(damage(selected) > damage(baseline));
    else assert.equal(damage(selected), damage(baseline));
  }
});
