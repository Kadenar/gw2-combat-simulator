import assert from 'node:assert/strict';
import test from 'node:test';

import { spendWarriorAdrenalineAmount } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';

// Build the smallest scheduler context needed to verify the shared Warrior resource contract.
function contextWithAdrenaline(adrenaline) {
  return {
    state: {
      profession: {
        core: { adrenaline, maximumAdrenaline: 30 }
      }
    }
  };
}

test('Warrior adrenaline spending clamps to the available amount without creating a resource alias', () => {
  const context = contextWithAdrenaline(6);

  assert.equal(spendWarriorAdrenalineAmount(context, 10), 6);
  assert.equal(context.state.profession.core.adrenaline, 0);
  assert.equal(Object.hasOwn(context.state.profession.core, 'resource'), false);
});
