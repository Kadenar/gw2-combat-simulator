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
  assert.equal(rangerCatalog.skills.length, 291);
  assert.equal(Object.keys(RANGER_SKILL_MECHANICS).length, 289);
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
  assert.equal(migrated.selectedPet, "Lynx");
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
  assert.equal(petGroup.selections[0].selectionValue, "Lynx");
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
    false,
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
    18,
  );

  const baseline = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
  });
  const farsighted = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.FARSIGHTED],
  });
  assert.equal(farsighted.totalDamage > baseline.totalDamage, true);
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
