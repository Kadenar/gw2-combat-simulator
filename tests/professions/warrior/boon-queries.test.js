import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { bladeswornAttributeRules } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger-rules.js';

// Core and Bladesworn count only live self stacks; configured boons and future timeline entries cannot grant them.
test('Warrior and Bladesworn stacks preserve self audience, caps, expiry, and same-time visibility', () => {
  const applications = [
    { at: 0, expiresAt: 5, stacks: 10, resolvedAudience: { includesSelf: true } },
    { at: 5, expiresAt: 10, stacks: 4, resolvedAudience: { includesSelf: true } },
    { at: 5, expiresAt: 10, stacks: 10, resolvedAudience: { includesSelf: false, includesSummons: true } },
    { at: 6, expiresAt: 10, stacks: 10, resolvedAudience: { includesSelf: true } }
  ];
  const context = {
    time: 5,
    config: { boons: { 'fierce-as-fire': 25 } },
    timeline: { timedStacks: () => 25, timedActive: () => true },
    runtime: { boons: new Map([['fierce-as-fire', applications]]) }
  };
  const rule = bladeswornAttributeRules.modifierRules.find(({ id }) => id === 'warrior.fierce-as-fire');
  assert.equal(warriorActiveBuffStacks(context, 'fierce-as-fire', 10), 4);
  assert.equal(rule.amount(context, 'strikeDamage', rule.parameters), 0.04);
  assert.equal(warriorActiveBuffStacks(context, 'fierce-as-fire', 3), 3);

  applications.push({ at: 5, expiresAt: 10, stacks: 8, resolvedAudience: { includesSelf: true } });
  assert.equal(warriorActiveBuffStacks(context, 'fierce-as-fire', 10), 10);
  assert.equal(rule.amount(context, 'strikeDamage', rule.parameters), 0.1);
  assert.equal(rule.amount({ ...context, time: 10 }, 'strikeDamage', rule.parameters), 0);
  assert.equal(rule.amount({ ...context, runtime: undefined }, 'strikeDamage', rule.parameters), 0);
});
