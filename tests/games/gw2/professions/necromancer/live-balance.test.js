// Live condition caps apply once; defiance selects Anguish's maximum instead of adding another bonus.
import assert from 'node:assert/strict';
import test from 'node:test';

import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { ritualistModule } from '#gw2/professions/necromancer/specializations/ritualist/module.js';

const conditions = ['Bleeding', 'Burning', 'Poisoned', 'Torment', 'Confusion', 'Chilled', 'Weakness'];
const context = (count, defiant = false) => ({
  catalog: necromancerCatalog,
  config: { target: { defiant, conditions: Object.fromEntries(conditions.slice(0, count).map((name) => [name, 1])) } },
  time: 0
});

test('Anguish caps condition scaling and defiance supplies the maximum without stacking', () => {
  const rule = ritualistModule.modifiers.modifierRules.find(
    (rule) => rule.id === 'necromancer.anguish-conditional-damage'
  );
  const factor = (count, defiant) => rule.factor(context(count, defiant), undefined, rule.parameters);
  assert.ok(factor(3, false) > factor(0, false));
  assert.equal(factor(5, false), factor(7, false));
  assert.equal(factor(0, true), factor(7, false));
  assert.equal(factor(7, true), factor(7, false));
});
