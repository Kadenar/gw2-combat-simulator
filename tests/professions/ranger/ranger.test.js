import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionOptions,
} from "../../../js/app/profession/registry.js";
import { professionRoute } from "../../../js/app/profession/selector.js";
import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import {
  createRangerBuildDefaults,
  migrateRangerBuild,
  validateRangerBuild,
} from "../../../js/professions/ranger/build.js";
import {
  RANGER_ELITE_SPECIALIZATIONS,
  rangerCatalog,
} from "../../../js/professions/ranger/catalog.js";
import { DATA_SNAPSHOT } from "../../../js/professions/ranger/data/ranger-api-metadata.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_SPECIALIZATION_IDS as SPECIALIZATION,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../../js/professions/ranger/data/ids.js";
import { RANGER_PETS } from "../../../js/professions/ranger/data/ranger-pet-data.js";
import { RANGER_TRAIT_COVERAGE } from "../../../js/professions/ranger/data/trait-coverage.js";
import { rangerProfession } from "../../../js/professions/ranger/definition.js";
import { RANGER_SKILL_MECHANICS } from "../../../js/professions/ranger/mechanics/skill-mechanics.js";
import {
  rangerAppAdapter,
  calculateAttributes,
  recalculate,
  runSimulation,
} from "../../../js/professions/ranger/app/app-definition.js";

const baseConfig = Object.freeze({
  initialAstralForce: 100,
  initialArrows: 8,
  selectedPet: "Lynx",
  selectedHammerSkillIds: [
    ID.WILD_SWING,
    ID.OVERBEARING_SMASH,
    ID.SAVAGE_SHOCK_WAVE,
    ID.THUMP,
  ],
  professionAssumptions: {
    flanking: true,
    targetDefiant: true,
  },
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000,
  },
  target: {
    armor: 2597,
    defiant: true,
    flanking: true,
    conditions: { Vulnerability: 25 },
  },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: rangerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      professionAssumptions: {
        ...baseConfig.professionAssumptions,
        ...(config.professionAssumptions || {}),
      },
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
    mode: "sequence",
  });
}

test("Ranger catalog pins API identity and explicit module-owned mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-08-08");
  assert.equal(rangerCatalog.specializations.length, 9);
  assert.equal(rangerCatalog.traits.length, 108);
  assert.equal(rangerCatalog.skills.length, 296);
  assert.equal(Object.keys(RANGER_SKILL_MECHANICS).length, 291);
  assert.equal(
    rangerCatalog.skillsById.has(ID.OVERBEARING_SMASH_SECOND_STRIKE),
    false,
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.PATH_OF_SCARS_MAX_RANGE).variantBadge,
    "MAX",
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.PATH_OF_SCARS).variantBadge,
    undefined,
  );
  assert.equal(RANGER_PETS.length, 66);
  assert.equal(
    RANGER_PETS.every(
      (pet) =>
        pet.beastmodeSkillIds.length === 3 &&
        pet.beastmodeSkillIds.every((id) => rangerCatalog.skillsById.has(id)),
    ),
    true,
  );
  assert.equal(
    rangerCatalog.skills.every(
      (skill) => skill.implemented || skill.simulatorExcluded,
    ),
    true,
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.BEES_STING).simulatorExcluded,
    true,
  );
  assert.equal(
    rangerCatalog.skills
      .filter((skill) => skill.petSkill || skill.unleashedPetSkill)
      .every((skill) => skill.independentCast),
    true,
  );
  assert.deepEqual(RANGER_ELITE_SPECIALIZATIONS, [
    "Druid",
    "Soulbeast",
    "Untamed",
    "Galeshot",
  ]);
  assert.equal(SPECIALIZATION.DRUID, 5);
  assert.equal(SPECIALIZATION.SOULBEAST, 55);
  assert.equal(SPECIALIZATION.UNTAMED, 72);
  assert.equal(SPECIALIZATION.GALESHOT, 78);
  assert.equal(rangerCatalog.skillsById.get(ID.RAPID_FIRE).name, "Rapid Fire");
  assert.equal(
    rangerCatalog.skillsById.get(ID.CELESTIAL_AVATAR).handlerId,
    "ranger.celestial-avatar-enter",
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.BEASTMODE).handlerId,
    "ranger.beastmode-enter",
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.UNLEASH_RANGER).handlerId,
    "ranger.unleash-ranger",
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.SUMMON_CYCLONE_BOW).handlerId,
    "ranger.cyclone-bow-enter",
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.SWAP_WEAPONS).handlerId,
    "ranger.weapon-swap",
  );
  assert.deepEqual(
    [
      ID.COSMIC_RAY,
      ID.SEED_OF_LIFE,
      ID.LUNAR_IMPACT,
      ID.REJUVENATING_TIDES,
      ID.NATURAL_CONVERGENCE,
    ].map((id) => rangerCatalog.skillsById.get(id).icon),
    [
      "https://render.guildwars2.com/file/ADD8B8B5B1EA72760ABB7313EAA8B0DAEC135F5E/1128620.png",
      "https://render.guildwars2.com/file/761706674AF9092C98D059AB03BD747BFC7DF506/1128623.png",
      "https://render.guildwars2.com/file/2708F4B3239D05C7A063FDC37838C9EFF5FCED50/1128625.png",
      "https://render.guildwars2.com/file/0C909F99672AC81E95167114B132F4BF03296E33/1128626.png",
      "https://render.guildwars2.com/file/08A7C5E751190ED5596C9112005D791D20AA3B31/1128629.png",
    ],
  );
});

