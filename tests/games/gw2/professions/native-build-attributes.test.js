import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAttributeEffects } from '#gw2/platform/attributes/calculation.js';
import { baseAttributeInputs, equipmentAttributeConversions } from '#gw2/platform/attributes/inputs.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { createGuardianBuildDefaults } from '#gw2/professions/guardian/build/build.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { createNecromancerBuildDefaults } from '#gw2/professions/necromancer/build/build.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { createRevenantBuildDefaults } from '#gw2/professions/revenant/build/build.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { createThiefBuildDefaults } from '#gw2/professions/thief/build/build.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';

const calculateGuardianAttributes = createCalculateAttributes(
  createProfessionBuildAttributeRules(guardianCatalog),
  guardianProfession.attributeContributions
);
const calculateNecromancerAttributes = createCalculateAttributes(
  createProfessionBuildAttributeRules(necromancerCatalog),
  necromancerProfession.attributeContributions
);
const calculateRevenantAttributes = createCalculateAttributes(
  createProfessionBuildAttributeRules(revenantCatalog),
  revenantProfession.attributeContributions
);
const calculateThiefAttributes = createCalculateAttributes(
  createProfessionBuildAttributeRules(thiefCatalog),
  thiefProfession.attributeContributions
);
const revenantConduitRules = revenantProfession.resolveProfession({
  specialization: 'Conduit'
});

// Isolate one trait contribution on weapon set one without selected skill passives.
function traitDelta(calculate, build, trait, attribute) {
  const withTrait = calculate(build, [], 1).attributes;
  const withoutTrait = calculate(build, [], 1, trait).attributes;

  return withTrait[attribute].final - withoutTrait[attribute].final;
}

// Conversion assertions inspect Vitality before the universal Reinforced Armor bonus.
function conversionVitality(attributes) {
  return attributes.Vitality.final - attributes.Vitality.reinforcedArmor;
}

test('attribute effects use explicit immutable conversion input pools', () => {
  const commonStats = { Power: 1000, Vitality: 1000 };
  const effects = [
    {
      kind: 'flat',
      to: 'Power',
      amount: 120,
      feedsConversions: 'all'
    },
    {
      kind: 'flat',
      to: 'Vitality',
      amount: 180,
      feedsConversions: 'none'
    },
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Ferocity',
      multiplier: 0.1,
      rounding: 'round',
      input: 'eligible'
    },
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Expertise',
      multiplier: 0.1,
      rounding: 'floor',
      input: 'common'
    },
    {
      // Converted Ferocity must not feed subsequent conversions.
      kind: 'conversion',
      from: 'Ferocity',
      to: 'Precision',
      multiplier: 1,
      rounding: 'none',
      input: 'eligible'
    },
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Condition Damage',
      multiplier: 0.05,
      rounding: 'none',
      input: 'common'
    }
  ];

  assert.deepEqual(
    resolveAttributeEffects({ conversionPool: commonStats, conversions: equipmentAttributeConversions() }, effects)
      .attributes,
    {
      Power: 120,
      Vitality: 180,
      Ferocity: 112,
      Expertise: 100,
      'Condition Damage': 50
    }
  );
  assert.deepEqual(commonStats, { Power: 1000, Vitality: 1000 });
  assert.deepEqual(effects[0], {
    kind: 'flat',
    to: 'Power',
    amount: 120,
    feedsConversions: 'all'
  });
});

test('Guardian includes Force of Will before Power of the Virtuous', () => {
  const build = createGuardianBuildDefaults();

  build.specializations = [
    { name: 'Honor', traits: '1-1-3' },
    { name: 'Virtues', traits: '1-1-1' }
  ];

  const all = calculateGuardianAttributes(build).attributes;
  const withoutForce = calculateGuardianAttributes(build, [], 1, 'Force of Will').attributes;
  const withoutVirtuous = calculateGuardianAttributes(build, [], 1, 'Power of the Virtuous').attributes;

  assert.equal(all.Vitality.final - withoutForce.Vitality.final, 315);
  assert.equal(
    all['Condition Damage'].final - withoutVirtuous['Condition Damage'].final,
    Math.round(conversionVitality(all) * 0.07)
  );
  assert.equal(all['Condition Damage'].final - withoutForce['Condition Damage'].final, 21);
});

