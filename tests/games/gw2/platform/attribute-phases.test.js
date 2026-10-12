import { equipmentAttributeConversions } from '#gw2/platform/builds/attribute-inputs.js';
import { createProfessionBuildAttributeRules } from '#gw2/professions/shared/build-attributes.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { getActiveTraits as getWarriorActiveTraits } from '#gw2/professions/warrior/data/traits-data.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { createWarriorBuildDefaults } from '#gw2/professions/warrior/build/build.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAttributeContributions,
  applyFinalConditionAttributes,
  applyMightAttributes,
  attributeContext,
  resolveAttributeContributions
} from '#gw2/platform/builds/attribute-evaluation.js';
import { attributeSeed, baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

const families = {};
for (const name of ['engineer', 'mesmer', 'revenant', 'thief', 'warrior'])
  families[name] = (await import(`#gw2/professions/${name}/profession.js`))[`${name}Profession`];

// Minimal builds exercise shared phases without saved-rotation or packet-schedule assertions.
function scenario(name, specialization, names = [], options = {}, family = families[name]) {
  const config = {
    specialization,
    selectedTraitIds: names.map((name) => family.catalog.traits.find((trait) => trait.name === name).id),
    selectedSkillIds: [],
    attributeInputs: baseAttributeInputs(),
    ...options
  };
  const profession = family.runtimeFor(config);
  const query = createGw2CombatQuery({ config, profession });
  const facts = attributeContext(
    { config, profession, time: 0 },
    { catalog: profession.catalog, modifierRulesById: new Map() }
  );
  return { family, config, profession, query, facts };
}

// Utility conversions include eligible flat trait grants, but never other conversions or temporary attribute buffs.
test('tuning crystals include flat Expertise grants without chaining converted Expertise', () => {
  const pool = { Precision: 1633, Expertise: 703, Vitality: 1235 };
  const contributions = [
    {
      attributeEffects: [
        { kind: 'flat', to: 'Expertise', amount: 150, feedsConversions: 'all' },
        { kind: 'flat', to: 'Expertise', amount: 70, feedsConversions: 'none' },
        {
          kind: 'conversion',
          from: 'Vitality',
          to: 'Expertise',
          multiplier: 0.13,
          rounding: 'round',
          input: 'eligible'
        }
      ]
    }
  ];
  const resolved = resolveAttributeContributions(
    { conversionPool: pool, conversions: equipmentAttributeConversions('Potent Master Tuning Crystal') },
    contributions
  );
  assert.deepEqual(resolved.utilityAttributes, { 'Condition Damage': 117 });
  assert.equal(resolved.attributes.Expertise, 381);
  assert.deepEqual(pool, { Precision: 1633, Expertise: 703, Vitality: 1235 });
});

// The selected consumable's existing rules determine every source stat; no utility gets a special conversion path.
test('utility conversion corrections cover Precision, Ferocity, Condition Damage, and Vitality', () => {
  const pool = { Power: 1000, Precision: 1000, Ferocity: 0, 'Condition Damage': 1000, Vitality: 1000, Toughness: 1000 };
  for (const [utility, from, amount, to, expected] of [
    ['Superior Sharpening Stone', 'Precision', 180, 'Power', 5],
    ['Superior Sharpening Stone', 'Ferocity', 150, 'Power', 9],
    ['Toxic Tuning Crystal', 'Power', 120, 'Condition Damage', 4],
    ['Toxic Maintenance Oil', 'Condition Damage', 180, 'Concentration', 11],
    ['Magnanimous Tuning Crystal', 'Vitality', 300, 'Condition Damage', 9]
  ]) {
    const contributions = [{ attributeEffects: [{ kind: 'flat', to: from, amount, feedsConversions: 'all' }] }];
    assert.deepEqual(
      resolveAttributeContributions(
        { conversionPool: pool, conversions: equipmentAttributeConversions(utility) },
        contributions
      ).utilityAttributes[to] -
        resolveAttributeContributions({ conversionPool: pool, conversions: equipmentAttributeConversions(utility) }, [])
          .utilityAttributes[to],
      expected
    );
    assert.deepEqual(
      resolveAttributeContributions(
        { conversionPool: pool, conversions: equipmentAttributeConversions() },
        contributions
      ).utilityAttributes,
      {}
    );
  }
});

// Explicit profession exceptions preserve native trait conversions without raising utility consumable bonuses.
test('profession-only Precision feeds trait conversions but not tuning crystals', () => {
  const resolved = resolveAttributeContributions(
    { conversionPool: { Precision: 1000 }, conversions: equipmentAttributeConversions('Toxic Tuning Crystal') },
    [
      {
        attributeEffects: [
          { kind: 'flat', to: 'Precision', amount: 180, feedsConversions: 'profession-only' },
          {
            kind: 'conversion',
            from: 'Precision',
            to: 'Condition Damage',
            multiplier: 0.13,
            rounding: 'round',
            input: 'eligible'
          }
        ]
      }
    ]
  );
  assert.deepEqual(resolved.utilityAttributes, { 'Condition Damage': 30 });
  assert.equal(resolved.attributes['Condition Damage'], 153);
});

// Trait and utility percentages for the same source/destination share one rounding step.
test('Vitality conversion combines trait and crystal before rounding without converting Reinforced Armor', () => {
  const pool = { Vitality: 2356, Toughness: 1000 };
  const effects = [
    { kind: 'flat', to: 'Vitality', amount: 250, feedsConversions: 'all' },
    {
      kind: 'conversion',
      from: 'Vitality',
      to: 'Condition Damage',
      multiplier: 0.07,
      rounding: 'round',
      input: 'eligible'
    }
  ];
  for (const attributeEffects of [effects, [...effects].reverse()]) {
    const contributions = [{ attributeEffects }];
    // Utility is resolved from its seed declarations together with the trait conversion.
    const result = applyAttributeContributions(
      { conversionPool: pool, conversions: equipmentAttributeConversions('Magnanimous Tuning Crystal') },
      { vitality: 2356, conditionDamage: 0 },
      contributions
    );
    assert.equal(result.conditionDamage, 291); // round(2606 * (7% + 3%)) + 30
    assert.equal(result.vitality, 2736);
    assert.deepEqual(pool, { Vitality: 2356, Toughness: 1000 });
  }
});

// Different source stats remain separate conversion groups, even when their output attribute matches.
test('conversion rounding groups matching source and destination only', () => {
  const conversion = (from, multiplier) => ({
    kind: 'conversion',
    from,
    to: 'Ferocity',
    multiplier,
    rounding: 'round',
    input: 'common'
  });
  const resolved = resolveAttributeContributions(
    { conversionPool: { Power: 2606, Precision: 2606 }, conversions: equipmentAttributeConversions() },
    [{ attributeEffects: [conversion('Power', 0.07), conversion('Power', 0.03), conversion('Precision', 0.07)] }]
  );
  assert.equal(resolved.attributes.Ferocity, 443); // round(260.6) + round(182.42)
  assert.deepEqual(resolved.utilityAttributes, {});
});

// Reinforced Armor is universal player Vitality, applied after conversions so no profession gains conversion stats from it.
test('Reinforced Armor raises live Vitality without feeding Strength of Shadows or changing seeds', () => {
  for (const name of Object.keys(families)) {
    const probe = scenario(
      name,
      name === 'thief' ? 'Specter' : 'Core',
      name === 'thief' ? ['Strength of Shadows'] : [],
      {
        attributeInputs: baseAttributeInputs({ vitality: 1235 })
      }
    );
    const live = probe.query.statsAt(0);
    assert.equal(live.vitality, 1297);
    assert.equal(live.expertise, name === 'thief' ? 161 : 0);
    assert.equal(attributeSeed(probe.config).conversionPool.Vitality, 1235);
    assert.equal(attributeSeed(probe.config).commonTotals.vitality, 1235);
  }
});

// Generic Vitality conversion admits eligible flats but excludes merged buffs, profession exceptions and converted stats.
test('Reinforced Armor excludes final-only Vitality and other conversion results', () => {
  const result = applyAttributeContributions(
    { conversionPool: { Vitality: 1000, Power: 1000 }, conversions: equipmentAttributeConversions() },
    { vitality: 1000 },
    [
      {
        attributeEffects: [
          { kind: 'flat', to: 'Vitality', amount: 300, feedsConversions: 'all' },
          { kind: 'flat', to: 'Vitality', amount: 150, feedsConversions: 'none' },
          { kind: 'flat', to: 'Vitality', amount: 180, feedsConversions: 'profession-only' },
          { kind: 'conversion', from: 'Power', to: 'Vitality', multiplier: 0.1, rounding: 'round', input: 'eligible' }
        ]
      }
    ]
  );
  assert.equal(result.vitality, 1795); // 1000 + 300 + 150 + 180 + 100 + 65
});

// Reinforced Armor and a self-converting utility share the same rounding group without recursively converting each other.
test('Reinforced Armor rounds with Vitality-to-Vitality utility conversion', () => {
  const result = applyAttributeContributions(
    { conversionPool: { Vitality: 1044 }, conversions: equipmentAttributeConversions('Leviathan Tempering Oil') },
    { vitality: 1044 },
    []
  );
  assert.equal(result.vitality, 1128); // 1044 + round(1044 * (3% + 5%))
});

test('conversion attribution sums jointly across traits, utility, and reinforcement without mutating seeds', () => {
  // All three buckets share a rounding boundary, regardless of declaration order or a sparse initial result.
  const pool = Object.freeze({ Vitality: 1044 });
  const conversions = Object.freeze(equipmentAttributeConversions('Leviathan Tempering Oil').map(Object.freeze));
  const effects = Object.freeze([
    Object.freeze({
      kind: 'conversion',
      from: 'Vitality',
      to: 'Vitality',
      multiplier: 0.045,
      input: 'common',
      rounding: 'round'
    }),
    Object.freeze({ kind: 'flat', to: 'Vitality', amount: 150, feedsConversions: 'none' })
  ]);
  for (const attributeEffects of [effects, [...effects].reverse()]) {
    for (const declarations of [conversions, [...conversions].reverse()]) {
      const seed = Object.freeze({ conversionPool: pool, conversions: declarations });
      const resolved = resolveAttributeContributions(seed, [{ attributeEffects }]);
      const total =
        resolved.attributes.Vitality +
        resolved.utilityAttributes.Vitality +
        resolved.reinforcedArmorAttributes.Vitality;
      assert.equal(total, 150 + Math.round(1044 * (0.045 + 0.03 + 0.05)));
      assert.equal(applyAttributeContributions(seed, {}, [{ attributeEffects }]).vitality, total);
    }
  }

  assert.equal(pool.Vitality, 1044);
});

test('shared conversion pools separate profession-only grants in either declaration order', () => {
  // An all-eligible grant before and after a profession exception must update each pool once without alias leakage.
  const seed = Object.freeze({
    conversionPool: Object.freeze({ Power: 1000, Vitality: 1000 }),
    conversions: Object.freeze([
      { source: 'utility', from: 'Power', to: 'Condition Damage', multiplier: 0.03, rounding: 'round' },
      ...equipmentAttributeConversions()
    ])
  });
  const grants = [
    { kind: 'flat', to: 'Power', amount: 100, feedsConversions: 'all' },
    { kind: 'flat', to: 'Power', amount: 180, feedsConversions: 'profession-only' },
    { kind: 'flat', to: 'Power', amount: 50, feedsConversions: 'all' },
    { kind: 'flat', to: 'Power', amount: 500, feedsConversions: 'none' }
  ];
  const conversions = [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Condition Damage',
      multiplier: 0.1,
      rounding: 'round',
      input: 'eligible'
    },
    { kind: 'conversion', from: 'Power', to: 'Ferocity', multiplier: 0.1, rounding: 'round', input: 'common' }
  ];
  for (const ordered of [grants, [...grants].reverse(), [grants[1], grants[0], grants[2], grants[3]]]) {
    const resolved = resolveAttributeContributions(seed, [{ attributeEffects: [...ordered, ...conversions] }]);
    assert.deepEqual(resolved.attributes, { Power: 830, 'Condition Damage': 133, Ferocity: 100 });
    assert.deepEqual(resolved.utilityAttributes, { 'Condition Damage': 35 });
    assert.deepEqual(resolved.reinforcedArmorAttributes, { Vitality: 50 });
  }

  assert.deepEqual(seed.conversionPool, { Power: 1000, Vitality: 1000 });
});

