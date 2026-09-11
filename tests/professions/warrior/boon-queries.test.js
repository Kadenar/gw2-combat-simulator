import assert from 'node:assert/strict';
import test from 'node:test';
import {
  warriorActiveBuffStacks,
  warriorActiveBoonCount,
  warriorBoonActive
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { modifyWarriorArmsAttributes, warriorArmsModifierRules } from '#gw2/professions/warrior/core/traits/arms.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { createBladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import { bladeswornSkillMechanicHandlers } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger.js';
import { bladeswornAttributeRules } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger-rules.js';

// Warrior's modifiers share duration semantics without gaining visibility into future timeline applications.
test('Warrior Fury modifiers and boon counts survive individual packet expiry', () => {
  const applications = [0, 1].map((at) => ({
    at,
    expiresAt: at + 5,
    stacks: 1,
    resolvedAudience: { includesSelf: true }
  }));
  const context = {
    time: 7,
    config: {},
    traits: new Set([TRAIT.DEEP_STRIKES, TRAIT.FURIOUS_BURST]),
    runtime: {
      boons: new Map([
        ['fury', applications],
        ['swiftness', applications]
      ])
    },
    timeline: { timedActive: () => true }
  };
  const rule = warriorArmsModifierRules.find(({ id }) => id === 'warrior.furious-burst-fury-critical-chance');
  assert.equal(warriorBoonActive(context, 'fury'), true);
  assert.equal(warriorActiveBoonCount(context), 2);
  assert.equal(rule.when(context), true);
  const attributes = { conditionDamage: 0, ferocity: 0 };
  modifyWarriorArmsAttributes(context, attributes, false);
  assert.equal(attributes.conditionDamage, 180);
  assert.equal(warriorActiveBoonCount({ ...context, time: 10 }), 0);
  assert.equal(warriorBoonActive({ ...context, runtime: undefined }, 'fury'), false);
  assert.equal(warriorBoonActive({ ...context, runtime: undefined, config: { boons: { fury: true } } }, 'fury'), true);
  applications[1].resolvedAudience.includesSelf = false;
  assert.equal(warriorBoonActive(context, 'fury'), false);
});

test('Flow Stabilizer reads accumulated pre-cast Fury and excludes its own activation', () => {
  const events = [0, 1].map((at) => ({
    type: 'buff',
    kind: 'fury',
    at,
    duration: 5,
    stacks: 1,
    activationId: `prior-${at}`,
    resolvedAudience: { includesSelf: true }
  }));
  const state = createBladeswornState();
  const context = {
    config: {},
    epsilon: 0.0001,
    events,
    state: { profession: { core: {}, specialization: { kind: 'Bladesworn', state } } }
  };
  const invoke = () =>
    bladeswornSkillMechanicHandlers['warrior.bladesworn.flow-stabilizer']({
      context,
      at: 7,
      castStart: 7,
      activationId: 'current'
    });
  invoke();
  assert.equal(state.flow, 15);
  state.flow = 0;
  events[1].activationId = 'current';
  invoke();
  assert.equal(state.flow, 0);
  events[1].activationId = 'prior-1';
  events[1].resolvedAudience.includesSelf = false;
  invoke();
  assert.equal(state.flow, 0);
});

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
