import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeLethalTempo,
  gainLethalTempo,
  lethalTempoParameters
} from '#gw2/professions/guardian/specializations/willbender/mechanics/lethal-tempo.js';
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
    // Grants refresh at the cap through expiry; only a later grant starts a new stack window.
    assert.equal(gainLethalTempo(scheduler, 0, parameters), 1);
    assert.equal(gainLethalTempo(scheduler, 1, parameters), 2);
    assert.equal(gainLethalTempo(scheduler, 2, parameters), 2);
    assert.equal(activeLethalTempo(scheduler, 2 + duration), 2);
    assert.equal(gainLethalTempo(scheduler, 2 + duration, parameters), 2);
    assert.equal(gainLethalTempo(scheduler, 2 + 2 * duration + 0.000001, parameters), 1);
    assert.equal(gainLethalTempo(resolver, 1, parameters), 1);
    assert.equal(resolver.lethalTempoUntil, 1 + duration);
  }
});

test('Lethal Tempo refreshes existing stacks through its rounded expiry tick', () => {
  const parameters = { maximumStacks: 5, duration: 6 };
  for (const at of [6.001, 6.02, 6.039999, 6.04, 6.040001]) {
    const state = { lethalTempoStacks: 0, lethalTempoUntil: 0 };
    assert.equal(activeLethalTempo(state, 0), 0);
    gainLethalTempo(state, 0.001, parameters);
    gainLethalTempo(state, 0.001, parameters);
    assert.equal(state.lethalTempoUntil, 6.04);
    assert.equal(activeLethalTempo(state, at), at <= 6.04 ? 2 : 0);
    assert.equal(gainLethalTempo(state, at, parameters), at <= 6.04 ? 3 : 1);
  }
});
