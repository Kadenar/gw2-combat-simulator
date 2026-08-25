import assert from 'node:assert/strict';
import test from 'node:test';

import { createEngineerBuildDefaults } from '../../js/professions/engineer/build.js';
import { applyEngineerBuildAttributeRules } from '../../js/professions/engineer/build-attributes.js';
import { engineerProfession } from '../../js/professions/engineer/definition.js';
import { ENGINEER_TRAIT_IDS } from '../../js/professions/engineer/data/ids.js';
import { createGuardianBuildDefaults } from '../../js/professions/guardian/build.js';
import { applyGuardianBuildAttributeRules } from '../../js/professions/guardian/build-attributes.js';
import { guardianProfession } from '../../js/professions/guardian/definition.js';
import { GUARDIAN_TRAIT_IDS } from '../../js/professions/guardian/data/ids.js';
import { createMesmerBuildDefaults } from '../../js/professions/mesmer/build.js';
import { applyMesmerBuildAttributeRules } from '../../js/professions/mesmer/build-attributes.js';
import { createNecromancerBuildDefaults } from '../../js/professions/necromancer/build.js';
import { applyNecromancerBuildAttributeRules } from '../../js/professions/necromancer/build-attributes.js';
import { necromancerProfession } from '../../js/professions/necromancer/definition.js';
import { NECROMANCER_TRAIT_IDS } from '../../js/professions/necromancer/data/ids.js';
import { createNecromancerCoreState } from '../../js/professions/necromancer/core/state.js';
import { createRevenantBuildDefaults } from '../../js/professions/revenant/build.js';
import { applyRevenantBuildAttributeRules } from '../../js/professions/revenant/build-attributes.js';
import { revenantAppAdapter } from '../../js/professions/revenant/app/app-definition.js';
import { revenantProfession } from '../../js/professions/revenant/definition.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '../../js/professions/revenant/data/ids.js';
import { createThiefBuildDefaults } from '../../js/professions/thief/build.js';
import { applyThiefBuildAttributeRules } from '../../js/professions/thief/build-attributes.js';
import { thiefProfession } from '../../js/professions/thief/definition.js';
import { THIEF_TRAIT_IDS } from '../../js/professions/thief/data/ids.js';
import { createCalculateAttributes, resolveAttributeEffects } from '../../js/platform/gw2/builds/attributes.js';
import { simulateGw2 } from '../../js/platform/gw2/simulation/simulate.js';
import { createWarriorBuildDefaults } from '../../js/professions/warrior/build.js';
import { applyWarriorBuildAttributeRules } from '../../js/professions/warrior/build-attributes.js';

// Attribute tests construct the same calculators composed into the production adapters.
const calculateEngineerAttributes = createCalculateAttributes(applyEngineerBuildAttributeRules);
const calculateGuardianAttributes = createCalculateAttributes(applyGuardianBuildAttributeRules);
const calculateMesmerAttributes = createCalculateAttributes(applyMesmerBuildAttributeRules);
const calculateNecromancerAttributes = createCalculateAttributes(applyNecromancerBuildAttributeRules);
const calculateRevenantAttributes = createCalculateAttributes(applyRevenantBuildAttributeRules);
const calculateThiefAttributes = createCalculateAttributes(applyThiefBuildAttributeRules);
const calculateWarriorAttributes = createCalculateAttributes(applyWarriorBuildAttributeRules);

const engineerCoreRules = engineerProfession.resolveRuntime({});
const guardianCoreRules = guardianProfession.resolveRuntime({});
const necromancerCoreRules = necromancerProfession.resolveRuntime({});
const revenantCoreRules = revenantProfession.resolveRuntime({});
const revenantRenegadeRules = revenantProfession.resolveRuntime({
  specialization: 'Renegade'
});
const revenantConduitRules = revenantProfession.resolveRuntime({
  specialization: 'Conduit'
});

function traitDelta(calculate, build, trait, attribute, selectedSkills = [], weaponSet = 1) {
  const withTrait = calculate(build, selectedSkills, weaponSet).attributes;
  const withoutTrait = calculate(build, selectedSkills, weaponSet, trait).attributes;

  return withTrait[attribute].final - withoutTrait[attribute].final;
}

