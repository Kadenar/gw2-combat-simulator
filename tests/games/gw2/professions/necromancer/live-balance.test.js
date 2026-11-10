// Live condition caps apply once; defiance selects Anguish's maximum instead of adding another bonus.
import assert from 'node:assert/strict';
import test from 'node:test';

import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { targetTheWeak } from '#gw2/professions/necromancer/core/traits/curses/index.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/profession.js';
import { ritualistModule } from '#gw2/professions/necromancer/specializations/ritualist/module.js';

const conditions = ['Bleeding', 'Burning', 'Poisoned', 'Torment', 'Confusion', 'Chilled', 'Weakness'];
const context = (count, defiant = false) => ({
  catalog: necromancerCatalog,
  config: { target: { defiant, conditions: Object.fromEntries(conditions.slice(0, count).map((name) => [name, 1])) } },
  time: 0
});

test('Necromancer has no remaining balance-preview overlay', () => {
  assert.equal(activePatchPreview, null);
});

test('Target the Weak grants four percent critical chance per condition, capped at five', () => {
  for (const count of [0, 3, 5, 7]) {
    assert.equal(targetTheWeak.modifierRules[0].amount(context(count)), Math.min(count, 5) * 0.04);
  }
});

test('Anguish caps condition scaling and defiance supplies the maximum without stacking', () => {
  const rule = ritualistModule.modifiers.modifierRules.find(
    (rule) => rule.id === 'necromancer.anguish-conditional-damage'
  );
  for (const count of [0, 3, 5, 7])
    for (const defiant of [false, true]) {
      assert.equal(
        rule.amount(context(count, defiant), undefined, rule.parameters),
        (defiant ? 5 : Math.min(count, 5)) * 0.04
      );
    }
});