test('Guardian eligible flat traits feed attribute conversions', () => {
  const vitalitySources = [
    {
      specialization: { name: 'Dragonhunter', traits: '1-1-1' },
      trait: "Defender's Dogma",
      amount: 180
    },
    {
      specialization: { name: 'Willbender', traits: '3-1-1' },
      trait: 'Conceited Curate',
      amount: 180
    },
    {
      specialization: { name: 'Firebrand', traits: '1-1-1' },
      trait: 'Imbued Haste',
      amount: 250
    },
    {
      specialization: { name: 'Luminary', traits: '1-1-1' },
      trait: "Light's Gift",
      amount: 180
    }
  ];

  for (const { specialization, trait, amount } of vitalitySources) {
    const build = createGuardianBuildDefaults();

    build.food = '';
    build.utility = '';
    build.assumptions.quickness = true;
    build.specializations = [specialization, { name: 'Virtues', traits: '1-1-1' }];
    const all = calculateGuardianAttributes(build).attributes;
    const withoutConversion = calculateGuardianAttributes(build, [], 1, 'Power of the Virtuous').attributes;

    const withoutSource = calculateGuardianAttributes(build, [], 1, trait).attributes;
    assert.equal(conversionVitality(all) - conversionVitality(withoutSource), amount, trait);
    assert.equal(
      all['Condition Damage'].final - withoutConversion['Condition Damage'].final,
      Math.round(conversionVitality(all) * 0.07),
      trait
    );
  }

  const power = createGuardianBuildDefaults();

  power.food = '';
  power.utility = '';
  power.specializations = [
    { name: 'Zeal', traits: '1-3-1' },
    { name: 'Willbender', traits: '2-1-1' }
  ];
  const withPower = calculateGuardianAttributes(power).attributes;
  const withoutKindledZeal = calculateGuardianAttributes(power, [], 1, 'Kindled Zeal').attributes;

  assert.equal(traitDelta(calculateGuardianAttributes, power, 'Power for Power', 'Power'), 120);
  assert.equal(
    withPower['Condition Damage'].final - withoutKindledZeal['Condition Damage'].final,
    Math.round(withPower.Power.final * 0.1)
  );

  const conditionDamage = createGuardianBuildDefaults();

  conditionDamage.specializations = [{ name: 'Willbender', traits: '1-1-1' }];
  assert.equal(traitDelta(calculateGuardianAttributes, conditionDamage, 'Searing Pact', 'Condition Damage'), 120);
});

test('Dark Gunslinger rounds its Expertise conversion for game parity', () => {
  const build = createNecromancerBuildDefaults();

  assert.equal(traitDelta(calculateNecromancerAttributes, build, 'Dark Gunslinger', 'Expertise'), 148);
});

test('Lingering Curse and Boon of Creation do not feed conversions', () => {
  const scourge = createNecromancerBuildDefaults();

  scourge.specializations = [
    { name: 'Curses', traits: '1-1-3' },
    { name: 'Scourge', traits: '2-1-1' }
  ];

  const all = calculateNecromancerAttributes(scourge).attributes;
  const withoutLingeringCurse = calculateNecromancerAttributes(scourge, [], 1, 'Lingering Curse').attributes;

  assert.equal(all['Condition Damage'].final - withoutLingeringCurse['Condition Damage'].final, 200);
  assert.equal(all.Expertise.final, withoutLingeringCurse.Expertise.final);

  const ritualist = createNecromancerBuildDefaults();

  ritualist.specializations = [{ name: 'Ritualist', traits: '1-1-1' }];
  assert.equal(traitDelta(calculateNecromancerAttributes, ritualist, 'Boon of Creation', 'Concentration'), 180);
});