test('Might applies baseline and Notoriety together while unbuffed declarations exclude both', () => {
  const probe = scenario('revenant', 'Core', ['Notoriety'], { boons: { might: 25 } });
  const contributions = probe.family.attributeContributions(probe.facts);
  assert.deepEqual(
    resolveAttributeContributions({ conversionPool: {}, conversions: equipmentAttributeConversions() }, contributions)
      .attributes,
    {}
  );
  const seed = probe.config.attributeInputs.weaponSets[0].commonTotals;
  const build = applyAttributeContributions(attributeSeed(probe.config), seed, contributions);
  assert.equal(build.conditionDamage, 0);
  const live = probe.query.statsAt(0);
  assert.equal(live.power, 2000);
  assert.equal(live.conditionDamage, 500);
  const preview = createGw2CombatQuery({
    config: probe.config,
    profession: probe.profession,
    attributePreviewPlayerHealthFraction: 0.25
  }).statsAt(0);
  assert.deepEqual(preview, live);
  const buffed = applyMightAttributes(build, 25, contributions);
  assert.equal(buffed.power, live.power);
  assert.equal(buffed.conditionDamage, live.conditionDamage);
  assert.equal(seed.power, 1000);
  assert.equal(seed.conditionDamage, 0);
  const pet = {
    type: 'damage',
    actorType: 'summon',
    independentSummonStrike: true,
    summonOwner: 'pet',
    summonBasePower: 1200,
    summonBaseConditionDamage: 100
  };
  const runtime = {
    boons: new Map([
      [
        'might',
        [
          {
            at: 0,
            expiresAt: 2,
            stacks: 3,
            resolvedAudience: { includesSelf: false, includesSummons: true, companionIds: ['pet'] }
          }
        ]
      ]
    ])
  };
  assert.equal(probe.query.statsAt(1, pet, runtime).power, 1290);
  assert.equal(probe.query.statsAt(1, pet, runtime).conditionDamage, 190);
  assert.equal(probe.query.statsAt(2, pet, runtime).power, 1200);
});

