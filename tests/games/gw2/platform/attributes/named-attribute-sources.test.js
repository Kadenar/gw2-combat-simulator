import assert from 'node:assert/strict';
import test from 'node:test';

import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { attributeContext } from '#gw2/platform/attributes/evaluation.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { catalystAttributePool } from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';
import { ENGINEER_SKILL_IDS } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { mechanistAttributes } from '#gw2/professions/engineer/specializations/mechanist/attributes.js';
import { createTestLiveEffects, grantTestEffect } from '#tests/helpers/live-effects.js';

// Named sources retain build facts across samples while observing weapon changes and live grants separately.
function facts(family, specialization, names, options = {}) {
  const config = {
    specialization,
    selectedTraitIds: names.map((name) => family.catalog.traits.find((trait) => trait.name === name).id),
    selectedSkillIds: [],
    attributeInputs: baseAttributeInputs({ conditionDamage: 1000 }, { conditionDamage: 500, toughness: 2000 }),
    ...options
  };
  const profession = family.runtimeFor(config);
  return attributeContext(
    { config, profession, query: createGw2CombatQuery({ config, profession }), time: 0 },
    { catalog: profession.catalog, modifierRulesById: new Map() }
  );
}

test('Catalyst source follows weapon sets and isolates each query and detached preview', () => {
  const context = facts(elementalistProfession, 'Catalyst', ['Burning Rage', 'Strength of Stone']);
  const first = catalystAttributePool(context);
  assert.equal(first.conditionDamage, 1280);
  assert.equal(catalystAttributePool({ ...context, runtime: { activeWeaponSet: 2 } }).conditionDamage, 880);
  assert.equal(catalystAttributePool(context).conditionDamage, 1280);
  // A caller's changes to its result must not alter the equipment source or later samples.
  first.conditionDamage = 0;
  assert.equal(catalystAttributePool(context).conditionDamage, 1280);
  assert.equal(catalystAttributePool(facts(elementalistProfession, 'Catalyst', [])).conditionDamage, 1000);

  const preview = { ...context, query: undefined, traits: new Set() };
  assert.equal(catalystAttributePool(preview).conditionDamage, 1000);
  preview.traits = new Set(context.config.selectedTraitIds);
  assert.equal(catalystAttributePool(preview).conditionDamage, 1280);
  preview.config = { ...preview.config, startingWeaponSet: 2 };
  assert.equal(catalystAttributePool(preview).conditionDamage, 880);
  preview.config.attributeInputs = baseAttributeInputs({ conditionDamage: 200 }, { conditionDamage: 300 });
  assert.equal(catalystAttributePool(preview).conditionDamage, 580);
});

// Equipment source admission excludes sigils and computed bonuses; only Condition Damage admits utility output.
test('Catalyst selects equipment sources without scaling excluded or already-computed bonuses', () => {
  const attributeInputs = baseAttributeInputs();
  const sources = {
    base: 1000,
    gear: 200,
    runes: 30,
    infusions: 4,
    food: 50,
    jadeBotCore: 60,
    utility: 70,
    traits: 800,
    sigils: 900,
    reinforcedArmor: 100,
    fractalPotions: 110,
    final: 3324
  };
  attributeInputs.weaponSets[0].sources = {
    Power: { ...sources },
    'Condition Damage': { ...sources },
    Vitality: { ...sources }
  };
  const context = facts(elementalistProfession, 'Catalyst', [], { attributeInputs });
  const pool = catalystAttributePool(context);
  assert.equal(pool.power, 1344);
  assert.equal(pool.conditionDamage, 1414);
  assert.equal(pool.vitality, 1344);
  pool.power = 0;
  assert.equal(catalystAttributePool(context).power, 1344);
  assert.deepEqual(attributeInputs.weaponSets[0].sources.Power, sources);
});

test('mech inheritance tracks its own Might through grants, expiry and weapon changes', () => {
  const context = facts(
    engineerProfession,
    'Mechanist',
    ['No Scope', 'Energy Amplifier', 'Chemical Rounds', 'Mech Frame: Conductive Alloys'],
    {
      boons: { might: 24, fury: true, regeneration: true }
    }
  );
  context.event = { type: 'damage', actorType: 'summon', metadata: { engineerMech: true } };
  const grants = [];
  context.runtime = { activeWeaponSet: 1, liveEffects: createTestLiveEffects([['might', grants]]) };
  const sample = (input = context) => mechanistAttributes(input)[0].transforms[0].attributes;
  const base = sample();
  assert.equal(base.power, 1500);
  assert.equal(base.conditionDamage, 1120);
  assert.equal(base.ferocity, 0);
  assert.equal(base.healingPower, 0);
  grantTestEffect(context.runtime.liveEffects, {
    kind: 'might',
    at: 0,
    expiresAt: 2,
    stacks: 3,
    resolvedAudience: { includesSelf: true }
  });
  assert.equal(sample().power, base.power);
  grantTestEffect(context.runtime.liveEffects, {
    kind: 'might',
    at: 0,
    expiresAt: 2,
    stacks: 3,
    resolvedAudience: { includesSummons: true, companionIds: ['engineer.mech'] }
  });
  assert.equal(sample().conditionDamage, 1210);
  assert.equal(sample().power, 1590);
  const shift = { ...context, config: { ...context.config, selectedSkillIds: [ENGINEER_SKILL_IDS.SHIFT_SIGNET] } };
  assert.equal(sample(shift).power, base.power + 25 * 30);
  context.time = 2.000001;
  assert.equal(sample().conditionDamage, 1120);
  context.weaponSet = context.runtime.activeWeaponSet = 2;
  assert.equal(sample().conditionDamage, 620);
  context.weaponSet = context.runtime.activeWeaponSet = 1;
  assert.equal(sample().conditionDamage, 1120);
  assert.equal(base.conditionDamage, 1120);

  const separate = facts(engineerProfession, 'Mechanist', ['Mech Frame: Conductive Alloys']);
  separate.event = context.event;
  assert.equal(sample(separate).conditionDamage, 1000);
});

// Reusing a source within a simulation must not reuse another simulation's balance patch.
for (const [family, profession, specialization, traitName, amount, read] of [
  [elementalistProfession, 'elementalist', 'Catalyst', 'Burning Rage', 180, catalystAttributePool],
  [
    engineerProfession,
    'engineer',
    'Mechanist',
    'Chemical Rounds',
    120,
    (context) => mechanistAttributes(context)[0].transforms[0].attributes
  ]
]) {
  test(`${specialization} named source isolates patched tuning between queries`, () => {
    const id = family.catalog.traits.find((trait) => trait.name === traitName).id;
    const patched = withPatchPreview(family, {
      id: 'source-preview',
      label: 'Source preview',
      professions: {
        [profession]: { balanceProfiles: { [id]: { fields: { 'attributeBonuses.conditionDamage': amount * 2 } } } }
      }
    });
    const sample = (patchId) => {
      const context = facts(patched, specialization, [traitName], { patchId });
      context.event = { type: 'damage', actorType: 'summon', metadata: { engineerMech: true } };
      return context;
    };

    const current = sample('current');
    const preview = sample('source-preview');
    // Identical equipment seeds must not cause cached sources to reuse another patch's trait values.
    preview.config.attributeInputs = current.config.attributeInputs;
    const base = read(current).conditionDamage;
    assert.equal(read(preview).conditionDamage - base, specialization === 'Mechanist' ? amount / 2 : amount);
    assert.equal(read(current).conditionDamage, base);
  });
}
