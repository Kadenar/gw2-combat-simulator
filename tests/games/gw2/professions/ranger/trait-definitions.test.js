import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { applyRangerBuildAttributeRules } from '#gw2/professions/ranger/build/attributes.js';
import { createRangerBuildDefaults } from '#gw2/professions/ranger/build/build.js';
import { rangerCatalog, rangerNativeModules } from '#gw2/professions/ranger/catalog.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';

// Native ownership follows the trait line even when an elite invokes its behavior explicitly.
test('Ranger registers one canonical owner for cross-specialization traits', () => {
  const owners = new Map();
  for (const module of rangerNativeModules) {
    for (const definition of module.traitDefinitions) {
      assert.equal(owners.has(definition.id), false, definition.name);
      owners.set(definition.id, module.id);
    }
  }

  for (const id of [TRAIT.BESTIAL_RAGE, TRAIT.GO_FOR_THE_EYES, TRAIT.WILTING_STRIKE, TRAIT.LOUD_WHISTLE])
    assert.equal(owners.get(id), 'Core');
  assert.equal(owners.get(TRAIT.NATURAL_FORTITUDE), 'Untamed');
});

// Each call resolves the supplied patch and selected weapon; disabling a trait does not contaminate later calls.
test('Ranger trait build callbacks use patched values and isolate disabled-trait previews', () => {
  const calculate = createCalculateAttributes(applyRangerBuildAttributeRules, rangerProfession.attributeContributions);
  const build = createRangerBuildDefaults();
  build.specializations = [{ name: 'Wilderness Survival', traits: '3-1-1' }];
  build.weapons = ['Dagger', 'Torch'];
  build.alternateWeapons = ['Longbow', ''];
  const catalog = applyBalanceProfilePatch(rangerCatalog, {
    balanceProfiles: {
      [TRAIT.AMBIDEXTERITY]: {
        fields: { weaponAttributeBonus: { from: 240, to: 300 }, attributeBonus: { from: 120, to: 60 } }
      }
    }
  });
  const amount = (weaponSet, disabled, context) =>
    calculate(build, [], weaponSet, disabled, null, context).attributes['Condition Damage'].final;
  const context = { catalog };
  assert.equal(amount(1, null, context) - amount(1, 'Ambidexterity', context), 300);
  assert.equal(amount(2, null, context) - amount(2, 'Ambidexterity', context), 60);
  assert.equal(amount(1, null) - amount(1, 'Ambidexterity'), 240);
  assert.equal(rangerCatalog.balanceProfilesById.get(TRAIT.AMBIDEXTERITY).weaponAttributeBonus, 240);
});