test("Ranger builds migrate and validate against the canonical catalog", () => {
  const defaults = createRangerBuildDefaults();
  assert.deepEqual(validateRangerBuild(defaults), { valid: true, errors: [] });
  assert.equal(defaults.initialUntamedState, "Pet");
  assert.deepEqual(defaults.weapons, ["Hammer", ""]);
  assert.deepEqual(defaults.alternateWeapons, ["Axe", "Axe"]);
  assert.equal(defaults.relic, "Claw");
  assert.equal(defaults.selectedPet, "Pig");
  assert.deepEqual(defaults.selectedHammerSkillIds, [
    ID.UNLEASHED_WILD_SWING,
    ID.OVERBEARING_SMASH,
    ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
    ID.UNLEASHED_THUMP,
  ]);
  assert.equal(
    Object.hasOwn(defaults.assumptions, "playerHealthPercent"),
    false,
  );
  assert.equal(Object.hasOwn(defaults.assumptions, "targetDistance"), false);
  assert.deepEqual(
    rangerProfession.ui.assumptionControls.map((control) => control.key),
    ["flanking", "behind", "targetDefiant", "simulationMode"],
  );

  const migrated = migrateRangerBuild({
    ...defaults,
    initialAstralForce: 500,
    initialArrows: -4,
    initialUntamedState: "Ranger",
    assumptions: {
      selectedPet: "Lynx",
      soulbeastArchetype: "Ferocious",
      playerHealthPercent: 10,
      targetDistance: 1500,
    },
  });
  assert.equal(migrated.initialAstralForce, 100);
  assert.equal(migrated.initialArrows, 0);
  assert.equal(migrated.selectedPet, "Pig");
  assert.equal(migrated.initialUntamedState, "Ranger");
  assert.equal(Object.hasOwn(migrated.assumptions, "selectedPet"), false);
  assert.equal(
    Object.hasOwn(migrated.assumptions, "soulbeastArchetype"),
    false,
  );
  assert.equal(
    Object.hasOwn(migrated.assumptions, "playerHealthPercent"),
    false,
  );
  assert.equal(Object.hasOwn(migrated.assumptions, "targetDistance"), false);
  assert.deepEqual(validateRangerBuild(migrated), { valid: true, errors: [] });
  assert.throws(
    () => migrateRangerBuild({ profession: "necromancer" }),
    /Cannot load necromancer build as Ranger/,
  );

  const withoutLegacyOverbearingStage = migrateRangerBuild({
    ...defaults,
    rotation: [
      "Hammer Strike",
      { name: "Overbearing Smash (Follow-Up)", skillId: 63201 },
      "Hammer Slam",
    ],
  });
  assert.deepEqual(
    withoutLegacyOverbearingStage.rotation.map((command) => command.skillId),
    [ID.HAMMER_STRIKE, ID.HAMMER_SLAM],
  );
});

test("Power Soulbeast benchmark preset follows the supplied EVTC", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/ranger/b-power-soulbeast-hammer-axe.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/ranger/r-power-soulbeast-hammer-axe-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateRangerBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const row = (name) => result.breakdown.find((entry) => entry.name === name);

  assert.deepEqual(result.warnings, []);
  assert.equal(
    savedRotation.rotation.some(
      (entry) =>
        (typeof entry === "string" ? entry : entry.name) ===
        "Overbearing Smash (Follow-Up)",
    ),
    false,
  );
  assert.deepEqual(build.weaponSigils, [
    ["Force", "Air"],
    ["Force", "Impact"],
  ]);
  assert.equal(row("Whirling Defense").hits, 48);
  assert.equal(row("Splitblade").hits, 60);
  assert.equal(row("Unleashed Savage Shock Wave").hits, 24);
  assert.equal(row("Path of Scars").hits, 8);
  assert.equal(row("Path of Scars (Max Range)").hits, 8);
  assert.equal(row("One Wolf Pack").hits, 11);
  assert.equal(row("Overbearing Smash").hits, 6);
  assert.equal(row("Sigil of Air").hits, 17);
  assert.equal(row("Sharpened Edges — Bleeding").damage > 0, true);
  assert.equal(
    Math.abs(result.dps - savedRotation.metadata.benchmarkDps) /
      savedRotation.metadata.benchmarkDps <
      0.08,
    true,
  );
});

