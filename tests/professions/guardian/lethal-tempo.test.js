import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeLethalTempo,
  gainLethalTempo,
  lethalTempoParameters
} from '#gw2/professions/guardian/specializations/willbender/mechanics/virtues.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

test('Lethal Tempo uses patched caps and trait windows without sharing phase state', () => {
  const catalog = {
    balanceProfilesById: new Map([
      [PROFILE.lethalTempo, { maximumStacks: 2, effects: [{ type: 'buff', duration: 9 }] }],
      [PROFILE.tyrantsMomentum, { effects: [{ type: 'buff', duration: 3 }] }]
    ])
  };
  for (const [traits, duration] of [
    [[], 9],
    [[TRAIT.TYRANTS_MOMENTUM], 3]
  ]) {
    const parameters = lethalTempoParameters({ catalog, traits: new Set(traits) });
    assert.deepEqual(parameters, { maximumStacks: 2, duration });
    const scheduler = { lethalTempoStacks: 0, lethalTempoUntil: 0 };
    const resolver = { ...scheduler };
    // Overlapping grants refresh at the cap; a grant at expiry starts a new stack window.
    assert.equal(gainLethalTempo(scheduler, 0, parameters), 1);
    assert.equal(gainLethalTempo(scheduler, 1, parameters), 2);
    assert.equal(gainLethalTempo(scheduler, 2, parameters), 2);
    assert.equal(activeLethalTempo(scheduler, 2 + duration), 0);
    assert.equal(gainLethalTempo(scheduler, 2 + duration, parameters), 1);
    assert.equal(gainLethalTempo(resolver, 1, parameters), 1);
    assert.equal(resolver.lethalTempoUntil, 1 + duration);
  }
});