test('attribute effects use explicit immutable conversion input pools', () => {
  const commonStats = { Power: 1000, Vitality: 1000 };
  const effects = [
    {
      kind: 'flat',
      source: 'Eligible Power',
      to: 'Power',
      amount: 120,
      feedsConversions: true
    },
    {
      kind: 'flat',
      source: 'Final-only Vitality',
      to: 'Vitality',
      amount: 180,
      feedsConversions: false
    },
    {
      kind: 'conversion',
      source: 'Eligible Power Conversion',
      from: 'Power',
      to: 'Ferocity',
      multiplier: 0.1,
      rounding: 'round',
      input: 'eligible'
    },
    {
      kind: 'conversion',
      source: 'Common Power Conversion',
      from: 'Power',
      to: 'Expertise',
      multiplier: 0.1,
      rounding: 'floor',
      input: 'common'
    },
    {
      kind: 'conversion',
      source: 'No Chained Conversion',
      from: 'Ferocity',
      to: 'Precision',
      multiplier: 1,
      rounding: 'none',
      input: 'eligible'
    },
    {
      kind: 'conversion',
      source: 'Conversion With Addend',
      from: 'Power',
      to: 'Condition Damage',
      multiplier: 0.05,
      addend: 3,
      rounding: 'none',
      input: 'common'
    }
  ];

  assert.deepEqual(resolveAttributeEffects(commonStats, effects), {
    Power: 120,
    Vitality: 180,
    Ferocity: 112,
    Expertise: 100,
    'Condition Damage': 53
  });
  assert.deepEqual(commonStats, { Power: 1000, Vitality: 1000 });
  assert.deepEqual(effects[0], {
    kind: 'flat',
    source: 'Eligible Power',
    to: 'Power',
    amount: 120,
    feedsConversions: true
  });
});

test('shared attribute provenance applies profession static rules once', () => {
  const applied = {
    attributeProvenance: {
      professionStaticRulesApplied: true,
      calculatedWeaponSet: 1,
      calculatedPrimaryWeapon: 'Greatsword'
    }
  };

  const engineerDirect = engineerCoreRules.modifyAttributes(
    {
      config: { selectedTraitIds: [ENGINEER_TRAIT_IDS.CHEMICAL_ROUNDS] }
    },
    { conditionDamage: 1000 }
  );
  const engineerBrowser = engineerCoreRules.modifyAttributes(
    {
      config: {
        ...applied,
        selectedTraitIds: [ENGINEER_TRAIT_IDS.CHEMICAL_ROUNDS]
      }
    },
    { conditionDamage: 1120 }
  );

  assert.equal(engineerDirect.conditionDamage, 1120);
  assert.equal(engineerBrowser.conditionDamage, engineerDirect.conditionDamage);

  const guardianDirect = guardianCoreRules.modifyAttributes(
    {
      config: { selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE] },
      event: { skillWeapon: 'Greatsword' }
    },
    { power: 1000, precision: 1000, ferocity: 0, vitality: 1000 }
  );
  const guardianBrowser = guardianCoreRules.modifyAttributes(
    {
      config: {
        ...applied,
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE]
      },
      event: { skillWeapon: 'Greatsword' }
    },
    { power: 1240, precision: 1000, ferocity: 0, vitality: 1000 }
  );

  assert.equal(guardianDirect.power, 1240);
  assert.equal(guardianBrowser.power, guardianDirect.power);

  const necromancerDirect = necromancerCoreRules.modifyAttributes(
    {
      config: { selectedTraitIds: [NECROMANCER_TRAIT_IDS.FURIOUS_DEMISE] }
    },
    { precision: 1000 }
  );
  const necromancerBrowser = necromancerCoreRules.modifyAttributes(
    {
      config: {
        ...applied,
        selectedTraitIds: [NECROMANCER_TRAIT_IDS.FURIOUS_DEMISE]
      }
    },
    { precision: 1180 }
  );

  assert.equal(necromancerDirect.precision, 1180);
  assert.equal(necromancerBrowser.precision, necromancerDirect.precision);

  const necromancerDirectState = createNecromancerCoreState({
    selectedTraitIds: [NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE],
    stats: { power: 1000, vitality: 1000 }
  });
  const necromancerBrowserState = createNecromancerCoreState({
    ...applied,
    selectedTraitIds: [NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE],
    stats: { power: 1000, vitality: 1100 }
  });

  assert.equal(necromancerBrowserState.maximumHealth, necromancerDirectState.maximumHealth);

  const revenantDirect = revenantCoreRules.modifyConditionDuration(
    {
      config: { selectedTraitIds: [TRAIT.PACT_OF_PAIN] },
      condition: 'Torment'
    },
    1
  );
  const revenantBrowser = revenantCoreRules.modifyConditionDuration(
    {
      config: {
        ...applied,
        selectedTraitIds: [TRAIT.PACT_OF_PAIN]
      },
      condition: 'Torment'
    },
    1.15
  );

  assert.equal(revenantDirect, 1.15);
  assert.equal(revenantBrowser, revenantDirect);

  // Marauder's Resilience is Daredevil-owned, so compare provenance after the composed runtime initializes.
  const simulateDaredevil = (config) =>
    simulateGw2({
      profession: thiefProfession,
      rotation: [],
      config: {
        ...config,
        specialization: 'Daredevil',
        selectedTraitIds: [THIEF_TRAIT_IDS.MARAUDERS_RESILIENCE]
      }
    }).endState.profession;
  const thiefDirect = simulateDaredevil({
    stats: { vitality: 1000, power: 1000 }
  });
  const thiefBrowser = simulateDaredevil({
    ...applied,
    stats: { vitality: 1070, power: 1000 }
  });

  assert.equal(thiefBrowser.maximumHealth, thiefDirect.maximumHealth);
});