test("Core Ranger exposes only the selected pet Beast skill", () => {
  assert.equal(
    RANGER_PETS.find((pet) => pet.name === "Lynx").skillIds.includes(
      ID.RENDING_POUNCE,
    ),
    true,
  );
  const result = simulate("Core", ["Rapid Fire", "Rending Pounce"], {
    primaryWeapon: "Longbow",
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activePet, "Lynx");
  assert.equal(
    result.endState.profession.activePetSkillIds.includes(ID.RENDING_POUNCE),
    true,
  );
  assert.equal(result.totalDamage > 0, true);

  const swapped = simulate("Core", ["Swap Weapons"]);
  assert.deepEqual(swapped.warnings, []);
  assert.equal(swapped.endState.activeWeaponSet, 2);

  const wrongPet = simulate("Core", ["Rending Pounce"], {
    selectedPet: "Jungle Stalker",
  });
  assert.match(wrongPet.warnings[0], /select the pet that owns/);

  const overlapping = simulate(
    "Core",
    ["Rapid Fire", "Rending Pounce", "Point-Blank Shot"],
    { primaryWeapon: "Longbow" },
  );
  const rapidFire = overlapping.steps.find(
    (step) => step.skill === "Rapid Fire",
  );
  const rendingPounce = overlapping.steps.find(
    (step) => step.skill === "Rending Pounce",
  );
  const pointBlankShot = overlapping.steps.find(
    (step) => step.skill === "Point-Blank Shot",
  );
  assert.equal(rendingPounce.start, rapidFire.start);
  assert.equal(pointBlankShot.start, rapidFire.end);
});

test("Core Ranger resolves Winter's Bite readiness events", () => {
  const result = simulate("Core", ["Winter's Bite"], {
    primaryWeapon: "Axe",
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.winterBiteReady, true);
});

test("Druid gates, drains, and releases Celestial Avatar", () => {
  const blocked = simulate("Druid", ["Natural Convergence"], {
    initialAstralForce: 100,
  });
  assert.match(blocked.warnings[0], /enter Celestial Avatar/);

  const entered = simulate("Druid", ["Celestial Avatar"]);
  assert.deepEqual(entered.warnings, []);
  assert.equal(entered.endState.profession.astralForce, 100);
  assert.equal(entered.endState.profession.celestialAvatarActive, true);
  assert.equal(
    entered.endState.profession.availableFlips[ID.RELEASE_CELESTIAL_AVATAR],
    15,
  );

  const draining = simulate("Druid", [
    "Celestial Avatar",
    { type: "wait", durationMs: 5000 },
  ]);
  assert.equal(draining.endState.profession.astralForce, 100 * (10 / 15));
  assert.equal(draining.endState.profession.celestialAvatarActive, true);
  assert.equal(
    rangerProfession.ui.paletteSkillAvailability(
      {
        specialization: "Druid",
        professionState: draining.endState.profession,
      },
      rangerCatalog.skillsById.get(ID.RELEASE_CELESTIAL_AVATAR),
    ).available,
    true,
  );

  const result = simulate("Druid", [
    "Celestial Avatar",
    "Natural Convergence",
    "Release Celestial Avatar",
  ]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.astralForce, 0);
  assert.equal(result.endState.profession.celestialAvatarActive, false);
  assert.equal(
    Object.hasOwn(
      result.endState.profession.availableFlips,
      ID.RELEASE_CELESTIAL_AVATAR,
    ),
    false,
  );
  assert.equal(result.totalDamage > 0, true);
});

test("Soulbeast starts merged and grants only the selected pet's Beast skills", () => {
  const blocked = simulate("Soulbeast", ["Smoke Assault"]);
  assert.match(blocked.warnings[0], /select the pet that grants/);

  const result = simulate("Soulbeast", ["Smoke Assault"], {
    selectedPet: "Smokescale",
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.beastmodeActive, true);
  assert.equal(result.endState.profession.archetype, "Ferocious");
  assert.equal(result.totalDamage > 0, true);

  const leftBeastmode = simulate(
    "Soulbeast",
    ["Leave Beastmode", "Smoke Assault"],
    { selectedPet: "Smokescale" },
  );
  assert.match(leftBeastmode.warnings[0], /enter Beastmode/);
});

test("Hammer variants are selected for every Ranger specialization", () => {
  const blocked = simulate("Untamed", ["Unleashed Wild Swing"], {
    primaryWeapon: "Hammer",
  });
  assert.match(blocked.warnings[0], /select this Hammer variant/);

  const result = simulate(
    "Untamed",
    ["Unleash Ranger", "Unleashed Wild Swing", "Unleash Pet"],
    {
      primaryWeapon: "Hammer",
      selectedHammerSkillIds: [
        ID.UNLEASHED_WILD_SWING,
        ID.OVERBEARING_SMASH,
        ID.SAVAGE_SHOCK_WAVE,
        ID.THUMP,
      ],
    },
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.rangerUnleashed, false);
  assert.equal(result.endState.profession.ambushReadyUntil > 0, true);
  assert.equal(result.totalDamage > 0, true);

  const standardWhileUnleashed = simulate(
    "Untamed",
    ["Unleash Ranger", "Wild Swing"],
    { primaryWeapon: "Hammer" },
  );
  assert.deepEqual(standardWhileUnleashed.warnings, []);

  const druidBlocked = simulate("Druid", ["Unleashed Wild Swing"], {
    primaryWeapon: "Hammer",
  });
  assert.match(druidBlocked.warnings[0], /select this Hammer variant/);
  const druidSelected = simulate("Druid", ["Unleashed Wild Swing"], {
    primaryWeapon: "Hammer",
    selectedHammerSkillIds: [
      ID.UNLEASHED_WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.SAVAGE_SHOCK_WAVE,
      ID.THUMP,
    ],
  });
  assert.deepEqual(druidSelected.warnings, []);
});

test("Untamed starts in the selected unleashed state", () => {
  const pet = simulate("Untamed", [], { initialUntamedState: "Pet" });
  const ranger = simulate("Untamed", [], { initialUntamedState: "Ranger" });

  assert.equal(pet.endState.profession.rangerUnleashed, false);
  assert.equal(ranger.endState.profession.rangerUnleashed, true);

  const availability = (professionState, skillId) =>
    rangerProfession.ui.paletteSkillAvailability(
      { specialization: "Untamed", professionState },
      rangerCatalog.skillsById.get(skillId),
    ).available;
  assert.equal(availability(pet.endState.profession, ID.UNLEASH_RANGER), true);
  assert.equal(availability(pet.endState.profession, ID.UNLEASH_PET), false);
  assert.equal(
    availability(ranger.endState.profession, ID.UNLEASH_RANGER),
    false,
  );
  assert.equal(availability(ranger.endState.profession, ID.UNLEASH_PET), true);
});

test("Ranger skill-bar selections drive pet and Hammer selection", () => {
  const build = createRangerBuildDefaults();
  const soulbeastContext = {
    build,
    specialization: "Soulbeast",
    config: { specialization: "Soulbeast", selectedPet: build.selectedPet },
    catalog: rangerCatalog,
    professionState: rangerProfession
      .resolveRuntime({ specialization: "Soulbeast" })
      .createProfessionState({
        specialization: "Soulbeast",
        selectedPet: build.selectedPet,
      }),
  };
  assert.equal(
    rangerProfession.ui.assumptionControls.some(
      (control) =>
        control.key === "selectedPet" || control.key === "soulbeastArchetype",
    ),
    false,
  );
  const petGroup = rangerProfession.ui
    .skillBarGroups(soulbeastContext)
    .find((group) => group.id === "ranger-pet-selection");
  assert.equal(petGroup.label, "Pet");
  assert.equal(petGroup.layout, "ranger-mechanics ranger-soulbeast-mechanics");
  assert.equal(
    rangerProfession.ui
      .skillBarGroups(soulbeastContext)
      .find((group) => group.id === "ranger-soulbeast-f5").className,
    "ranger-soulbeast-beastmode",
  );
  assert.equal(petGroup.selections[0].selectionValue, "Pig");
  assert.equal(petGroup.selections[0].optionEntries.length, RANGER_PETS.length);
  assert.equal(
    rangerProfession.ui.updateSkillBarSelection(soulbeastContext, {
      key: "selectedPet",
      index: 0,
      value: "Smokescale",
    }),
    true,
  );
  const smokescale = RANGER_PETS.find((pet) => pet.name === "Smokescale");
  const mergedPetGroup = rangerProfession.ui
    .skillBarGroups(soulbeastContext)
    .find((group) => group.id === "ranger-pet-selection");
  assert.deepEqual(mergedPetGroup.skillIds, smokescale.beastmodeSkillIds);
  assert.equal(
    rangerProfession.ui
      .skillBarGroups(soulbeastContext)
      .some((group) => group.id === "ranger-beast-skills"),
    false,
  );
  assert.equal(
    rangerProfession.ui
      .paletteGroups(soulbeastContext)
      .find((group) => group.id === "ranger-soulbeast-profession")
      .skillIds.includes(ID.SMOKE_ASSAULT),
    true,
  );

  const untamedContext = {
    ...soulbeastContext,
    specialization: "Untamed",
    config: {
      specialization: "Untamed",
      selectedHammerSkillIds: build.selectedHammerSkillIds,
      initialUntamedState: build.initialUntamedState,
    },
    professionState: rangerProfession
      .resolveRuntime({ specialization: "Untamed" })
      .createProfessionState({ specialization: "Untamed" }),
  };
  assert.equal(
    rangerProfession.ui
      .skillBarGroups(untamedContext)
      .some((group) => group.id === "ranger-untamed-start-state"),
    false,
  );
  const untamedGroups = rangerProfession.ui.skillBarGroups(untamedContext);
  assert.equal(
    untamedGroups.find((group) => group.id === "ranger-pet-selection").layout,
    "ranger-mechanics ranger-untamed-mechanics",
  );
  assert.deepEqual(
    untamedGroups
      .filter((group) => group.id.startsWith("ranger-untamed-"))
      .map((group) => group.className),
    ["ranger-untamed-unleash", "ranger-untamed-pet-skills"],
  );
  const untamedStartControl =
    rangerProfession.ui.startControls(untamedContext)[0];
  assert.equal(untamedStartControl.label, "Start unleashed");
  assert.equal(untamedStartControl.buildKey, "initialUntamedState");
  assert.equal(untamedStartControl.value, "Pet");
  assert.deepEqual(
    untamedStartControl.options.map((entry) => entry.value),
    ["Pet", "Ranger"],
  );
  assert.equal(
    untamedStartControl.options.every((entry) => entry.icon),
    true,
  );
  for (const specialization of [
    "Core",
    "Druid",
    "Soulbeast",
    "Untamed",
    "Galeshot",
  ]) {
    const runtime = rangerProfession.resolveRuntime({ specialization });
    const context = {
      build,
      specialization,
      config: {
        specialization,
        selectedHammerSkillIds: build.selectedHammerSkillIds,
      },
      catalog: rangerCatalog,
      professionState: runtime.createProfessionState({ specialization }),
    };
    const hammer = rangerProfession.ui
      .skillBarGroups(context)
      .find((group) => group.id === "ranger-hammer-selection");
    assert.equal(hammer.label, "Hammer", specialization);
    assert.equal(hammer.selections.length, 4, specialization);
  }
  const hammerGroup = rangerProfession.ui
    .skillBarGroups(untamedContext)
    .find((group) => group.id === "ranger-hammer-selection");
  assert.deepEqual(
    hammerGroup.selections.map((selection) => selection.skillId),
    build.selectedHammerSkillIds,
  );
  assert.equal(
    rangerProfession.ui
      .skillBarGroups({
        ...untamedContext,
        build: {
          ...build,
          weapons: ["Axe", "Axe"],
          alternateWeapons: ["Longbow", ""],
        },
      })
      .some((group) => group.id === "ranger-hammer-selection"),
    false,
  );
  assert.equal(
    rangerProfession.ui.weaponSkillMatchesSet(
      rangerCatalog.skillsById.get(ID.UNLEASHED_WILD_SWING),
      ["Hammer", ""],
      untamedContext,
    ),
    true,
  );
  assert.equal(
    rangerProfession.ui.updateSkillBarSelection(untamedContext, {
      key: "selectedHammerSkillIds",
      index: 0,
      skillId: ID.UNLEASHED_WILD_SWING,
    }),
    true,
  );
  assert.equal(
    rangerProfession.ui
      .skillBarGroups(untamedContext)
      .find((group) => group.id === "ranger-hammer-selection").selections[0]
      .skillId,
    ID.UNLEASHED_WILD_SWING,
  );
  assert.equal(
    rangerProfession.ui
      .paletteGroups(untamedContext)
      .some((group) => group.id === "ranger-hammer"),
    false,
  );
});

test("Galeshot tracks Cyclone Bow arrows and Wind Force", () => {
  const blocked = simulate("Galeshot", ["Bluster"]);
  assert.match(blocked.warnings[0], /summon the Cyclone Bow/);

  const result = simulate("Galeshot", [
    "Summon Cyclone Bow",
    "Bluster",
    "Fleeting Zephyr",
    "Quarry's Peril",
    "Pelt",
    "Hawkeye",
  ]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.cycloneBowActive, true);
  assert.equal(result.endState.profession.windForce, 0);
  assert.equal(result.endState.profession.arrows < 8, true);
  assert.equal(result.totalDamage > 0, true);

  const charged = simulate("Galeshot", [
    "Summon Cyclone Bow",
    "Bluster",
    "Fleeting Zephyr",
    "Quarry's Peril",
    "Pelt",
  ]);
  const keenBlocked = simulate("Galeshot", [
    "Summon Cyclone Bow",
    "Bluster",
    "Fleeting Zephyr",
    "Quarry's Peril",
    "Pelt",
    "Keen Shot",
  ]);
  assert.match(keenBlocked.warnings[0], /Hawkeye replaces Keen Shot/);

  const weaponBlocked = simulate(
    "Galeshot",
    ["Summon Cyclone Bow", "Rapid Fire"],
    { primaryWeapon: "Longbow" },
  );
  assert.match(weaponBlocked.warnings[0], /replaces weapon skills/);

  const inactiveContext = {
    specialization: "Galeshot",
    professionState: rangerProfession
      .resolveRuntime({ specialization: "Galeshot" })
      .createProfessionState({ specialization: "Galeshot" }),
  };
  const dismiss = rangerCatalog.skillsById.get(ID.DISMISS_CYCLONE_BOW);
  assert.equal(
    rangerProfession.ui.paletteSkillAvailability(inactiveContext, dismiss)
      .available,
    false,
  );
  const activeContext = {
    specialization: "Galeshot",
    professionState: charged.endState.profession,
  };
  assert.equal(
    rangerProfession.ui.paletteSkillAvailability(
      activeContext,
      rangerCatalog.skillsById.get(ID.KEEN_SHOT),
    ).available,
    false,
  );
  assert.equal(
    rangerProfession.ui.paletteSkillAvailability(
      activeContext,
      rangerCatalog.skillsById.get(ID.HAWKEYE),
    ).available,
    true,
  );
  assert.equal(
    rangerProfession.ui.paletteSkillAvailability(
      activeContext,
      rangerCatalog.skillsById.get(ID.RAPID_FIRE),
    ).available,
    false,
  );
});

test("Ranger trait rules affect their owned damage and attributes", () => {
  assert.equal(RANGER_TRAIT_COVERAGE.length, 108);
  assert.equal(
    RANGER_TRAIT_COVERAGE.filter((entry) => entry.status === "implemented")
      .length,
    53,
  );

  const baseline = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
  });
  const farsighted = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.FARSIGHTED],
  });
  assert.equal(farsighted.totalDamage > baseline.totalDamage, true);

  const cycloneRotation = [
    "Summon Cyclone Bow",
    "Bluster",
    "Fleeting Zephyr",
    "Quarry's Peril",
    "Pelt",
  ];
  const cyclone = simulate("Galeshot", cycloneRotation);
  const farsightedCyclone = simulate("Galeshot", cycloneRotation, {
    selectedTraitIds: [TRAIT.FARSIGHTED],
  });
  assert.equal(farsightedCyclone.totalDamage, cyclone.totalDamage);

  const boonConfig = {
    primaryWeapon: "Longbow",
    boons: { alacrity: true, fury: true, regeneration: true },
  };
  const boonBaseline = simulate("Core", ["Rapid Fire"], boonConfig);
  const bountiful = simulate("Core", ["Rapid Fire"], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.BOUNTIFUL_HUNTER],
  });
  assert.ok(Math.abs(bountiful.totalDamage / boonBaseline.totalDamage - 1.03) < 1e-9);

  const survival = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.SURVIVAL_INSTINCTS],
  });
  const predator = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.PREDATORS_ONSLAUGHT],
  });
  const wolfsong = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.WOLFSONG],
  });
  assert.ok(Math.abs(survival.totalDamage / baseline.totalDamage - 1.15) < 1e-9);
  assert.ok(Math.abs(predator.totalDamage / baseline.totalDamage - 1.1) < 1e-9);
  assert.ok(Math.abs(wolfsong.totalDamage / baseline.totalDamage - 1.1) < 1e-9);

  const daggerBaseline = simulate("Core", ["Double Arc"], {
    primaryWeapon: "Dagger",
  });
  const ambidexterity = simulate("Core", ["Double Arc"], {
    primaryWeapon: "Dagger",
    selectedTraitIds: [TRAIT.AMBIDEXTERITY],
  });
  assert.ok(
    ambidexterity.endState.cooldowns["Double Arc"].readyAt <
      daggerBaseline.endState.cooldowns["Double Arc"].readyAt,
  );

  const poisonBaseline = simulate(
    "Core",
    ["Poison Volley", { type: "wait", durationMs: 10000 }],
    { primaryWeapon: "Shortbow" },
  );
  const strongerPoison = simulate(
    "Core",
    ["Poison Volley", { type: "wait", durationMs: 10000 }],
    {
      primaryWeapon: "Shortbow",
      selectedTraitIds: [TRAIT.POISON_MASTER],
    },
  );
  assert.ok(
    Math.abs(strongerPoison.conditionDamage / poisonBaseline.conditionDamage - 1.25) <
      1e-9,
  );

  const skirmishing = simulate(
    "Soulbeast",
    ["__combat_start", "Swap Weapons", "Whirling Defense"],
    {
      selectedPet: "Pig",
      primaryWeapon: "Hammer",
      weaponSet2Primary: "Axe",
      weaponSet2Secondary: "Axe",
      boons: { fury: true, quickness: true, alacrity: true },
      selectedTraitIds: [
        TRAIT.TAIL_WIND,
        TRAIT.FURIOUS_GRIP,
        TRAIT.SHARPENED_EDGES,
        TRAIT.HUNTERS_TACTICS,
        TRAIT.VICIOUS_QUARRY,
      ],
    },
  );
  assert.deepEqual(skirmishing.warnings, []);
  assert.equal(
    skirmishing.events.some(
      (event) => event.type === "buff" && event.kind === "swiftness",
    ),
    true,
  );
  assert.equal(
    skirmishing.events.some(
      (event) => event.type === "buff" && event.kind === "fury",
    ),
    true,
  );
  assert.equal(
    skirmishing.breakdown.some(
      (entry) =>
        entry.name === "Sharpened Edges — Bleeding" && entry.damage > 0,
    ),
    true,
  );
});

