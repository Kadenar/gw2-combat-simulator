import assert from 'node:assert/strict';
import test from 'node:test';

import {
  requireRevenantBalanceProfile,
  requireRevenantEffect
} from '#gw2/professions/revenant/core/traits/profile-access.js';

test('Revenant strict profile access rejects missing data and ignores triggered child effects', () => {
  const profile = {
    id: 'test-profile',
    name: 'Test Profile',
    effects: [
      { type: 'strike', coefficient: 2, metadata: { trigger: 'child' } },
      { type: 'strike', coefficient: 1 }
    ]
  };
  const context = { catalog: { balanceProfilesById: new Map([[profile.id, profile]]) } };

  assert.equal(requireRevenantBalanceProfile(context, profile.id), profile);
  assert.equal(requireRevenantEffect(profile, 'strike').coefficient, 1);
  assert.throws(() => requireRevenantBalanceProfile(context, 'missing'), /Missing Revenant balance profile missing/);
  assert.throws(() => requireRevenantEffect(profile, 'boon'), /Test Profile is missing its boon effect/);
});