for (const [name, trait, kind, stat, perStack, maximum] of [
  ['mesmer', "Fencer's Finesse", 'fencer', 'ferocity', 15, 10],
  ['warrior', 'Furious', 'furious-surge', 'conditionDamage', 15, 25]
]) {
  // Supplied grants are recipient-owned state; each independent query keeps its own fixed build selection.
  test(`${trait} accepted grants observe recipient, same-time updates, cap and expiry`, () => {
    const selected = scenario(name, 'Core', [trait]);
    const unselected = scenario(name, 'Core');
    const grants = [];
    const runtime = { buffs: new Map([[kind, grants]]) };
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], 0);
    grants.push({ at: 1, expiresAt: 5, stacks: 2, resolvedAudience: { includesSelf: true } });
    grants.push({
      at: 1,
      expiresAt: 5,
      stacks: 8,
      resolvedAudience: { includesSelf: false, includesSummons: true, companionIds: ['other'] }
    });
    assert.equal(selected.query.statsAt(1, null, runtime)[stat], 2 * perStack);
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], 2 * perStack);
    grants.push({ at: 1, expiresAt: 5, stacks: 1, resolvedAudience: { includesSelf: true } });
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], 3 * perStack);
    grants.push({ at: 1, expiresAt: 5, stacks: 100, resolvedAudience: { includesSelf: true } });
    assert.equal(unselected.query.statsAt(1, null, runtime)[stat], maximum * perStack);
    const before = structuredClone(runtime);
    assert.equal(unselected.query.statsAt(5, null, runtime)[stat], 0);
    assert.deepEqual(runtime, before);
  });
}

