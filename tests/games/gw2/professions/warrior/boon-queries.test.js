import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  warriorActiveBuffStacks,
  warriorActiveBoonCount,
  warriorBoonActive
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { modifyWarriorArmsAttributes, warriorArmsModifierRules } from '#gw2/professions/warrior/core/traits/arms.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
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
  modifyWarriorArmsAttributes({ catalog: warriorCatalog, ...context }, attributes, false);
  assert.equal(attributes.conditionDamage, 180);
  assert.equal(warriorActiveBoonCount({ ...context, time: 10 }), 0);
  assert.equal(warriorBoonActive({ ...context, runtime: undefined }, 'fury'), false);
  assert.equal(warriorBoonActive({ ...context, runtime: undefined, config: { boons: { fury: true } } }, 'fury'), true);
  applications[1].resolvedAudience.includesSelf = false;
  assert.equal(warriorBoonActive(context, 'fury'), false);
});

// Sample the real boon pool before the cast emits its own Fury application.
function stabilizedFlow(at, applications) {
  const config = {
    specialization: 'Bladesworn',
    initialResource: 0,
    selectedTraitIds: [],
    selectedSkills: ['Flow Stabilizer']
  };
  const profession = warriorProfession.runtimeFor(config);
  const result = observeGw2Runtime({
    profession: {
      ...profession,
      initialize(runtime) {
        profession.initialize?.(runtime);
        for (const application of applications)
          runtime.emit({
            type: 'buff',
            kind: 'fury',
            duration: 5,
            stacks: 1,
            source: 'fixture',
            sourceId: 'fixture',
            actorType: 'player',
            ...application
          });
      }
    },
    config,
    rotation: [{ type: 'wait', durationMs: at * 1000 }, ID.FLOW_STABILIZER]
  });
  assert.deepEqual(result.warnings, []);
  return observedRuntime(result).profession.specialization.state.flow;
}

test('Flow Stabilizer reads accumulated self Fury and excludes its own activation', () => {
  const prior = [0, 1].map((at) => ({ at, activationId: 'prior-' + at }));
  assert.equal(stabilizedFlow(7, prior), 15);
  assert.equal(stabilizedFlow(7, []), 0);
  assert.equal(
    stabilizedFlow(7, [prior[0], { ...prior[1], audience: { recipients: 'party', affectsSelf: false } }]),
    0
  );
});

// Neither a future application nor an expired pooled boon can grant the conditional resource.
test('Flow Stabilizer uses exact Fury application and expiry boundaries', () => {
  for (const [at, expected] of [
    [0.999999, 0],
    [1, 15],
    [1.999999, 15],
    [2, 0]
  ]) {
    assert.equal(stabilizedFlow(at, [{ at: 1, duration: 1, activationId: 'prior' }]), expected, 'cast at ' + at);
  }
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