test('Bolstered Bonds follows both selected legends in build attributes', () => {
  const build = createRevenantBuildDefaults();

  build.specializations = [{ name: 'Conduit', traits: '1-1-1' }];
  build.selectedLegends = [LEGEND.ASSASSIN, LEGEND.ENTITY];

  const app = { build, attributeWeaponSet: 1, results: null };

  app.attributeData = revenantAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: revenantAppAdapter.profession.resolvePatch()
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const assassin = app.attributeData.attributes;

  assert.equal(assassin.Power.traits, 150);
  assert.equal(assassin.Precision.traits, 75);
  assert.equal(assassin.Ferocity.traits, 150);
  assert.equal(assassin['Condition Damage'].traits, 75);
  assert.equal(assassin['Healing Power'].traits, 75);

  build.selectedLegends = [LEGEND.DWARF, LEGEND.ENTITY];
  app.attributeData = revenantAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: revenantAppAdapter.profession.resolvePatch()
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const dwarf = app.attributeData.attributes;

  assert.equal(dwarf.Power.traits, 75);
  assert.equal(dwarf.Toughness.traits, 225);
  assert.equal(dwarf.Vitality.traits, 225);
  assert.equal(dwarf.Ferocity.traits, 75);

  // Each selected legend contributes its own pair alongside Entity's all-attribute bonus.
  build.selectedLegends = [LEGEND.CENTAUR, LEGEND.ENTITY];
  app.attributeData = revenantAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: revenantAppAdapter.profession.resolvePatch()
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  assert.equal(app.attributeData.attributes['Healing Power'].traits, 225);
  assert.equal(app.attributeData.attributes.Concentration.traits, 225);
});

test('Bolstered Bonds evaluates the live Cosmic Wisdom multiplier', () => {
  const attributes = {
    power: 1000,
    precision: 1000,
    ferocity: 0
  };
  const context = {
    config: {
      specialization: 'Conduit',
      attributeInputs: baseAttributeInputs({ vitality: 0 }),
      selectedTraitIds: [TRAIT.BOLSTERED_BONDS]
    },
    time: 1,
    runtime: {
      profession: {
        core: { selectedLegendIds: [LEGEND.ASSASSIN, LEGEND.ENTITY] },
        specialization: { kind: 'Conduit', state: { cosmicWisdomUntil: 0 } }
      }
    }
  };

  assert.deepEqual(revenantConduitRules.modifyAttributes(context, attributes), {
    ...attributes,
    power: 1150,
    precision: 1075,
    ferocity: 150,
    toughness: 75,
    vitality: 75,
    conditionDamage: 75,
    expertise: 75,
    concentration: 75,
    healingPower: 75
  });

  context.runtime.profession.specialization.state.cosmicWisdomUntil = 5;
  const cosmic = revenantConduitRules.modifyAttributes({ catalog: revenantCatalog, ...context }, attributes);

  assert.equal(cosmic.power, 1300);
  assert.equal(cosmic.precision, 1150);
  assert.equal(cosmic.ferocity, 300);
});

test('Empire Divided grants full-health Power regardless of legacy build health inputs', () => {
  const build = createRevenantBuildDefaults();
  build.specializations = [{ name: 'Vindicator', traits: '1-1-1' }];

  // Old saved values must not change the fixed full-health attribute contract.
  for (const health of [undefined, 100, 51, 50, 25, 0]) {
    build.assumptions.playerHealthPercent = health;
    assert.equal(
      traitDelta(calculateRevenantAttributes, build, 'Empire Divided', 'Power'),
      240,
      `player health: ${health ?? 'default'}`
    );
  }
});

test('Thief weapon traits use the displayed weapon set', () => {
  const build = createThiefBuildDefaults();

  build.specializations = [{ name: 'Deadly Arts', traits: '1-1-1' }];
  build.weapons = ['Dagger', 'Dagger'];
  build.alternateWeapons = ['Sword', 'Pistol'];

  const dagger = calculateThiefAttributes(build, [], 1).attributes;
  const sword = calculateThiefAttributes(build, [], 2).attributes;

  assert.equal(dagger.Power.traits, 160);
  assert.equal(sword.Power.traits, 80);
});