test('accepted Insight remains until its exclusive expiry with no selected trait', () => {
  const probe = scenario('warrior', 'Spellbreaker');
  const expiries = [2, 3];
  const runtime = {
    profession: { specialization: { kind: 'Spellbreaker', state: { attackerInsightExpiries: expiries } } }
  };
  assert.equal(probe.query.statsAt(1, null, runtime).power, 1100);
  expiries.push(4);
  assert.equal(probe.query.statsAt(1, null, runtime).power, 1150);
  assert.equal(probe.query.statsAt(2, null, runtime).power, 1100);
  assert.equal(probe.query.statsAt(4, null, runtime).power, 1000);
  assert.deepEqual(expiries, [2, 3, 4]);
});

test('ordinary conversions, accumulated scaling, actor projection and final replacement have distinct inputs', () => {
  const probe = scenario('engineer', 'Core');
  const facts = { ...probe.facts, event: { type: 'condition', condition: 'Bleeding', actorType: 'player' } };
  const declarations = [
    {
      attributeEffects: [
        { kind: 'flat', to: 'Power', amount: 100, feedsConversions: 'none' },
        { kind: 'conversion', from: 'Power', to: 'Ferocity', multiplier: 0.1, input: 'common', rounding: 'none' }
      ],
      // Projection must follow scaling even when listed first.
      transforms: [
        { kind: 'project', replace: false, attributes: { power: 1800 } },
        { kind: 'scale', factor: 1.2 }
      ],
      finalCondition: { condition: 'Bleeding', powerMultiplier: 0.5 },
      traitDurations: { 'Boon Duration': 10 },
      uncappedBoonDuration: 20
    }
  ];
  const initial = { power: 1000, ferocity: 0 };
  const ordinary = applyAttributeContributions(
    attributeSeed(probe.config),
    applyMightAttributes(initial, 10, []),
    declarations
  );
  assert.equal(ordinary.power, 1800);
  assert.equal(ordinary.ferocity, 120);
  assert.equal(ordinary.boonDurationBonus, 10);
  assert.equal(ordinary.uncappedBoonDurationBonus, 20);
  const final = applyFinalConditionAttributes(facts, { ...ordinary, conditionDamage: 300 }, declarations);
  assert.equal(final.conditionDamage, 900);
  assert.equal(
    applyFinalConditionAttributes(
      { ...facts, event: { ...facts.event, actorType: 'summon' } },
      { ...ordinary, conditionDamage: 300 },
      declarations
    ).conditionDamage,
    300
  );
  assert.deepEqual(initial, { power: 1000, ferocity: 0 });
});

