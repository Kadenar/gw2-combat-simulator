import assert from "node:assert/strict";
import test from "node:test";

import { createEngineerBuildDefaults } from "../../js/professions/engineer/build.js";
import { engineerProfession } from "../../js/professions/engineer/definition.js";
import { ENGINEER_TRAIT_IDS } from "../../js/professions/engineer/data/ids.js";
import { calculateAttributes as calculateEngineerAttributes } from "../../js/professions/engineer/app/app-definition.js";
import { createGuardianBuildDefaults } from "../../js/professions/guardian/build.js";
import { guardianProfession } from "../../js/professions/guardian/definition.js";
import { GUARDIAN_TRAIT_IDS } from "../../js/professions/guardian/data/ids.js";
import { calculateAttributes as calculateGuardianAttributes } from "../../js/professions/guardian/app/app-definition.js";
import { createMesmerBuildDefaults } from "../../js/professions/mesmer/build.js";
import { calculateAttributes as calculateMesmerAttributes } from "../../js/professions/mesmer/app/app-definition.js";
import { createNecromancerBuildDefaults } from "../../js/professions/necromancer/build.js";
import { calculateAttributes as calculateNecromancerAttributes } from "../../js/professions/necromancer/app/app-definition.js";
import { necromancerProfession } from "../../js/professions/necromancer/definition.js";
import { NECROMANCER_TRAIT_IDS } from "../../js/professions/necromancer/data/ids.js";
import { createNecromancerCoreState } from "../../js/professions/necromancer/core/state.js";
import { createRevenantBuildDefaults } from "../../js/professions/revenant/build.js";
import {
  calculateAttributes as calculateRevenantAttributes,
  recalculate as recalculateRevenant,
} from "../../js/professions/revenant/app/app-definition.js";
import { revenantProfession } from "../../js/professions/revenant/definition.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../js/professions/revenant/data/ids.js";
import { createThiefBuildDefaults } from "../../js/professions/thief/build.js";
import { calculateAttributes as calculateThiefAttributes } from "../../js/professions/thief/app/app-definition.js";
import { THIEF_TRAIT_IDS } from "../../js/professions/thief/data/ids.js";
import { createThiefCoreState } from "../../js/professions/thief/core/state.js";

const engineerCoreRules = engineerProfession.resolveRuntime({});
const guardianCoreRules = guardianProfession.resolveRuntime({});
const necromancerCoreRules = necromancerProfession.resolveRuntime({});
const revenantCoreRules = revenantProfession.resolveRuntime({});
const revenantRenegadeRules = revenantProfession.resolveRuntime({
  specialization: "Renegade",
});
const revenantConduitRules = revenantProfession.resolveRuntime({
  specialization: "Conduit",
});

function traitDelta(
  calculate,
  build,
  trait,
  attribute,
  selectedSkills = [],
  weaponSet = 1,
) {
  const withTrait = calculate(build, selectedSkills, weaponSet).attributes;
  const withoutTrait = calculate(
    build,
    selectedSkills,
    weaponSet,
    trait,
  ).attributes;
  return withTrait[attribute].final - withoutTrait[attribute].final;
}

