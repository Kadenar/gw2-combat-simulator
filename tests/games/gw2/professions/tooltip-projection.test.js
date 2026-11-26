import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeSimulationSkill,
  maximumBonusFact,
  simulationEffectFacts,
  traitSkillTooltip,
  traitTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { guardianZealTooltips } from '#gw2/professions/guardian/app/tooltips/zeal.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { revenantTooltips } from '#gw2/professions/revenant/app/tooltips.js';

// A trait's rate and another effect's stack limit can change independently between patches.
test('capped trait bonuses use the selected rate and the owning effect limit', () => {
  const trait = { id: 'trait' };
  const describe = traitTooltip('', [maximumBonusFact('rate', 'limit', 'Bonus', String, 'buff')]);
  function bonus(rate, limit) {
    const balanceProfilesById = new Map([
      [trait.id, { ...trait, rate, limit: 1 }],
      ['buff', { id: 'buff', limit }]
    ]);
    return describe({ catalog: { balanceProfilesById } }, trait).facts[0].detail;
  }

  assert.equal(bonus(3, 4), '12');
  assert.equal(bonus(2, 5), '10');
});

// Patches can add effects to either the invoking trait or its symbol.
test('symbol tooltips preserve trait effects, group matching pulses, and flag unsupported effects', () => {
  const trait = { id: 'fixture', threshold: 0.5, damageIncrease: 0.1 };
  const ownEffect = { type: 'control', controlKind: 'Stun' };
  const strike = { type: 'strike', coefficient: 1, applications: 3, intervalMs: 1000 };
  const condition = { type: 'condition', condition: 'Bleeding', duration: 4 };
  const unsupported = { type: 'custom', eventType: 'proc', event: { procType: 'fixture' } };

  for (const [traitId, skillId] of [
    [GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION, GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION],
    [GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS, GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES]
  ]) {
    function describe(effects, traitEffects = [ownEffect]) {
      const catalog = {
        balanceProfilesById: new Map([[trait.id, { ...trait, effects: traitEffects }]]),
        skillsById: new Map([[skillId, { id: skillId, name: 'Fixture symbol', effects }]])
      };
      return guardianZealTooltips[traitId]({ catalog }, trait);
    }

    const grouped = describe([strike, { ...condition, applications: 3, intervalMs: 1000 }]);
    const ownFact = simulationEffectFacts([ownEffect]).facts[0];
    assert.deepEqual(
      grouped.facts.find((fact) => fact.name === ownFact.name),
      ownFact
    );
    assert.deepEqual(
      grouped.factSections[0].facts,
      simulationEffectFacts([{ ...strike, applications: 1 }, condition]).facts
    );
    const mixed = describe([strike, condition]);
    assert.deepEqual(mixed.factSections[0].facts, simulationEffectFacts([strike, condition]).facts);
    assert.equal(mixed.incomplete, false);
    assert.equal(describe([unsupported]).incomplete, true);
    assert.equal(describe([strike], [unsupported]).incomplete, true);
  }
});

// A selector presents each choice's own facts under its configured tab.
test('selector tabs project the matching skills in selection order', () => {
  const selector = { id: 'selector', selector: { first: 'a', second: 'b' } };
  const skills = [
    { id: 'a', name: 'A', effects: [{ type: 'strike', coefficient: 1 }] },
    { id: 'b', name: 'B', effects: [{ type: 'condition', condition: 'Bleeding', duration: 3 }] }
  ];
  const context = { catalog: { skillsById: new Map(skills.map((skill) => [skill.id, skill])) } };
  const presentation = { traits: {} };
  const choices = skills.map((skill) => describeSimulationSkill(context, skill, presentation).facts);
  assert.ok(choices.every((facts) => facts.length > 0));
  assert.notDeepEqual(choices[0], choices[1]);
  const result = describeSimulationSkill(context, selector, presentation);
  assert.deepEqual(result.facts, []);
  assert.deepEqual(
    result.factTabs,
    Object.keys(selector.selector).map((label, index) => ({ label, facts: choices[index] }))
  );
});

// Conduit moves only form-dependent costs into tabs, including a recharge gained in form.
test('form cost tabs follow the equipped specialization and selected skill values', () => {
  const base = { id: 'fixture', name: 'Fixture', energyCost: 14, cooldown: 0, upkeepCost: 3 };
  const form = { ...base, mesmerEnergyCost: 2, mesmerRecharge: 6 };
  const describe = (skill, specialization) =>
    describeSimulationSkill({ catalog: { specializations: [] } }, skill, revenantTooltips, {
      specializations: [{ name: specialization }]
    });
  const details = (facts) => facts.map(({ detail }) => detail);
  const card = describe(form, 'Conduit');
  assert.deepEqual(
    card.factTabs.map(({ facts }) => details(facts)),
    [
      ['14', '0s'],
      ['2', '6s']
    ]
  );
  assert.deepEqual(details(card.facts), ['3']);
  const sharedRecharge = describe({ ...base, cooldown: 8, mesmerEnergyCost: 0 }, 'Conduit');
  assert.deepEqual(
    sharedRecharge.factTabs.map(({ facts }) => details(facts)),
    [['14'], ['0']]
  );
  assert.deepEqual(details(sharedRecharge.facts), ['8s', '3']);
  assert.deepEqual(describe(form, 'Herald'), describe(base, 'Conduit'));
  assert.equal(describe(base, 'Conduit').factTabs, undefined);
});

// Invoked skills share the normal effect formatter. Only a positive recharge contributes another fact.
test('trait tooltips combine trait and invoked skill facts against the supplied catalog', () => {
  const trait = { id: 'trait' };
  const ownFact = { name: 'Fixture fact', detail: 'Fixture detail' };
  const skill = { id: 'child', name: 'Child skill', effects: [{ type: 'strike', coefficient: 2 }] };
  const describe = traitSkillTooltip([skill.id], '', () => [ownFact]);
  function facts(child) {
    return describe({ catalog: { balanceProfilesById: new Map(), skillsById: new Map([[skill.id, child]]) } }, trait)
      .facts;
  }

  const expected = [ownFact, ...simulationEffectFacts(skill.effects, skill.name).facts];
  assert.deepEqual(facts({ ...skill, cooldown: 0 }), expected);
  assert.deepEqual(facts({ ...skill, effects: [] }), [ownFact]);
  const withRecharge = facts({ ...skill, cooldown: 3 });
  assert.deepEqual(withRecharge.slice(0, -1), expected);
  assert.notDeepEqual(withRecharge.at(-1), facts({ ...skill, cooldown: 5 }).at(-1));
});
