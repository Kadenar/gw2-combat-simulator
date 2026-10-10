import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { applyNecromancerBuildAttributeRules } from '#gw2/professions/necromancer/build/attributes.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerNativeModules, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Profile-only and behavior-only traits both register once in their native module.
test('Necromancer trait profiles have a single registered owner across Core and all elites', () => {
  const definitions = necromancerNativeModules.flatMap((module) => module.traitDefinitions);
  assert.equal(new Set(definitions.map(({ id }) => id)).size, definitions.length);
  for (const profile of necromancerProfession.catalog.balanceProfiles.filter(
    ({ profileKind }) => profileKind === 'trait'
  )) {
    assert.equal(
      definitions.filter(
        ({ id, balance, profiles }) =>
          (balance && (balance.id ?? id) === profile.id) || profiles?.some(({ id }) => id === profile.id)
      ).length,
      1,
      profile.name
    );
  }

  for (const id of [TRAIT.TERROR, TRAIT.HERALD_OF_SORROW, TRAIT.SOUL_TWISTING, TRAIT.WIELDERS_BOON]) {
    assert.equal(definitions.filter((trait) => trait.id === id).length, 1);
  }
});

// The preview and raw runtime must consume the same patched flat bonus before Target the Weak converts it.
test('Necromancer trait build contributions preserve patched conversion inputs and selection isolation', () => {
  const family = withPatchPreview(necromancerProfession, {
    id: 'necromancer-trait-owners',
    label: 'Necromancer trait owners',
    professions: { necromancer: { balanceProfiles: { [TRAIT.FURIOUS_DEMISE]: { fields: { attributeBonus: 250 } } } } }
  });
  const calculate = createCalculateAttributes(applyNecromancerBuildAttributeRules, family.attributeContributions);
  const build = { specializations: [{ name: 'Curses', traits: '1-1-1' }] };
  const balance = family.balanceContextFor('necromancer-trait-owners');
  const preview = calculate(build, [], 1, null, null, balance).attributes;
  assert.equal(preview.Precision.traits, 250);
  assert.equal(preview['Condition Damage'].traits, 162);
  const disabled = calculate(build, [], 1, 'Furious Demise', null, balance).attributes;
  assert.equal(disabled.Precision.traits, 0);
  assert.equal(disabled['Condition Damage'].traits, 130);
  const runtime = family.runtimeFor({ specialization: 'Core', patchId: 'necromancer-trait-owners' });
  const seed = {
    power: 1000,
    precision: 1000,
    vitality: 1000,
    conditionDamage: 0,
    expertise: 0,
    ferocity: 0,
    concentration: 0
  };
  const context = {
    catalog: runtime.catalog,
    config: {
      attributeInputs: baseAttributeInputs(seed),
      selectedTraitIds: [TRAIT.FURIOUS_DEMISE, TRAIT.TARGET_THE_WEAK]
    },
    time: 0
  };
  const direct = runtime.modifyAttributes(context, seed);
  assert.equal(direct.precision, 1250);
  assert.equal(direct.conditionDamage, 162);
  assert.equal(
    runtime.modifyAttributes(
      { ...context, config: { attributeInputs: baseAttributeInputs(seed), selectedTraitIds: [] } },
      seed
    ).precision,
    1000
  );
  assert.equal(necromancerProfession.catalog.balanceProfilesById.get(TRAIT.FURIOUS_DEMISE).attributeBonus, 180);
});