test('Engineer exposes current unconditional trait attributes', () => {
  const build = createEngineerBuildDefaults();

  build.specializations = [
    { name: 'Alchemy', traits: '1-1-1' },
    { name: 'Amalgam', traits: '1-1-1' }
  ];

  assert.equal(traitDelta(calculateEngineerAttributes, build, 'Compounding Chemicals', 'Concentration'), 240);
  assert.equal(traitDelta(calculateEngineerAttributes, build, 'Hybrid Vigor', 'Vitality'), 240);

  const firearms = createEngineerBuildDefaults();

  firearms.specializations = [{ name: 'Firearms', traits: '1-2-1' }];
  assert.equal(traitDelta(calculateEngineerAttributes, firearms, 'Chemical Rounds', 'Condition Damage'), 120);
  assert.equal(traitDelta(calculateEngineerAttributes, firearms, 'Thermal Vision', 'Expertise'), 150);
});

test('Engineer omits conditional and obsolete attribute effects', () => {
  const firearms = createEngineerBuildDefaults();

  firearms.specializations = [{ name: 'Firearms', traits: '3-1-1' }];
  assert.equal(traitDelta(calculateEngineerAttributes, firearms, 'High Caliber', 'Precision'), 0);

  const scrapper = createEngineerBuildDefaults();

  scrapper.specializations = [{ name: 'Scrapper', traits: '3-1-3' }];
  assert.equal(traitDelta(calculateEngineerAttributes, scrapper, 'Mass Momentum', 'Power'), 0);
  assert.equal(traitDelta(calculateEngineerAttributes, scrapper, 'Applied Force', 'Power'), 0);

  const kinetic = structuredClone(scrapper);

  kinetic.specializations[0].traits = '3-1-2';
  assert.equal(
    traitDelta(calculateEngineerAttributes, kinetic, 'Kinetic Accelerators', 'Concentration'),
    Math.round(calculateEngineerAttributes(kinetic).attributes.Power.final * 0.13)
  );

  const withoutSignets = calculateEngineerAttributes(scrapper).attributes;
  const withSignets = calculateEngineerAttributes(scrapper, [
    { name: 'Force Signet' },
    { name: 'Superconducting Signet' }
  ]).attributes;

  assert.equal(withSignets.Power.final, withoutSignets.Power.final);
  assert.equal(withSignets['Condition Damage'].final, withoutSignets['Condition Damage'].final);
});