test("shared attribute provenance applies profession static rules once", () => {
  const applied = {
    attributeProvenance: {
      professionStaticRulesApplied: true,
      calculatedWeaponSet: 1,
      calculatedPrimaryWeapon: "Greatsword",
    },
  };

  const engineerDirect = engineerCoreRules.modifyAttributes(
    {
      config: { traitIds: [ENGINEER_TRAIT_IDS.CHEMICAL_ROUNDS] },
    },
    { conditionDamage: 1000 },
  );
  const engineerBrowser = engineerCoreRules.modifyAttributes(
    {
      config: {
        ...applied,
        traitIds: [ENGINEER_TRAIT_IDS.CHEMICAL_ROUNDS],
      },
    },
    { conditionDamage: 1120 },
  );
  assert.equal(engineerDirect.conditionDamage, 1120);
  assert.equal(engineerBrowser.conditionDamage, engineerDirect.conditionDamage);

  const guardianDirect = guardianCoreRules.modifyAttributes(
    {
      config: { traitIds: [GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE] },
      event: { skillWeapon: "Greatsword" },
    },
    { power: 1000, precision: 1000, ferocity: 0, vitality: 1000 },
  );
  const guardianBrowser = guardianCoreRules.modifyAttributes(
    {
      config: {
        ...applied,
        traitIds: [GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE],
      },
      event: { skillWeapon: "Greatsword" },
    },
    { power: 1240, precision: 1000, ferocity: 0, vitality: 1000 },
  );
  assert.equal(guardianDirect.power, 1240);
  assert.equal(guardianBrowser.power, guardianDirect.power);

  const necromancerDirect = necromancerCoreRules.modifyAttributes(
    {
      config: { traitIds: [NECROMANCER_TRAIT_IDS.FURIOUS_DEMISE] },
    },
    { precision: 1000 },
  );
  const necromancerBrowser = necromancerCoreRules.modifyAttributes(
    {
      config: {
        ...applied,
        traitIds: [NECROMANCER_TRAIT_IDS.FURIOUS_DEMISE],
      },
    },
    { precision: 1180 },
  );
  assert.equal(necromancerDirect.precision, 1180);
  assert.equal(necromancerBrowser.precision, necromancerDirect.precision);

  const necromancerDirectState = createNecromancerCoreState({
    traitIds: [NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE],
    stats: { power: 1000, vitality: 1000 },
  });
  const necromancerBrowserState = createNecromancerCoreState({
    ...applied,
    traitIds: [NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE],
    stats: { power: 1000, vitality: 1100 },
  });
  assert.equal(
    necromancerBrowserState.maximumHealth,
    necromancerDirectState.maximumHealth,
  );

  const revenantDirect = revenantCoreRules.modifyConditionDuration(
    {
      config: { traitIds: [TRAIT.PACT_OF_PAIN] },
      condition: "Torment",
    },
    1,
  );
  const revenantBrowser = revenantCoreRules.modifyConditionDuration(
    {
      config: {
        ...applied,
        traitIds: [TRAIT.PACT_OF_PAIN],
      },
      condition: "Torment",
    },
    1.15,
  );
  assert.equal(revenantDirect, 1.15);
  assert.equal(revenantBrowser, revenantDirect);

  const thiefDirect = createThiefCoreState({
    traitIds: [THIEF_TRAIT_IDS.MARAUDERS_RESILIENCE],
    stats: { vitality: 1000, power: 1000 },
  });
  const thiefBrowser = createThiefCoreState({
    ...applied,
    traitIds: [THIEF_TRAIT_IDS.MARAUDERS_RESILIENCE],
    stats: { vitality: 1070, power: 1000 },
  });
  assert.equal(thiefBrowser.maximumHealth, thiefDirect.maximumHealth);
});

test("Engineer exposes current unconditional trait attributes", () => {
  const build = createEngineerBuildDefaults();
  build.specializations = [
    { name: "Alchemy", traits: "1-1-1" },
    { name: "Amalgam", traits: "1-1-1" },
  ];

  assert.equal(
    traitDelta(
      calculateEngineerAttributes,
      build,
      "Compounding Chemicals",
      "Concentration",
    ),
    240,
  );
  assert.equal(
    traitDelta(calculateEngineerAttributes, build, "Hybrid Vigor", "Vitality"),
    240,
  );
});

