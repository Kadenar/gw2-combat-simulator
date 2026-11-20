import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeSimulationSkill,
  simulationEffectFacts,
  traitSkillTooltip
} from '#gw2/app/shared/simulation-tooltip.js';

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
