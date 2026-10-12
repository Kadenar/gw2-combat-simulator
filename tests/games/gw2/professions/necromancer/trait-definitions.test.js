import { lifeForcePercent } from '#tests/helpers/necromancer-resource.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { getActiveTraits as getNecromancerActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerNativeModules, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
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
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(necromancerCatalog, getNecromancerActiveTraits),
    family.attributeContributions
  );
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

// Capacity is shared patch tuning, while Flesh selection controls only its minion-backed contribution.
test('Carapace grants and Deadly Strength use the same patched capacity and expiry', () => {
  for (const [maximumStacks, expected] of [
    [30, 30],
    [50, 40],
    [5, 5],
    [0, 0]
  ]) {
    const family = withPatchPreview(necromancerProfession, {
      id: 'carapace-capacity',
      label: 'Carapace capacity',
      professions: {
        necromancer: {
          balanceProfiles: {
            [TRAIT.FLESH_OF_THE_MASTER]: { fields: { maximumStacks } },
            [TRAIT.DARK_DEFENSE]: { fields: { resourceGain: 40 } }
          }
        }
      }
    });
    for (const minionTraitSelected of [false, true]) {
      const config = {
        specialization: 'Core',
        patchId: 'carapace-capacity',
        selectedTraitIds: [
          TRAIT.DARK_DEFENSE,
          TRAIT.DEADLY_STRENGTH,
          ...(minionTraitSelected ? [TRAIT.FLESH_OF_THE_MASTER] : [])
        ]
      };
      const profession = family.runtimeFor(config);
      const result = observeGw2Runtime({ profession, config, rotation: [ID.CONSUME_CONDITIONS] });
      const runtime = observedRuntime(result);
      assert.equal(runtime.profession.core.carapaceExpiries.length, expected);
      assert.deepEqual(result.warnings, []);
      const context = { catalog: profession.catalog, config, runtime, time: runtime.time };
      assert.equal(profession.modifyAttributes(context, { power: 1000 }).power, 1000 + expected * 10);
      const expiry = Math.max(runtime.time, ...runtime.profession.core.carapaceExpiries);
      assert.equal(profession.modifyAttributes({ ...context, time: expiry }, { power: 1000 }).power, 1000);
    }
  }

  assert.equal(necromancerProfession.catalog.balanceProfilesById.get(TRAIT.FLESH_OF_THE_MASTER).maximumStacks, 30);
});

// Soul Comprehension applies its own counted-stack limit to the same capped, live Carapace total as attributes.
test('Soul Comprehension shares timed and selected-minion Carapace while retaining its reward limit', () => {
  for (const [capacity, countedMaximum] of [
    [50, 3],
    [50, 100],
    [5, 100]
  ]) {
    const family = withPatchPreview(necromancerProfession, {
      id: 'carapace-reward',
      label: 'Carapace reward',
      professions: {
        necromancer: {
          balanceProfiles: {
            [TRAIT.FLESH_OF_THE_MASTER]: { fields: { maximumStacks: capacity } },
            [TRAIT.SOUL_COMPREHENSION]: { fields: { maximumStacks: countedMaximum } }
          }
        }
      }
    });
    for (const minionTraitSelected of [false, true]) {
      const config = {
        specialization: 'Core',
        patchId: 'carapace-reward',
        initialResource: 10,
        selectedTraitIds: [TRAIT.SOUL_COMPREHENSION, ...(minionTraitSelected ? [TRAIT.FLESH_OF_THE_MASTER] : [])]
      };
      const native = family.runtimeFor(config);
      const profession = {
        ...native,
        initialize(runtime) {
          native.initialize(runtime);
          runtime.profession.core.carapaceExpiries = [0, 10, 10, 10, 10];
          runtime.profession.core.activeMinions = { [ID.SUMMON_BONE_MINIONS]: 2 };
        }
      };
      const result = observeGw2Runtime({ profession, config, rotation: [ID.DEATH_SHROUD] });
      const available = Math.min(capacity, minionTraitSelected ? 8 : 4);
      assert.equal(
        lifeForcePercent(observedRuntime(result).profession.core.lifeForce),
        10 + Math.min(countedMaximum, available) * 0.5
      );
      assert.deepEqual(result.warnings, []);
    }
  }
});