test("Engineer omits conditional and obsolete attribute effects", () => {
  const firearms = createEngineerBuildDefaults();
  firearms.specializations = [{ name: "Firearms", traits: "3-1-1" }];
  assert.equal(
    traitDelta(
      calculateEngineerAttributes,
      firearms,
      "High Caliber",
      "Precision",
    ),
    0,
  );

  const scrapper = createEngineerBuildDefaults();
  scrapper.specializations = [{ name: "Scrapper", traits: "3-1-3" }];
  assert.equal(
    traitDelta(calculateEngineerAttributes, scrapper, "Mass Momentum", "Power"),
    0,
  );
  assert.equal(
    traitDelta(calculateEngineerAttributes, scrapper, "Applied Force", "Power"),
    0,
  );

  const kinetic = structuredClone(scrapper);
  kinetic.specializations[0].traits = "3-1-2";
  assert.equal(
    traitDelta(
      calculateEngineerAttributes,
      kinetic,
      "Kinetic Accelerators",
      "Concentration",
    ),
    Math.round(
      calculateEngineerAttributes(kinetic).attributes.Power.final * 0.13,
    ),
  );

  const withoutSignets = calculateEngineerAttributes(scrapper).attributes;
  const withSignets = calculateEngineerAttributes(scrapper, [
    { name: "Force Signet" },
    { name: "Superconducting Signet" },
  ]).attributes;
  assert.equal(withSignets.Power.final, withoutSignets.Power.final);
  assert.equal(
    withSignets["Condition Damage"].final,
    withoutSignets["Condition Damage"].final,
  );
});

test("Guardian includes Force of Will before Power of the Virtuous", () => {
  const build = createGuardianBuildDefaults();
  build.specializations = [
    { name: "Honor", traits: "1-1-3" },
    { name: "Virtues", traits: "1-1-1" },
  ];

  const all = calculateGuardianAttributes(build).attributes;
  const withoutForce = calculateGuardianAttributes(
    build,
    [],
    1,
    "Force of Will",
  ).attributes;
  const withoutVirtuous = calculateGuardianAttributes(
    build,
    [],
    1,
    "Power of the Virtuous",
  ).attributes;

  assert.equal(all.Vitality.final - withoutForce.Vitality.final, 300);
  assert.equal(
    all["Condition Damage"].final - withoutVirtuous["Condition Damage"].final,
    Math.round(all.Vitality.final * 0.07),
  );
  assert.equal(
    all["Condition Damage"].final - withoutForce["Condition Damage"].final,
    21,
  );
});

test("Mesmer static regeneration traits remain represented", () => {
  const build = createMesmerBuildDefaults();
  build.specializations = [{ name: "Chaos", traits: "1-1-1" }];
  build.assumptions.regeneration = true;

  assert.equal(
    traitDelta(
      calculateMesmerAttributes,
      build,
      "Chaotic Persistence",
      "Expertise",
    ),
    100,
  );
  assert.equal(
    traitDelta(
      calculateMesmerAttributes,
      build,
      "Chaotic Persistence",
      "Concentration",
    ),
    250,
  );
});

test("Necromancer static minor attributes remain represented", () => {
  const build = createNecromancerBuildDefaults();
  build.specializations = [{ name: "Curses", traits: "1-1-1" }];

  assert.equal(
    traitDelta(
      calculateNecromancerAttributes,
      build,
      "Furious Demise",
      "Precision",
    ),
    180,
  );
});

test("Dark Gunslinger rounds its Expertise conversion for game parity", () => {
  const build = createNecromancerBuildDefaults();

  assert.equal(
    traitDelta(
      calculateNecromancerAttributes,
      build,
      "Dark Gunslinger",
      "Expertise",
    ),
    148,
  );
});

test("Condition Harbinger attributes match the in-game stat panel", () => {
  const build = createNecromancerBuildDefaults();
  build.food = "Salsa-Topped Veggie Flatbread";
  build.utility = "Tuning Icicle";
  build.infusions = [{ stat: "Expertise", count: 18 }];
  build.specializations = [
    { name: "Curses", traits: "1-1-3" },
    { name: "Soul Reaping", traits: "1-1-3" },
    { name: "Harbinger", traits: "3-3-1" },
  ];

  const attributes = calculateNecromancerAttributes(build).attributes;

  assert.equal(attributes.Power.final, 2173);
  assert.equal(attributes.Precision.final, 1813);
  assert.equal(attributes["Condition Damage"].final, 2093);
  assert.equal(attributes.Expertise.final, 971);
  assert.equal(attributes["Condition Duration"].final, 79.73333333333333);
  assert.equal(attributes["Bleeding Duration"].final, 20);
  assert.equal(
    attributes["Condition Duration"].final +
      attributes["Bleeding Duration"].final,
    99.73333333333333,
  );
});

