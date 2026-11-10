// Final balance replaces preview overrides and caps the hammer bonus without double-counting defiance.
import assert from 'node:assert/strict';
import test from 'node:test';

import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { rangerCoreModule } from '#gw2/professions/ranger/core/module.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

test('Ranger final balance has no remaining active preview overrides', () => {
  assert.equal(activePatchPreview, null);
  assert.deepEqual(withActivePatchPreview(rangerProfession).patchOverviewFor({}, []), []);
  assert.equal(rangerCatalog.traits.find((trait) => trait.id === TRAIT.APEX_PREDATOR).name, 'Apex Predator');
});

test('Unleashed Savage Shock Wave caps conditions and substitutes the maximum for defiance', () => {
  const skill = rangerCatalog.skillsById.get(ID.UNLEASHED_SAVAGE_SHOCK_WAVE);
  const [rule] = skill.modifiers;
  assert.equal(skill.modifiers.length, 1);
  const factor = (defiant, conditions) =>
    rule.factor(
      { catalog: rangerCatalog, config: { target: { defiant, conditions } }, time: 0 },
      null,
      rule.parameters
    );
  assert.equal(factor(false, {}), 1);
  assert.equal(factor(false, { Bleeding: 25 }), 1.04);
  assert.equal(factor(false, { Bleeding: 1, Burning: 1, Poisoned: 1, Chilled: 1, Crippled: 1, Weakness: 1 }), 1.2);
  assert.equal(factor(true, {}), 1.2);
  assert.equal(factor(true, { Bleeding: 25 }), 1.2);
});

test('Poison Volley gains its extension from impairment without requiring defiance', () => {
  for (const impaired of [false, true]) {
    const result = runRanger([ID.POISON_VOLLEY, { type: 'wait', durationMs: 1000 }], {
      primaryWeapon: 'Shortbow',
      selectedTraitIds: [],
      target: { armor: 2597, defiant: false, conditions: impaired ? { Crippled: 1 } : {} }
    });
    assert.deepEqual(result.warnings, []);
    const poison = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillId === ID.POISON_VOLLEY && event.condition === 'Poisoned'
    );
    assert.equal(poison.effectiveDuration, impaired ? 9 : 7);
  }
});

test('Bountiful Hunter counts boon types up to five rather than boon stacks', () => {
  const rule = rangerCoreModule.modifiers.modifierRules.find((entry) => entry.id === 'ranger.bountiful-hunter-player');
  const factor = (boons) => rule.factor({ catalog: rangerCatalog, config: { boons }, time: 0 });
  assert.equal(factor({ might: 25 }), 1.02);
  assert.equal(
    factor({ might: 25, fury: true, quickness: true, alacrity: true, regeneration: true, vigor: true }),
    1.1
  );
});