test("Ranger Nature Magic traits grant support and share boons with pets", () => {
  const healing = simulate("Core", [
    "Troll Unguent",
    "Hunter's Call",
    { type: "wait", durationMs: 10000 },
  ], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Warhorn",
    selectedTraitIds: [
      TRAIT.WELLSPRING,
      TRAIT.CHILD_OF_EARTH,
      TRAIT.WINDBORNE_NOTES,
      TRAIT.LINGERING_MAGIC,
    ],
  });
  const wells = healing.events.find(
    (event) => event.sourceId === TRAIT.WELLSPRING,
  );
  const notes = healing.events.find(
    (event) => event.sourceId === TRAIT.WINDBORNE_NOTES,
  );
  assert.equal(wells.kind, "regeneration");
  assert.equal(notes.kind, "regeneration");
  assert.ok(Math.abs(wells.duration - 6.96) < 1e-9);
  assert.ok(Math.abs(notes.duration - 6.96) < 1e-9);
  assert.equal(
    healing.events.filter(
      (event) =>
        event.sourceId === TRAIT.CHILD_OF_EARTH &&
        event.condition === "Crippled",
    ).length,
    5,
  );
  assert.equal(
    healing.events.filter(
      (event) =>
        event.sourceId === TRAIT.CHILD_OF_EARTH &&
        event.condition === "Slow",
    ).length,
    5,
  );
  assert.equal(
    healing.events.filter(
      (event) =>
        event.sourceId === TRAIT.CHILD_OF_EARTH &&
        event.condition === "Immobilized",
    ).length,
    1,
  );

  const beast = simulate("Core", ["Intimidating Howl"], {
    selectedPet: "Krytan Drakehound",
    selectedTraitIds: [
      TRAIT.REJUVENATION,
      TRAIT.WOLFSONG,
      TRAIT.LINGERING_MAGIC,
    ],
  });
  const rejuvenation = beast.events.find(
    (event) => event.sourceId === TRAIT.REJUVENATION,
  );
  assert.ok(Math.abs(rejuvenation.duration - 11.6) < 1e-9);
  assert.equal(
    beast.events.some(
      (event) =>
        event.sourceId === TRAIT.WOLFSONG &&
        event.kind === "target-vulnerability" &&
        event.stacks === 6 &&
        event.duration === 6,
    ),
    true,
  );

  const unshared = simulate("Core", ["Call of the Wild", "Intimidating Howl"], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Warhorn",
    selectedPet: "Krytan Drakehound",
    sharePlayerBoonsWithSummons: false,
  });
  const shared = simulate("Core", ["Call of the Wild", "Intimidating Howl"], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Warhorn",
    selectedPet: "Krytan Drakehound",
    sharePlayerBoonsWithSummons: false,
    selectedTraitIds: [TRAIT.FORTIFYING_BOND],
  });
  const petHit = (result) =>
    result.resolvedEvents.find(
      (event) => event.skillId === ID.INTIMIDATING_HOWL,
    ).damage;
  assert.equal(petHit(shared) > petHit(unshared), true);

  const permanentBoons = {
    selectedPet: "Krytan Drakehound",
    sharePlayerBoonsWithSummons: false,
    boons: { fury: true, might: 6, regeneration: true },
    selectedTraitIds: [TRAIT.FORTIFYING_BOND],
  };
  const fortified = simulate("Core", ["Intimidating Howl"], permanentBoons);
  const fortifiedWithoutFury = simulate("Core", ["Intimidating Howl"], {
    ...permanentBoons,
    boons: { might: 6, regeneration: true },
  });
  const fortifiedBountiful = simulate("Core", ["Intimidating Howl"], {
    ...permanentBoons,
    selectedTraitIds: [TRAIT.FORTIFYING_BOND, TRAIT.BOUNTIFUL_HUNTER],
  });
  const fortifiedHit = fortified.resolvedEvents.find(
    (event) => event.skillId === ID.INTIMIDATING_HOWL,
  );
  const fortifiedHitWithoutFury = fortifiedWithoutFury.resolvedEvents.find(
    (event) => event.skillId === ID.INTIMIDATING_HOWL,
  );
  assert.ok(
    Math.abs(
      fortifiedHit.criticalChance -
        fortifiedHitWithoutFury.criticalChance -
        0.25,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(petHit(fortifiedBountiful) / petHit(fortified) - 1.03) < 1e-9,
  );
  const merged = simulate("Soulbeast", ["Call of the Wild"], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Warhorn",
    selectedTraitIds: [TRAIT.FORTIFYING_BOND],
  });
  assert.equal(
    merged.resolvedEvents.some(
      (event) => event.sourceId === TRAIT.FORTIFYING_BOND,
    ),
    false,
  );
});

