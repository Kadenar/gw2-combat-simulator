import assert from 'node:assert/strict';
import test from 'node:test';

import { GW2_STANDARD_BOONS, isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import {
  canonicalTargetConditionName,
  GW2_DAMAGING_CONDITIONS,
  isDamagingCondition
} from '#gw2/platform/combat/state/targets.js';

test('standard boon taxonomy recognizes every canonical boon and rejects unknown effects', () => {
  assert.deepEqual(GW2_STANDARD_BOONS, [
    'aegis',
    'alacrity',
    'fury',
    'might',
    'protection',
    'quickness',
    'regeneration',
    'resistance',
    'resolution',
    'stability',
    'swiftness',
    'vigor'
  ]);
  for (const boon of GW2_STANDARD_BOONS) {
    assert.equal(isStandardBoon(boon), true, boon);
    assert.equal(isStandardBoon(boon.toUpperCase()), true, boon);
  }

  assert.equal(isStandardBoon('superspeed'), false);
  assert.equal(isStandardBoon(null), false);
});

test('damaging-condition taxonomy recognizes canonical names and external aliases', () => {
  assert.deepEqual(GW2_DAMAGING_CONDITIONS, ['Bleeding', 'Burning', 'Confusion', 'Poisoned', 'Torment']);
  for (const condition of GW2_DAMAGING_CONDITIONS) {
    assert.equal(isDamagingCondition(condition), true, condition);
    assert.equal(isDamagingCondition(condition.toLowerCase()), true, condition);
  }

  for (const [alias, canonical] of [
    ['bleed', 'Bleeding'],
    ['burn', 'Burning'],
    ['Poison', 'Poisoned'],
    [' poisoned ', 'Poisoned']
  ]) {
    assert.equal(canonicalTargetConditionName(alias), canonical);
    assert.equal(isDamagingCondition(alias), true, alias);
  }

  assert.equal(isDamagingCondition('Vulnerability'), false);
  assert.equal(isDamagingCondition('Unknown condition'), false);
  assert.equal(isDamagingCondition(undefined), false);
});
