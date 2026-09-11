import assert from 'node:assert/strict';
import test from 'node:test';
import { activeBoonStacks } from '#gw2/professions/engineer/core/mechanics/state-helpers.js';
import { engineerCoreAttributeRules } from '#gw2/professions/engineer/core/traits/modifiers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

// No Scope must keep its ferocity bonus through the whole live Fury pool.
test('Engineer No Scope survives overlapping Fury packet expiries', () => {
  const boons = new Map([['fury', [0, 1].map((at) => ({ at, expiresAt: at + 5, stacks: 1 }))]]);
  const context = { config: {}, traits: new Set([TRAIT.NO_SCOPE]), runtime: { boons }, time: 7 };
  assert.equal(activeBoonStacks({ config: {}, boons }, 'Fury', 1, 7), 1);
  assert.equal(engineerCoreAttributeRules.modifyAttributes(context, { ferocity: 0 }).ferocity, 150);
  assert.equal(engineerCoreAttributeRules.modifyAttributes({ ...context, time: 10 }, { ferocity: 0 }).ferocity, 0);
});

// Resolver queries use the requested event time and preserve Engineer's existing audience-independent counting.
test('Engineer boon stacks preserve normalization, permanent stacks, caps, and live visibility', () => {
  const applications = [
    { at: 0, expiresAt: 5, stacks: 20 },
    { at: 5, expiresAt: 10, stacks: 3, resolvedAudience: { includesSelf: true } },
    { at: 5, expiresAt: 10, stacks: 2, resolvedAudience: { includesSelf: false, includesSummons: true } },
    { at: 6, expiresAt: 10, stacks: 10 }
  ];
  const context = { config: { boons: { might: 4, stability: true } }, boons: new Map([['might', applications]]) };
  assert.equal(activeBoonStacks(context, 'Might', 25, 5), 9);
  assert.equal(activeBoonStacks(context, 'might', 7, 5), 7);
  assert.equal(activeBoonStacks(context, 'might', 25, 10), 4);
  assert.equal(activeBoonStacks(context, 'Stability', 1, 5), 1);

  // An application becomes visible only after insertion, even when it shares the queried timestamp.
  applications.push({ at: 5, expiresAt: 10, stacks: 1 });
  assert.equal(activeBoonStacks(context, 'might', 25, 5), 10);
  assert.equal(activeBoonStacks({}, 'might', 25, 5), 0);
});