test("Ranger pet-swap and Marksmanship traits resolve at their combat timings", () => {
  const swapped = simulate("Core", ["__combat_start", "Swap Pets"], {
    selectedTraitIds: [TRAIT.SPIRITED_ARRIVAL, TRAIT.CLARION_BOND],
  });
  assert.deepEqual(swapped.warnings, []);
  assert.equal(swapped.endState.profession.petSwapCount, 1);
  assert.equal(
    swapped.events.some(
      (event) =>
        event.sourceId === TRAIT.SPIRITED_ARRIVAL &&
        event.kind === "might" &&
        event.stacks === 6 &&
        event.duration === 12,
    ),
    true,
  );
  assert.equal(
    swapped.events.some(
      (event) =>
        event.sourceId === TRAIT.SPIRITED_ARRIVAL &&
        event.kind === "fury" &&
        event.duration === 8,
    ),
    true,
  );
  assert.equal(
    swapped.events.some(
      (event) =>
        event.sourceId === TRAIT.CLARION_BOND &&
        event.type === "blast_combo",
    ),
    true,
  );
  assert.equal(
    swapped.events.some(
      (event) =>
        event.sourceId === TRAIT.CLARION_BOND &&
        event.condition === "Weakness" &&
        event.duration === 5,
    ),
    true,
  );

  const opening = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [
      TRAIT.OPENING_STRIKE,
      TRAIT.ALPHA_FOCUS,
      TRAIT.PRECISE_STRIKE,
      TRAIT.REMORSELESS,
    ],
  });
  const rapidHits = opening.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillId === ID.RAPID_FIRE,
  );
  assert.equal(rapidHits[0].criticalChance, 1);
  assert.equal(rapidHits[1].criticalChance < 1, true);
  assert.equal(
    opening.resolvedEvents.some(
      (event) =>
        event.sourceId === TRAIT.OPENING_STRIKE &&
        event.condition === "Vulnerability" &&
        event.stacks === 5,
    ),
    true,
  );

  const openingWithoutRemorseless = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.OPENING_STRIKE, TRAIT.PRECISE_STRIKE],
  });
  const firstOpeningHit = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.skillId === ID.RAPID_FIRE,
    ).damage;
  assert.ok(
    Math.abs(
      firstOpeningHit(opening) / firstOpeningHit(openingWithoutRemorseless) -
        1.25,
    ) < 1e-9,
  );

  const rearmed = simulate(
    "Core",
    ["Rapid Fire", "Swap Weapons", "Call of the Wild", "Winter's Bite"],
    {
      primaryWeapon: "Longbow",
      weaponSet2Primary: "Axe",
      weaponSet2Secondary: "Warhorn",
      selectedTraitIds: [TRAIT.OPENING_STRIKE, TRAIT.REMORSELESS],
    },
  );
  assert.equal(
    rearmed.resolvedEvents.filter(
      (event) => event.sourceId === TRAIT.OPENING_STRIKE,
    ).length,
    2,
  );
  assert.equal(
    opening.resolvedEvents.some(
      (event) =>
        event.sourceId === TRAIT.ALPHA_FOCUS &&
        event.condition === "Crippled",
    ),
    true,
  );

  const gaze = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    target: { health: 1 },
    selectedTraitIds: [TRAIT.HUNTERS_GAZE],
  });
  const gazeApplications = gaze.procSteps.filter(
    (step) => step.skill === "Hunter's Gaze",
  );
  assert.equal(gazeApplications.length, 1);
  assert.equal(gazeApplications[0].detail, "3 might");
});