test("Thief eligible power traits feed Marauder's Resilience", () => {
  const cases = [
    {
      trait: 'Dagger Training',
      specializations: [
        { name: 'Deadly Arts', traits: '1-1-1' },
        { name: 'Daredevil', traits: '1-2-1' }
      ],
      weapons: ['Dagger', 'Dagger'],
      alternateWeapons: ['Sword', 'Pistol'],
      amounts: [160, 80]
    },
    {
      trait: 'Staff Master',
      specializations: [{ name: 'Daredevil', traits: '1-1-1' }],
      weapons: ['Staff', ''],
      alternateWeapons: ['Sword', 'Pistol'],
      amounts: [240, 120]
    },
    {
      trait: "Swindler's Equilibrium",
      specializations: [
        { name: 'Acrobatics', traits: '1-2-1' },
        { name: 'Daredevil', traits: '1-2-1' }
      ],
      weapons: ['Sword', 'Pistol'],
      alternateWeapons: ['Dagger', 'Dagger'],
      amounts: [240, 120]
    }
  ];

  for (const testCase of cases) {
    const build = createThiefBuildDefaults();

    build.food = '';
    build.utility = '';
    build.specializations = testCase.specializations;
    build.weapons = testCase.weapons;
    build.alternateWeapons = testCase.alternateWeapons;

    for (const weaponSet of [1, 2]) {
      const all = calculateThiefAttributes(build, [], weaponSet).attributes;
      const withoutSource = calculateThiefAttributes(build, [], weaponSet, testCase.trait).attributes;
      const withoutConversion = calculateThiefAttributes(build, [], weaponSet, "Marauder's Resilience").attributes;

      assert.equal(
        all.Power.final - withoutSource.Power.final,
        testCase.amounts[weaponSet - 1],
        `${testCase.trait}, weapon set ${weaponSet}`
      );
      assert.equal(
        conversionVitality(all) - conversionVitality(withoutConversion),
        Math.round(all.Power.final * 0.07),
        `${testCase.trait}, weapon set ${weaponSet}`
      );
      assert.equal(
        conversionVitality(all) - conversionVitality(withoutSource),
        Math.round(all.Power.final * 0.07) - Math.round(withoutSource.Power.final * 0.07),
        `${testCase.trait}, weapon set ${weaponSet}`
      );
    }
  }
});

test('Silent Scope feeds Practiced Tolerance', () => {
  const build = createThiefBuildDefaults();

  build.specializations = [
    { name: 'Critical Strikes', traits: '1-2-1' },
    { name: 'Deadeye', traits: '1-1-1' }
  ];

  const all = calculateThiefAttributes(build).attributes;
  const withoutSilentScope = calculateThiefAttributes(build, [], 1, 'Silent Scope').attributes;
  const withoutPracticedTolerance = calculateThiefAttributes(build, [], 1, 'Practiced Tolerance').attributes;

  assert.equal(all.Precision.final - withoutSilentScope.Precision.final, 120);
  assert.equal(all.Ferocity.final - withoutPracticedTolerance.Ferocity.final, Math.round(all.Precision.final * 0.1));
  assert.equal(
    all.Ferocity.final - withoutSilentScope.Ferocity.final,
    Math.round(all.Precision.final * 0.1) - Math.round(withoutSilentScope.Precision.final * 0.1)
  );
});

test('Deadly Ambition and both Second Opinion values feed its conversion', () => {
  const build = createThiefBuildDefaults();

  build.specializations = [
    { name: 'Deadly Arts', traits: '3-1-1' },
    { name: 'Specter', traits: '1-1-1' }
  ];
  build.weapons = ['Scepter', 'Dagger'];
  build.alternateWeapons = ['Dagger', 'Dagger'];

  for (const [weaponSet, secondOpinionAmount] of [
    [1, 180],
    [2, 90]
  ]) {
    const all = calculateThiefAttributes(build, [], weaponSet).attributes;
    const withoutSecondOpinion = calculateThiefAttributes(build, [], weaponSet, 'Second Opinion').attributes;
    const withoutDeadlyAmbition = calculateThiefAttributes(build, [], weaponSet, 'Deadly Ambition').attributes;

    assert.equal(all['Condition Damage'].final - withoutSecondOpinion['Condition Damage'].final, secondOpinionAmount);
    assert.equal(
      all['Healing Power'].final - withoutSecondOpinion['Healing Power'].final,
      Math.round(all['Condition Damage'].final * 0.07)
    );
    assert.equal(
      all['Healing Power'].final - withoutDeadlyAmbition['Healing Power'].final,
      Math.round(all['Condition Damage'].final * 0.07) -
        Math.round(withoutDeadlyAmbition['Condition Damage'].final * 0.07)
    );
  }
});

test('Preparedness remains an eligible flat Expertise trait', () => {
  const build = createThiefBuildDefaults();

  build.specializations = [{ name: 'Trickery', traits: '1-1-1' }];

  assert.equal(traitDelta(calculateThiefAttributes, build, 'Preparedness', 'Expertise'), 150);
});