test("only Forceful Greatsword's base Power feeds conversions", () => {
  const build = createWarriorBuildDefaults();

  build.food = '';
  build.utility = '';
  build.specializations = [
    { name: 'Strength', traits: '1-2-1' },
    { name: 'Tactics', traits: '1-1-2' }
  ];

  for (const { weapons, alternateWeapons, power } of [
    {
      weapons: ['Axe', 'Axe'],
      alternateWeapons: ['Sword', 'Sword'],
      power: 120
    },
    {
      weapons: ['Greatsword', ''],
      alternateWeapons: ['Sword', 'Sword'],
      power: 240
    }
  ]) {
    build.weapons = weapons;
    build.alternateWeapons = alternateWeapons;
    const all = calculateWarriorAttributes(build).attributes;
    const withoutForceful = calculateWarriorAttributes(build, [], 1, 'Forceful Greatsword').attributes;

    assert.equal(all.Power.final - withoutForceful.Power.final, power);
    assert.equal(all['Healing Power'].final - withoutForceful['Healing Power'].final, 12);
  }
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

  assert.equal(all.Vitality.final - withoutForce.Vitality.final, 300);
  assert.equal(
    all['Condition Damage'].final - withoutVirtuous['Condition Damage'].final,
    Math.round(all.Vitality.final * 0.07)
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

    assert.equal(traitDelta(calculateGuardianAttributes, build, trait, 'Vitality'), amount, trait);
    assert.equal(
      all['Condition Damage'].final - withoutConversion['Condition Damage'].final,
      Math.round(all.Vitality.final * 0.07),
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

test('Mesmer static regeneration traits remain represented', () => {
  const build = createMesmerBuildDefaults();

  build.specializations = [{ name: 'Chaos', traits: '1-1-1' }];
  build.assumptions.regeneration = true;

  assert.equal(traitDelta(calculateMesmerAttributes, build, 'Chaotic Persistence', 'Expertise'), 100);
  assert.equal(traitDelta(calculateMesmerAttributes, build, 'Chaotic Persistence', 'Concentration'), 250);
});

test('Necromancer static minor attributes remain represented', () => {
  const build = createNecromancerBuildDefaults();

  build.specializations = [{ name: 'Curses', traits: '1-1-1' }];

  assert.equal(traitDelta(calculateNecromancerAttributes, build, 'Furious Demise', 'Precision'), 180);
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

test('Condition Harbinger attributes match the in-game stat panel', () => {
  const build = createNecromancerBuildDefaults();

  build.food = 'Salsa-Topped Veggie Flatbread';
  build.utility = 'Tuning Icicle';
  build.infusions = [{ stat: 'Expertise', count: 18 }];
  build.specializations = [
    { name: 'Curses', traits: '1-1-3' },
    { name: 'Soul Reaping', traits: '1-1-3' },
    { name: 'Harbinger', traits: '3-3-1' }
  ];

  const attributes = calculateNecromancerAttributes(build).attributes;

  assert.equal(attributes.Power.final, 2173);
  assert.equal(attributes.Precision.final, 1813);
  assert.equal(attributes['Condition Damage'].final, 2093);
  assert.equal(attributes.Expertise.final, 971);
  assert.equal(attributes['Condition Duration'].final, 79.73333333333333);
  assert.equal(attributes['Bleeding Duration'].final, 20);
  assert.equal(attributes['Condition Duration'].final + attributes['Bleeding Duration'].final, 99.73333333333333);
});

test('Bolstered Bonds follows both selected legends in build attributes', () => {
  const build = createRevenantBuildDefaults();

  build.specializations = [{ name: 'Conduit', traits: '1-1-1' }];
  build.selectedLegends = [LEGEND.ASSASSIN, LEGEND.ENTITY];

  const app = { build, attributeWeaponSet: 1, results: null };

  revenantAppAdapter.recalculate(app);
  const assassin = app.attributeData.attributes;

  assert.equal(assassin.Power.traits, 150);
  assert.equal(assassin.Precision.traits, 75);
  assert.equal(assassin.Ferocity.traits, 150);
  assert.equal(assassin['Condition Damage'].traits, 75);

  build.selectedLegends = [LEGEND.DWARF, LEGEND.ENTITY];
  revenantAppAdapter.recalculate(app);
  const dwarf = app.attributeData.attributes;

  assert.equal(dwarf.Power.traits, 75);
  assert.equal(dwarf.Toughness.traits, 225);
  assert.equal(dwarf.Vitality.traits, 225);
  assert.equal(dwarf.Ferocity.traits, 75);
});

test('Bolstered Bonds runtime only adds the temporary Cosmic Wisdom copy', () => {
  const attributes = {
    power: 1150,
    precision: 1075,
    ferocity: 150
  };
  const context = {
    config: {
      specialization: 'Conduit',
      attributeProvenance: {
        professionStaticRulesApplied: true
      }
    },
    time: 1,
    runtime: {
      profession: {
        cosmicWisdomUntil: 0,
        selectedLegendIds: [LEGEND.ASSASSIN, LEGEND.ENTITY]
      }
    }
  };

  assert.deepEqual(revenantConduitRules.modifyAttributes(context, attributes), attributes);

  context.runtime.profession.cosmicWisdomUntil = 5;
  const cosmic = revenantConduitRules.modifyAttributes(context, attributes);

  assert.equal(cosmic.power, 1300);
  assert.equal(cosmic.precision, 1150);
  assert.equal(cosmic.ferocity, 300);
});

test('Revenant exposes static minor attributes and conversions', () => {
  const salvation = createRevenantBuildDefaults();

  salvation.specializations = [{ name: 'Salvation', traits: '1-1-1' }];
  const withLife = calculateRevenantAttributes(salvation).attributes;
  const withoutLife = calculateRevenantAttributes(salvation, [], 1, 'Life Attunement').attributes;

  assert.equal(withLife['Healing Power'].final - withoutLife['Healing Power'].final, 120);
  assert.equal(
    withLife.Concentration.final - withoutLife.Concentration.final,
    Math.round(withLife['Healing Power'].final * 0.07)
  );

  const retribution = createRevenantBuildDefaults();

  retribution.specializations = [{ name: 'Retribution', traits: '1-1-2' }];
  const withVersed = calculateRevenantAttributes(retribution).attributes;
  const withoutVersed = calculateRevenantAttributes(retribution, [], 1, 'Versed in Stone').attributes;

  assert.equal(withVersed.Power.final - withoutVersed.Power.final, Math.round(withVersed.Toughness.final * 0.13));

  const herald = createRevenantBuildDefaults();

  herald.specializations = [{ name: 'Herald', traits: '1-1-1' }];
  assert.equal(traitDelta(calculateRevenantAttributes, herald, 'Reinforced Potency', 'Concentration'), 240);
  assert.equal(
    traitDelta(calculateRevenantAttributes, herald, 'Elevated Compassion', 'Concentration'),
    Math.round(calculateRevenantAttributes(herald).attributes.Power.final * 0.13)
  );
});

test('Brutal Momentum exposes its unconditional critical chance', () => {
  const build = createRevenantBuildDefaults();

  build.specializations = [{ name: 'Renegade', traits: '1-1-1' }];

  assert.equal(traitDelta(calculateRevenantAttributes, build, 'Brutal Momentum', 'Critical Chance'), 10);

  const runtime = revenantRenegadeRules.modifyCriticalChance(
    {
      config: {
        specialization: 'Renegade',
        attributeProvenance: {
          professionStaticRulesApplied: true
        },
        selectedTraitIds: [TRAIT.BRUTAL_MOMENTUM]
      },
      runtime: {
        profession: { endurance: 50, maximumEndurance: 100 }
      }
    },
    0.2
  );

  assert.ok(Math.abs(runtime - 0.3) < 1e-9);
});

test('Death Perception exposes its unconditional critical chance', () => {
  const build = createNecromancerBuildDefaults();

  build.specializations = [{ name: 'Soul Reaping', traits: '1-1-2' }];

  assert.equal(traitDelta(calculateNecromancerAttributes, build, 'Death Perception', 'Critical Chance'), 15);
});

test("Numinous Gift's static duration improvement appears in build stats", () => {
  const build = createRevenantBuildDefaults();

  build.specializations = [
    { name: 'Corruption', traits: '1-1-1' },
    { name: 'Conduit', traits: '1-1-1' }
  ];

  const all = calculateRevenantAttributes(build).attributes;
  const withoutNuminous = calculateRevenantAttributes(build, [], 1, 'Numinous Gift').attributes;

  assert.equal(all['Bleeding Duration'].traits, 15);
  assert.equal(withoutNuminous['Bleeding Duration'].traits, 10);
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
        all.Vitality.final - withoutConversion.Vitality.final,
        Math.round(all.Power.final * 0.07),
        `${testCase.trait}, weapon set ${weaponSet}`
      );
      assert.equal(
        all.Vitality.final - withoutSource.Vitality.final,
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

test('Thief uses current flat trait and conversion values', () => {
  const deadlyArts = createThiefBuildDefaults();

  deadlyArts.specializations = [{ name: 'Deadly Arts', traits: '3-3-3' }];
  assert.equal(traitDelta(calculateThiefAttributes, deadlyArts, 'Deadly Ambition', 'Condition Damage'), 180);
  assert.equal(traitDelta(calculateThiefAttributes, deadlyArts, 'Revealed Training', 'Power'), 80);

  const criticalStrikes = createThiefBuildDefaults();

  criticalStrikes.specializations = [{ name: 'Critical Strikes', traits: '1-2-1' }];
  const precision = calculateThiefAttributes(criticalStrikes).attributes.Precision.final;

  assert.equal(
    traitDelta(calculateThiefAttributes, criticalStrikes, 'Practiced Tolerance', 'Ferocity'),
    Math.round(precision * 0.1)
  );

  const specter = createThiefBuildDefaults();

  specter.specializations = [{ name: 'Specter', traits: '1-1-1' }];
  specter.weapons = ['Scepter', 'Dagger'];
  specter.alternateWeapons = ['Dagger', 'Dagger'];
  assert.equal(traitDelta(calculateThiefAttributes, specter, 'Second Opinion', 'Condition Damage', [], 1), 180);
  assert.equal(traitDelta(calculateThiefAttributes, specter, 'Second Opinion', 'Condition Damage', [], 2), 90);
  assert.equal(
    traitDelta(calculateThiefAttributes, specter, 'Strength of Shadows', 'Expertise'),
    Math.round(calculateThiefAttributes(specter).attributes.Vitality.final * 0.13)
  );
});