test("Ranger Wilderness Survival traits cover endurance, poison, and disables", () => {
  const baseDodge = simulate("Core", ["Dodge", "Dodge", "Dodge"]);
  const naturalVigor = simulate("Core", ["Dodge", "Dodge", "Dodge"], {
    selectedTraitIds: [TRAIT.NATURAL_VIGOR],
  });
  assert.equal(naturalVigor.steps[2].start < baseDodge.steps[2].start, true);

  const carnivore = simulate("Core", ["Concussion Shot"], {
    primaryWeapon: "Shortbow",
    selectedTraitIds: [TRAIT.CARNIVORE],
  });
  const stolen = carnivore.resolvedEvents.find(
    (event) => event.sourceId === TRAIT.CARNIVORE,
  );
  assert.equal(stolen.damageKind, "life-steal");
  assert.equal(stolen.coefficient, 0.05);

  const spider = simulate(
    "Core",
    ["Spit", { type: "wait", durationMs: 4000 }],
    {
      selectedPet: "Forest Spider",
      selectedTraitIds: [TRAIT.ARACHNOPHOBIA],
    },
  );
  const devourer = simulate(
    "Core",
    ["Twin Darts", { type: "wait", durationMs: 4000 }],
    {
      selectedPet: "Carrion Devourer",
      selectedTraitIds: [TRAIT.ARACHNOPHOBIA],
    },
  );
  for (const result of [spider, devourer]) {
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some(
        (event) =>
          event.sourceId === TRAIT.ARACHNOPHOBIA &&
          event.condition === "Torment" &&
          event.stacks === 1 &&
          event.duration === 3,
      ),
      true,
    );
  }

  const poisonMaster = simulate(
    "Core",
    [
      "__combat_start",
      "Intimidating Howl",
      { type: "wait", durationMs: 20500 },
      "Intimidating Howl",
    ],
    {
      selectedPet: "Krytan Drakehound",
      selectedTraitIds: [TRAIT.POISON_MASTER],
    },
  );
  assert.equal(
    poisonMaster.resolvedEvents.some(
      (event) =>
        event.sourceId === TRAIT.POISON_MASTER &&
        event.condition === "Poisoned" &&
        event.stacks === 2 &&
        event.duration === 8,
    ),
    true,
  );

  const build = createRangerBuildDefaults();
  build.specializations = [
    { name: "Nature Magic", traits: "2-1-1" },
    { name: "Wilderness Survival", traits: "3-1-1" },
  ];
  build.weapons = ["Dagger", "Torch"];
  const attributes = calculateAttributes(build).attributes;
  const withoutWellspring = calculateAttributes(
    build,
    [],
    1,
    "Wellspring",
  ).attributes;
  const withoutArachnophobia = calculateAttributes(
    build,
    [],
    1,
    "Arachnophobia",
  ).attributes;
  const withoutAmbidexterity = calculateAttributes(
    build,
    [],
    1,
    "Ambidexterity",
  ).attributes;
  assert.equal(
    attributes.Expertise.final - withoutArachnophobia.Expertise.final,
    150,
  );
  assert.equal(
    attributes["Condition Damage"].final -
      withoutAmbidexterity["Condition Damage"].final,
    240,
  );
  assert.equal(
    attributes["Healing Power"].final -
      withoutWellspring["Healing Power"].final,
    attributes.Power.final * 0.07,
  );
});

test("Ranger is wired through the selector and application adapter", async () => {
  const page = await readFile(
    new URL("../../../ranger.html", import.meta.url),
    "utf8",
  );
  assert.equal(
    professionOptions.some((option) => option.id === "ranger"),
    true,
  );
  assert.equal(professionRoute("ranger"), "ranger.html");
  assert.equal((await loadProfession("ranger"))?.id, "ranger");
  assert.equal((await loadProfessionAppAdapter("ranger"))?.id, "ranger");
  assert.match(page, /data-profession="ranger"/);
  assert.match(page, /data-active-profession="ranger"/);
});