test("Bolstered Bonds follows both selected legends in build attributes", () => {
  const build = createRevenantBuildDefaults();
  build.specializations = [{ name: "Conduit", traits: "1-1-1" }];
  build.selectedLegends = [LEGEND.ASSASSIN, LEGEND.ENTITY];

  const app = { build, attributeWeaponSet: 1, results: null };
  recalculateRevenant(app);
  const assassin = app.attributeData.attributes;
  assert.equal(assassin.Power.traits, 150);
  assert.equal(assassin.Precision.traits, 75);
  assert.equal(assassin.Ferocity.traits, 150);
  assert.equal(assassin["Condition Damage"].traits, 75);

  build.selectedLegends = [LEGEND.DWARF, LEGEND.ENTITY];
  recalculateRevenant(app);
  const dwarf = app.attributeData.attributes;
  assert.equal(dwarf.Power.traits, 75);
  assert.equal(dwarf.Toughness.traits, 225);
  assert.equal(dwarf.Vitality.traits, 225);
  assert.equal(dwarf.Ferocity.traits, 75);
});

test("Bolstered Bonds runtime only adds the temporary Cosmic Wisdom copy", () => {
  const attributes = {
    power: 1150,
    precision: 1075,
    ferocity: 150,
  };
  const context = {
    config: {
      specialization: "Conduit",
      attributeProvenance: {
        professionStaticRulesApplied: true,
      },
    },
    time: 1,
    runtime: {
      profession: {
        cosmicWisdomUntil: 0,
        selectedLegendIds: [LEGEND.ASSASSIN, LEGEND.ENTITY],
      },
    },
  };

  assert.deepEqual(
    revenantConduitRules.modifyAttributes(context, attributes),
    attributes,
  );

  context.runtime.profession.cosmicWisdomUntil = 5;
  const cosmic = revenantConduitRules.modifyAttributes(context, attributes);
  assert.equal(cosmic.power, 1300);
  assert.equal(cosmic.precision, 1150);
  assert.equal(cosmic.ferocity, 300);
});

test("Revenant exposes static minor attributes and conversions", () => {
  const salvation = createRevenantBuildDefaults();
  salvation.specializations = [{ name: "Salvation", traits: "1-1-1" }];
  const withLife = calculateRevenantAttributes(salvation).attributes;
  const withoutLife = calculateRevenantAttributes(
    salvation,
    [],
    1,
    "Life Attunement",
  ).attributes;
  assert.equal(
    withLife["Healing Power"].final - withoutLife["Healing Power"].final,
    120,
  );
  assert.equal(
    withLife.Concentration.final - withoutLife.Concentration.final,
    Math.round(withLife["Healing Power"].final * 0.07),
  );

  const retribution = createRevenantBuildDefaults();
  retribution.specializations = [{ name: "Retribution", traits: "1-1-2" }];
  const withVersed = calculateRevenantAttributes(retribution).attributes;
  const withoutVersed = calculateRevenantAttributes(
    retribution,
    [],
    1,
    "Versed in Stone",
  ).attributes;
  assert.equal(
    withVersed.Power.final - withoutVersed.Power.final,
    Math.round(withVersed.Toughness.final * 0.13),
  );

  const herald = createRevenantBuildDefaults();
  herald.specializations = [{ name: "Herald", traits: "1-1-1" }];
  assert.equal(
    traitDelta(
      calculateRevenantAttributes,
      herald,
      "Reinforced Potency",
      "Concentration",
    ),
    240,
  );
  assert.equal(
    traitDelta(
      calculateRevenantAttributes,
      herald,
      "Elevated Compassion",
      "Concentration",
    ),
    Math.round(
      calculateRevenantAttributes(herald).attributes.Power.final * 0.13,
    ),
  );
});