// Duration accumulation may reuse its working map, but must never mutate a seed or a shared declaration.
test('duration accumulation preserves input maps and combines aliases and repeated bonuses', () => {
  const initial = Object.freeze({
    conditionDurationBonuses: Object.freeze({ Poisoned: 3 }),
    boonDurationBonuses: Object.freeze({ might: 4 })
  });
  const declarations = [
    Object.freeze({
      traitDurations: Object.freeze({ 'Poison Duration': 10, 'Bleeding Duration': 5, 'Might Duration': 6 })
    }),
    Object.freeze({
      traitDurations: Object.freeze({ 'Poisoned Duration': 2, 'Bleeding Duration': 8, 'Fury Duration': 7 })
    })
  ];
  const first = applyAttributeContributions(
    { conversionPool: {}, conversions: equipmentAttributeConversions() },
    initial,
    declarations
  );
  assert.deepEqual(first.conditionDurationBonuses, { Poisoned: 15, Bleeding: 13 });
  assert.deepEqual(first.boonDurationBonuses, { might: 10, fury: 7 });
  assert.deepEqual(
    applyAttributeContributions(
      { conversionPool: {}, conversions: equipmentAttributeConversions() },
      initial,
      declarations
    ),
    first
  );
  assert.deepEqual(initial.conditionDurationBonuses, { Poisoned: 3 });
});

test('Blood Reaction and Great Fortitude exclude Might and Berserk grants from their conversions', () => {
  const probe = scenario('warrior', 'Berserker', ['Blood Reaction', 'Pinnacle of Strength', 'Great Fortitude'], {
    boons: { might: 25 }
  });
  const runtime = { profession: { specialization: { kind: 'Berserker', state: { berserkActive: true } } } };
  const active = probe.query.statsAt(0, null, runtime);
  assert.equal(active.power, 2300);
  assert.equal(active.conditionDamage, 1140);
  assert.equal(active.ferocity, 340);
  assert.equal(active.vitality, 1150); // Reinforced Armor excludes Great Fortitude's converted Vitality.
  runtime.profession.specialization.state.berserkActive = false;
  assert.equal(probe.query.statsAt(0, null, runtime).ferocity, 220);
});

