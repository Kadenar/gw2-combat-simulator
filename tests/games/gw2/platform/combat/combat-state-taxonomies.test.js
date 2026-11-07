import assert from 'node:assert/strict';
import test from 'node:test';

import { boonKey, GW2_STANDARD_BOONS, isStandardBoon, standardBoonPresentation } from '#gw2/platform/combat/boons.js';
import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
  GW2_DAMAGING_CONDITIONS,
  isDamagingCondition
} from '#gw2/platform/combat/state/targets.js';
import { BOON, CONDITION } from '#gw2/platform/constants.js';

// Saved UI settings and emitted skill conditions must resolve to one Blindness condition.
test('Blindness is the canonical blind condition', () => {
  assert.equal(canonicalTargetConditionName('Blindness'), 'Blindness');
  assert.equal(canonicalTargetConditionName(' blindness '), 'Blindness');
  assert.equal(CANONICAL_TARGET_CONDITIONS.includes('Blindness'), true);
});

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
  for (const boon of Object.values(BOON)) {
    assert.equal(isStandardBoon(boon), true, boon);
    assert.equal(isStandardBoon(boon.toUpperCase()), true, boon);
    assert.equal(GW2_STANDARD_BOONS.includes(boonKey(boon)), true, boon);
    assert.equal(standardBoonPresentation(boonKey(boon)).name, boon);
  }

  assert.equal(isStandardBoon('superspeed'), false);
  assert.equal(isStandardBoon(null), false);
});

test('condition taxonomy normalizes casing and whitespace without spelling aliases', () => {
  assert.deepEqual(GW2_DAMAGING_CONDITIONS, ['Bleeding', 'Burning', 'Confusion', 'Poisoned', 'Torment']);
  for (const condition of GW2_DAMAGING_CONDITIONS) {
    assert.equal(isDamagingCondition(condition), true, condition);
    assert.equal(isDamagingCondition(condition.toLowerCase()), true, condition);
  }

  assert.deepEqual(CANONICAL_TARGET_CONDITIONS, Object.values(CONDITION).sort());
  for (const condition of Object.values(CONDITION)) {
    assert.equal(canonicalTargetConditionName(` ${condition.toUpperCase()} `), condition);
  }

  assert.equal(isDamagingCondition('Vulnerability'), false);
  assert.equal(isDamagingCondition('Unknown condition'), false);
  assert.equal(isDamagingCondition(undefined), false);
});