test("Brutal Momentum exposes its unconditional critical chance", () => {
  const build = createRevenantBuildDefaults();
  build.specializations = [{ name: "Renegade", traits: "1-1-1" }];

  assert.equal(
    traitDelta(
      calculateRevenantAttributes,
      build,
      "Brutal Momentum",
      "Critical Chance",
    ),
    10,
  );

  const runtime = revenantRenegadeRules.modifyCriticalChance(
    {
      config: {
        specialization: "Renegade",
        attributeProvenance: {
          professionStaticRulesApplied: true,
        },
        traitIds: [TRAIT.BRUTAL_MOMENTUM],
      },
      runtime: {
        profession: { endurance: 50, maximumEndurance: 100 },
      },
    },
    0.2,
  );
  assert.ok(Math.abs(runtime - 0.3) < 1e-9);
});

test("Death Perception exposes its unconditional critical chance", () => {
  const build = createNecromancerBuildDefaults();
  build.specializations = [{ name: "Soul Reaping", traits: "1-1-2" }];

  assert.equal(
    traitDelta(
      calculateNecromancerAttributes,
      build,
      "Death Perception",
      "Critical Chance",
    ),
    15,
  );
});

test("Numinous Gift's static duration improvement appears in build stats", () => {
  const build = createRevenantBuildDefaults();
  build.specializations = [
    { name: "Corruption", traits: "1-1-1" },
    { name: "Conduit", traits: "1-1-1" },
  ];

  const all = calculateRevenantAttributes(build).attributes;
  const withoutNuminous = calculateRevenantAttributes(
    build,
    [],
    1,
    "Numinous Gift",
  ).attributes;
  assert.equal(all["Bleeding Duration"].traits, 15);
  assert.equal(withoutNuminous["Bleeding Duration"].traits, 10);
});

test("Thief weapon traits use the displayed weapon set", () => {
  const build = createThiefBuildDefaults();
  build.specializations = [{ name: "Deadly Arts", traits: "1-1-1" }];
  build.weapons = ["Dagger", "Dagger"];
  build.alternateWeapons = ["Sword", "Pistol"];

  const dagger = calculateThiefAttributes(build, [], 1).attributes;
  const sword = calculateThiefAttributes(build, [], 2).attributes;
  assert.equal(dagger.Power.traits, 160);
  assert.equal(sword.Power.traits, 80);
});

test("Thief uses current flat trait and conversion values", () => {
  const deadlyArts = createThiefBuildDefaults();
  deadlyArts.specializations = [{ name: "Deadly Arts", traits: "3-3-3" }];
  assert.equal(
    traitDelta(
      calculateThiefAttributes,
      deadlyArts,
      "Deadly Ambition",
      "Condition Damage",
    ),
    180,
  );
  assert.equal(
    traitDelta(
      calculateThiefAttributes,
      deadlyArts,
      "Revealed Training",
      "Power",
    ),
    80,
  );

  const criticalStrikes = createThiefBuildDefaults();
  criticalStrikes.specializations = [
    { name: "Critical Strikes", traits: "1-2-1" },
  ];
  const precision =
    calculateThiefAttributes(criticalStrikes).attributes.Precision.final;
  assert.equal(
    traitDelta(
      calculateThiefAttributes,
      criticalStrikes,
      "Practiced Tolerance",
      "Ferocity",
    ),
    Math.round(precision * 0.1),
  );

  const specter = createThiefBuildDefaults();
  specter.specializations = [{ name: "Specter", traits: "1-1-1" }];
  specter.weapons = ["Scepter", "Dagger"];
  specter.alternateWeapons = ["Dagger", "Dagger"];
  assert.equal(
    traitDelta(
      calculateThiefAttributes,
      specter,
      "Second Opinion",
      "Condition Damage",
      [],
      1,
    ),
    180,
  );
  assert.equal(
    traitDelta(
      calculateThiefAttributes,
      specter,
      "Second Opinion",
      "Condition Damage",
      [],
      2,
    ),
    90,
  );
  assert.equal(
    traitDelta(
      calculateThiefAttributes,
      specter,
      "Strength of Shadows",
      "Expertise",
    ),
    Math.round(
      calculateThiefAttributes(specter).attributes.Vitality.final * 0.13,
    ),
  );
});
