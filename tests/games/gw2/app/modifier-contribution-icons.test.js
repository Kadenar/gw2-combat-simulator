import assert from 'node:assert/strict';
import test from 'node:test';

import { TARGET_CONDITION_GROUPS } from '#gw2/app/build/panels/assumptions.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { FOOD_DATA, NOURISHMENT_ICON } from '#gw2/platform/equipment/consumables/food.js';
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';

const app = {
  analysis: {
    needsPatchComparison: () => false,
    state: {
      buildRevision: 0,
      resultRevision: 0,
      simulationStatus: 'idle',
      simulationError: '',
      patchComparison: null,
      results: { procSteps: [] }
    }
  },
  attributeData: { activeTraits: [] },

  activeCatalog: { skills: [] }
};

const SIMULATION_EFFECTS = [
  'might',
  'fury',
  'quickness',
  'alacrity',
  'protection',
  'resolution',
  'regeneration',
  'swiftness',
  'vigor',
  'aegis',
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
  'Crippled',
  'Immobilized',
  'Fear',
  'Taunt'
];

test('every configurable boon and condition has a canonical icon', () => {
  // Build controls must address the same condition keys used by runtime queries and result icons.
  for (const name of TARGET_CONDITION_GROUPS.flatMap((group) => group.conditions)) {
    assert.equal(name, canonicalTargetConditionName(name));
    assert.ok(MODIFIER_EFFECT_ICONS[name]);
  }

  assert.deepEqual(
    SIMULATION_EFFECTS.filter((name) => !MODIFIER_EFFECT_ICONS[name]),
    []
  );
  assert.match(MODIFIER_EFFECT_ICONS.Blindness, /102837\.png$/);
  assert.match(MODIFIER_EFFECT_ICONS.Immobilized, /102844\.png$/);
});

test('common modifier contributions use their canonical icons', () => {
  assert.equal(
    resultSkillIcon(app, { id: 'opaque-might-row', boonId: 'might', name: 'Might contribution' }),
    MODIFIER_EFFECT_ICONS.might
  );
  assert.equal(
    resultSkillIcon(app, { id: 'opaque-fury-row', boonId: 'fury', name: 'Fury contribution' }),
    MODIFIER_EFFECT_ICONS.fury
  );
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