// Signet readiness and common utility totals change final Power, but cannot feed Blood Reaction.
test('Blood Reaction rounds eligible stats and ignores signet and converted utility Power', () => {
  const inputs = baseAttributeInputs({ power: 1007, precision: 1007 });
  for (const seed of inputs.weaponSets) seed.commonTotals.power += 36;
  const probe = scenario('warrior', 'Berserker', ['Blood Reaction', 'Forceful Greatsword'], {
    attributeInputs: inputs,
    selectedSkillIds: [14404]
  });
  const runtime = { profession: { specialization: { kind: 'Berserker', state: { berserkActive: true } } } };
  for (const signetOnCooldown of [false, true]) {
    const query = createGw2CombatQuery({
      config: probe.config,
      profession: probe.profession,
      skillOnCooldown: () => signetOnCooldown
    });
    const live = query.statsAt(0, null, runtime);
    assert.equal(live.power, 1043 + 120 + 300 + (signetOnCooldown ? 0 : 180));
    assert.equal(live.conditionDamage, 150 + Math.round(1127 * 0.24));
    assert.equal(live.ferocity, Math.round(1007 * 0.24));
  }
});

test('Chemical Rounds declares base-duration eligibility and respects patch tuning without a recharge grant', () => {
  const probe = scenario('engineer', 'Core', ['Chemical Rounds']);
  const id = probe.config.selectedTraitIds[0];
  const multiplier = (event, profession = probe.profession, config = probe.config) =>
    profession.modifyConditionBaseDuration({ profession, config, time: 0, event }, 1);
  for (const event of [{ skillWeapon: 'Pistol' }, { application: { skillWeapon: 'Pistol' } }])
    assert.equal(multiplier(event), 4 / 3);
  assert.equal(multiplier({ skillWeapon: 'Rifle' }), 1);
  assert.equal(multiplier({ skillWeapon: 'Pistol', application: { source: 'Trait' } }), 1);
  assert.equal(multiplier({ skillWeapon: 'Pistol' }, probe.profession, { ...probe.config, selectedTraitIds: [] }), 1);
  const patched = withPatchPreview(probe.family, {
    id: 'chemical-rounds-duration',
    label: 'Chemical Rounds duration',
    professions: { engineer: { balanceProfiles: { [id]: { fields: { conditionDurationMultiplier: 1.5 } } } } }
  });
  const patchedConfig = { ...probe.config, patchId: 'chemical-rounds-duration' };
  assert.equal(multiplier({ skillWeapon: 'Pistol' }, patched.runtimeFor(patchedConfig), patchedConfig), 1.5);
  assert.equal(
    probe.profession.rechargeRules.some((rule) => rule.trait === id),
    false
  );
});

// The panel and live query must supply the same equipment source to specialized conversions.
test('Blood Reaction build and live sources agree for both equipment sets', () => {
  const family = families.warrior;
  const calculate = createCalculateAttributes(
    createProfessionBuildAttributeRules(warriorCatalog, getWarriorActiveTraits),
    family.attributeContributions
  );
  const build = createWarriorBuildDefaults();
  build.specializations = [{ name: 'Berserker', traits: '1-1-1' }];
  build.alternateWeaponPrefixes = ["Assassin's", "Assassin's"];
  const panels = [1, 2].map((set) => calculate(build, [], set));
  const attributeInputs = { weaponSets: panels.map((panel) => panel.attributeSeed) };
  assert.notEqual(
    attributeInputs.weaponSets[0].commonTotals.precision,
    attributeInputs.weaponSets[1].commonTotals.precision
  );
  for (const weaponSet of [1, 2]) {
    const panel = panels[weaponSet - 1];
    const pool = panel.attributeSeed.conversionPool;
    assert.equal(panel.attributes.Ferocity.traits, Math.round(pool.Precision * 0.12));
    assert.equal(panel.attributes['Condition Damage'].traits, Math.round(pool.Power * 0.12));
    const probe = scenario('warrior', 'Berserker', ['Blood Reaction'], {
      attributeInputs,
      startingWeaponSet: weaponSet
    });
    const live = probe.query.statsAt(0);
    assert.equal(live.ferocity, panel.attributes.Ferocity.final);
    assert.equal(live.conditionDamage, panel.attributes['Condition Damage'].final);
    assert.equal(calculate(build, [], weaponSet, 'Blood Reaction').attributes.Ferocity.traits, 0);
  }
});
