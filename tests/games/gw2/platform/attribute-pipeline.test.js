import assert from 'node:assert/strict';
import test from 'node:test';
import { baseAttributeInputs, attributeSeed, validateAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { attributeContext, resolveAttributeContributions } from '#gw2/platform/builds/attribute-evaluation.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

const families = {};
for (const name of [
  'elementalist',
  'engineer',
  'guardian',
  'mesmer',
  'necromancer',
  'ranger',
  'revenant',
  'thief',
  'warrior'
]) {
  const module = await import(`#gw2/professions/${name}/profession.js`);
  families[name] = { family: module[`${name}Profession`], modules: module[`${name}NativeModules`] };
}

// The previously divergent cases share one declaration evaluator and immutable conversion inputs.
for (const [name, specialization, traits, extra, key, expected] of [
  ['elementalist', 'Core', ['Ferocious Winds'], {}, 'ferocity', 70],
  ['engineer', 'Core', ['Compounding Chemicals'], {}, 'concentration', 240],
  ['guardian', 'Core', ['Force of Will', 'Power of the Virtuous'], {}, 'conditionDamage', 91],
  ['mesmer', 'Virtuoso', ['Quiet Intensity'], { vitality: 1005 }, 'ferocity', 101],
  ['necromancer', 'Harbinger', ['Spiteful Fortitude', 'Alchemic Vigor', 'Dark Gunslinger'], {}, 'expertise', 124],
  ['ranger', 'Untamed', ['Natural Fortitude'], {}, 'vitality', 1240],
  ['revenant', 'Core', ['Versed in Stone'], {}, 'power', 1130],
  ['thief', 'Specter', ['Second Opinion'], { conditionDamage: 1000 }, 'healingPower', 83],
  ['warrior', 'Core', ['Forceful Greatsword', 'Great Fortitude'], {}, 'ferocity', 112]
])
  test(`${name}: ordinary attributes agree with declarations and repeated queries`, () => {
    const { family } = families[name];
    const selectedTraitIds = traits.map((name) => {
      const trait = family.catalog.traits.find((trait) => trait.name === name);
      assert.ok(trait, name);
      return trait.id;
    });
    const config = {
      specialization,
      selectedTraitIds,
      selectedSkillIds: [],
      primaryWeapon: name === 'thief' ? 'Scepter' : 'Greatsword',
      secondaryWeapon: 'Dagger',
      attributeInputs: baseAttributeInputs(extra),
      boons: {}
    };
    const frozen = structuredClone(config.attributeInputs);
    const runtime = family.runtimeFor(config);
    const query = createGw2CombatQuery({ profession: runtime, config, skillOnCooldown: () => false });
    const first = query.statsAt(0);
    assert.equal(first[key], expected);
    assert.deepEqual(query.statsAt(0), first);
    assert.deepEqual(config.attributeInputs, frozen);
    const context = attributeContext(
      { config, time: 0, catalog: runtime.catalog },
      { catalog: runtime.catalog, modifierRulesById: new Map() }
    );
    const declared = resolveAttributeContributions(
      attributeSeed(config).conversionPool,
      family.attributeContributions(context)
    );
    const label = {
      ferocity: 'Ferocity',
      concentration: 'Concentration',
      conditionDamage: 'Condition Damage',
      expertise: 'Expertise',
      vitality: 'Vitality',
      power: 'Power',
      healingPower: 'Healing Power'
    }[key];
    assert.equal(first[key], (attributeSeed(config).commonTotals[key] ?? 0) + (declared.attributes[label] ?? 0));
  });

// Every Core/elite configuration survives the same worker serialization and resource preparation boundary.
for (const [name, { family, modules }] of Object.entries(families))
  test(`${name}: all modules accept serialized common seeds`, () => {
    for (const module of modules) {
      const config = JSON.parse(
        JSON.stringify({
          specialization: module.id,
          selectedTraitIds: [],
          selectedSkillIds: [],
          attributeInputs: baseAttributeInputs({ power: 1200 }, { power: 1700 })
        })
      );
      const runtime = family.runtimeFor(config);
      assert.doesNotThrow(() => structuredClone(runtime.createState(config)), module.id);
      const query = createGw2CombatQuery({ profession: runtime, config, skillOnCooldown: () => false });
      assert.equal(query.statsAt(0).power, 1200, module.id);
      assert.equal(query.statsAt(0, null, { activeWeaponSet: 2 }).power, 1700, module.id);
    }
  });

test('canonical attribute inputs reject missing sets and non-finite conversion values', () => {
  assert.throws(() => validateAttributeInputs({ weaponSets: [] }), /two weapon-set/);
  assert.throws(() => baseAttributeInputs({ power: NaN }), /finite/);
  const input = baseAttributeInputs();
  input.weaponSets[0].conversionPool.Power = Infinity;
  assert.throws(() => validateAttributeInputs(input), /finite/);
});

// Temporary Might and a weapon swap cannot change the declared conversion's input policy.
test('ordinary conversions use the active common pool without consuming Might or another conversion', () => {
  const family = families.necromancer.family;
  const selectedTraitIds = ['Spiteful Fortitude', 'Alchemic Vigor', 'Dark Gunslinger'].map(
    (name) => family.catalog.traits.find((trait) => trait.name === name).id
  );
  const config = {
    specialization: 'Harbinger',
    selectedTraitIds,
    attributeInputs: baseAttributeInputs({ power: 1500 }, { power: 2500 }),
    boons: { might: 25 }
  };
  const query = createGw2CombatQuery({ profession: family.runtimeFor(config), config });
  const first = query.statsAt(0);
  const second = query.statsAt(0, null, { activeWeaponSet: 2 });
  assert.equal(first.power, 2250);
  assert.equal(second.power, 3250);
  assert.equal(first.vitality, 1240 + Math.round(1500 * 0.1));
  assert.equal(second.vitality, 1240 + Math.round(2500 * 0.1));
  assert.equal(first.expertise, 124);
  assert.equal(second.expertise, 124);
});

// Repeated queries at one timestamp must observe accepted cooldown changes without mutating the seed.
test('signet suppression and recovery reevaluate an unchanged common seed', () => {
  const family = families.guardian.family;
  const signet = family.catalog.skills.find((skill) => skill.name === 'Bane Signet');
  const config = { selectedSkillIds: [signet.id], attributeInputs: baseAttributeInputs() };
  let suppressed = false;
  const query = createGw2CombatQuery({
    profession: family.runtimeFor(config),
    config,
    skillOnCooldown: () => suppressed
  });
  assert.equal(query.statsAt(0).power, 1180);
  suppressed = true;
  assert.equal(query.statsAt(0).power, 1000);
  suppressed = false;
  assert.equal(query.statsAt(0).power, 1180);
  assert.equal(attributeSeed(config).commonTotals.power, 1000);
});

// Detached resource initialization consumes the selected patch's evaluated Vitality before constructing state.
test('Necromancer resource preparation uses patched attribute declarations once', () => {
  const family = families.necromancer.family;
  const trait = family.catalog.traits.find((trait) => trait.name === 'Alchemic Vigor');
  const patched = withPatchPreview(family, {
    id: 'attribute-resource',
    label: 'Attribute resource',
    professions: { necromancer: { balanceProfiles: { [trait.id]: { fields: { attributeBonus: 500 } } } } }
  });
  const config = {
    patchId: 'attribute-resource',
    specialization: 'Harbinger',
    selectedTraitIds: [trait.id],
    attributeInputs: baseAttributeInputs()
  };
  const runtime = patched.runtimeFor(config);
  const query = createGw2CombatQuery({ profession: runtime, config });
  assert.equal(query.statsAt(0).vitality, 1500);
  const baseline = family
    .runtimeFor({ specialization: 'Harbinger' })
    .createState({ specialization: 'Harbinger', attributeInputs: baseAttributeInputs({ vitality: 1500 }) });
  assert.equal(runtime.createState(config).core.lifeForceCostMultiplier, baseline.core.lifeForceCostMultiplier);
});

test('attribute seeds retain uncapped boon bonuses and reject malformed source breakdowns', () => {
  const family = families.warrior.family;
  const config = { attributeInputs: baseAttributeInputs({ uncappedBoonDurationBonus: 20 }) };
  const query = createGw2CombatQuery({ profession: family.runtimeFor(config), config });
  assert.equal(query.statsAt(0).uncappedBoonDurationBonus, 20);
  const inputs = baseAttributeInputs();
  inputs.weaponSets[0].sources.Power = { gear: Infinity };
  assert.throws(() => validateAttributeInputs(inputs), /finite numeric breakdowns/);
});
