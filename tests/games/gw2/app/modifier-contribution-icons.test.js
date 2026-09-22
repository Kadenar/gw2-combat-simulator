import assert from 'node:assert/strict';
import test from 'node:test';

import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';

const app = {
  attributeData: { activeTraits: [] },
  results: { procSteps: [] },
  skillByName: new Map(),
  skills: []
};

const SIMULATION_EFFECTS = [
  'Might',
  'Fury',
  'Quickness',
  'Alacrity',
  'Protection',
  'Resolution',
  'Regeneration',
  'Swiftness',
  'Vigor',
  'Aegis',
  'Burning',
  'Bleeding',
  'Torment',
  'Confusion',
  'Poisoned',
  'Vulnerability',
  'Weakness',
  'Blindness',
  'Slow',
  'Chilled',
  'Cripple',
  'Immobilize',
  'Fear',
  'Taunt'
];

test('every configurable boon and condition has a canonical icon', () => {
  assert.deepEqual(
    SIMULATION_EFFECTS.filter((name) => !MODIFIER_EFFECT_ICONS[name]),
    []
  );
  assert.match(MODIFIER_EFFECT_ICONS.Blindness, /102837\.png$/);
  assert.match(MODIFIER_EFFECT_ICONS.Immobilize, /102844\.png$/);
});

test('common modifier contributions use their canonical icons', () => {
  assert.equal(resultSkillIcon(app, { id: 'Boon:Might', name: 'Might' }), MODIFIER_EFFECT_ICONS.Might);
  assert.equal(resultSkillIcon(app, { id: 'Boon:Fury', name: 'Fury' }), MODIFIER_EFFECT_ICONS.Fury);
  assert.equal(
    resultSkillIcon(app, {
      id: 'Target:Vulnerability',
      name: 'Vulnerability'
    }),
    MODIFIER_EFFECT_ICONS.Vulnerability
  );
  assert.equal(resultSkillIcon(app, { id: 'Sigil:Force', name: 'Sigil of Force' }), SIGIL_DATA.Force.icon);
  assert.equal(
    resultSkillIcon(app, {
      id: 'Sigil:Accuracy',
      name: 'Sigil of Accuracy'
    }),
    SIGIL_DATA.Accuracy.icon
  );
  assert.equal(
    resultSkillIcon(app, {
      id: 'Food:Salsa Eggs Benedict',
      name: 'Food: Nourishment'
    }),
    NOURISHMENT_ICON
  );
  assert.equal(
    resultSkillIcon(app, {
      id: 'Food:Ghost Pepper Popper',
      name: 'Food: Ghost Pepper Popper'
    }),
    FOOD_DATA['Ghost Pepper Popper'].icon
  );
});
