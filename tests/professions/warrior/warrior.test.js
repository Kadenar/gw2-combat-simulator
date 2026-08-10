import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionOptions,
} from "../../../js/app/profession/registry.js";
import { professionRoute } from "../../../js/app/profession/selector.js";
import { skillBarInspectionStacks } from "../../../js/app/build/skills-panel.js";
import { autoattackChainSkillAvailable } from "../../../js/app/rotation/palette-model.js";
import { simulationEventLogRows } from "../../../js/app/rotation/event-log.js";
import { activeResourceGroup } from "../../../js/app/rotation/resource-view.js";
import { createSimulationRandom } from "../../../js/platform/engine/simulation-random.js";
import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import {
  createWarriorBuildDefaults,
  migrateWarriorBuild,
  validateWarriorBuild,
} from "../../../js/professions/warrior/build.js";
import {
  WARRIOR_ELITE_SPECIALIZATIONS,
  warriorCatalog,
} from "../../../js/professions/warrior/catalog.js";
import { warriorCoreModule } from "../../../js/professions/warrior/core/module.js";
import {
  recalculate,
  runSimulation,
  warriorAppAdapter,
} from "../../../js/professions/warrior/app/app-definition.js";
import { createWarriorCoreState } from "../../../js/professions/warrior/core/state.js";
import { DATA_SNAPSHOT } from "../../../js/professions/warrior/data/warrior-api-metadata.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../../js/professions/warrior/data/ids.js";
import { warriorProfession } from "../../../js/professions/warrior/definition.js";
import { berserkerModule } from "../../../js/professions/warrior/specializations/berserker/module.js";
import { berserkerAttributeRules } from "../../../js/professions/warrior/specializations/berserker/rules.js";
import { bladeswornModule } from "../../../js/professions/warrior/specializations/bladesworn/module.js";
import { advanceBladesworn } from "../../../js/professions/warrior/specializations/bladesworn/traits.js";
import { createBladeswornState } from "../../../js/professions/warrior/specializations/bladesworn/state.js";
import { paragonModule } from "../../../js/professions/warrior/specializations/paragon/module.js";
import { spellbreakerModule } from "../../../js/professions/warrior/specializations/spellbreaker/module.js";
import { spellbreakerAttributeRules } from "../../../js/professions/warrior/specializations/spellbreaker/rules.js";
import { assertProfessionFamilyConformance } from "../../helpers/profession-family-conformance.js";

const baseConfig = Object.freeze({
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
    health: 3_970_000,
    defiant: true,
    conditions: { Vulnerability: 25 },
  },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: warriorProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
    mode: "sequence",
  });
}

test("Warrior catalog pins the API snapshot and all elite specializations", () => {
  assert.equal(DATA_SNAPSHOT, "2026-08-08");
  assert.equal(warriorCatalog.specializations.length, 9);
  assert.equal(warriorCatalog.traits.length, 108);
  assert.equal(warriorCatalog.skills.length, 209);
  assert.deepEqual(WARRIOR_ELITE_SPECIALIZATIONS, [
    "Berserker",
    "Spellbreaker",
    "Bladesworn",
    "Paragon",
  ]);
  assert.equal(warriorCatalog.weaponHands.get("Torch"), "oh");
  assert.equal(warriorCatalog.skillsById.get(ID.EVISCERATE).name, "Eviscerate");
  assert.equal(
    warriorCatalog.skills.every(
      (skill) => skill.implemented || skill.simulatorExcluded,
    ),
    true,
  );
  assert.equal(
    warriorCatalog.skills.some(
      (skill) => skill.id === 62857 || skill.name === "((996787))",
    ),
    false,
  );

  const excludedSkillIds = [
    ID.SHAKE_IT_OFF,
    ID.ENDURE_PAIN,
    ID.BERSERKER_STANCE,
    ID.BANNER_OF_TACTICS,
    ID.FEAR_ME,
    ID.BALANCED_STANCE,
    ID.BANNER_OF_DEFENSE,
    ID.ON_MY_MARK,
    ID.IMMINENT_THREAT,
    ID.SIGHT_BEYOND_SIGHT,
    ID.FEATHERFOOT_GRACE,
    ID.ELECTRIC_FENCE,
  ];
  assert.equal(
    excludedSkillIds.every(
      (skillId) => warriorCatalog.skillsById.get(skillId).simulatorExcluded,
    ),
    true,
  );
});

test("Warrior builds migrate and validate against the canonical catalog", () => {
  const defaults = createWarriorBuildDefaults();
  assert.deepEqual(validateWarriorBuild(defaults), { valid: true, errors: [] });

  const migrated = migrateWarriorBuild({
    ...defaults,
    initialResource: 500,
  });
  assert.equal(migrated.initialResource, 100);
  assert.deepEqual(validateWarriorBuild(migrated), {
    valid: true,
    errors: [],
  });
  const chargedRelease = migrateWarriorBuild({
    rotation: [{ name: "Dragon Slash—Force", releaseAtCharges: 3 }],
  });
  assert.equal(chargedRelease.rotation[0].releaseAtCharges, 3);
  assert.equal(validateWarriorBuild(chargedRelease).valid, true);
  assert.match(
    validateWarriorBuild({
      ...chargedRelease,
      rotation: [
        {
          ...chargedRelease.rotation[0],
          releaseAtCharges: 0,
        },
      ],
    }).errors.join(" "),
    /releaseAtCharges must be a positive whole number/,
  );
  assert.throws(
    () => migrateWarriorBuild({ profession: "necromancer" }),
    /Cannot load necromancer build as Warrior/,
  );
});

test("Warrior core and elite profession resources remain isolated", () => {
  assertProfessionFamilyConformance({
    family: warriorProfession,
    core: warriorCoreModule,
    specializations: {
      Berserker: berserkerModule,
      Spellbreaker: spellbreakerModule,
      Bladesworn: bladeswornModule,
      Paragon: paragonModule,
    },
  });

  assert.equal(createWarriorCoreState({ initialResource: 30 }).adrenaline, 30);
  assert.equal(
    createWarriorCoreState({
      specialization: "Spellbreaker",
      initialResource: 30,
    }).adrenaline,
    20,
  );
  assert.equal(
    createWarriorCoreState({
      specialization: "Paragon",
      initialResource: 30,
    }).adrenaline,
    10,
  );
  const bladeswornCore = createWarriorCoreState({
    specialization: "Bladesworn",
    initialResource: 100,
  });
  assert.equal(bladeswornCore.adrenaline, 0);
  assert.equal(bladeswornCore.maximumAdrenaline, 0);
});

test("Warrior F keys follow the selected primary weapons", () => {
  const groups = (specialization, weapons, alternateWeapons) => {
    const context = {
      specialization,
      config: { specialization },
      build: {
        ...createWarriorBuildDefaults(),
        weapons,
        alternateWeapons,
      },
    };
    const paletteGroups = warriorProfession.ui.paletteGroups(context);
    const skillBarGroups = warriorProfession.ui.skillBarGroups(context);
    return {
      palette: paletteGroups[0].skillIds,
      paletteGroups,
      skillBar: skillBarGroups[0].skillIds,
      skillBarGroups,
    };
  };

  const core = groups("Core", ["Axe", "Axe"], ["Greatsword", ""]);
  assert.deepEqual(core.palette, [ID.EVISCERATE, ID.ARCING_SLICE]);
  assert.deepEqual(core.skillBar, core.palette);

  const berserker = groups("Berserker", ["Axe", "Axe"], ["Staff", ""]);
  assert.deepEqual(berserker.palette, [
    ID.DECAPITATE,
    ID.RAMPART_SPLITTER,
    ID.BERSERK,
  ]);
  assert.deepEqual(berserker.skillBar, berserker.palette);

  const spellbreaker = groups(
    "Spellbreaker",
    ["Dagger", "Axe"],
    ["Hammer", ""],
  );
  assert.deepEqual(spellbreaker.palette, [
    ID.BREACHING_STRIKE,
    ID.EARTHSHAKER,
    ID.FULL_COUNTER,
  ]);
  assert.deepEqual(spellbreaker.skillBar, spellbreaker.palette);

  const paragon = groups("Paragon", ["Staff", ""], ["Spear", ""]);
  assert.deepEqual(paragon.palette, [
    ID.PATH_TO_VICTORY,
    ID.HARRIERS_TOSS,
    ID.CHANT_OF_ACTION,
    ID.CHANT_OF_RECUPERATION,
    ID.CHANT_OF_FREEDOM,
  ]);
  assert.deepEqual(paragon.skillBar, paragon.palette);

  const bladesworn = groups("Bladesworn", ["Axe", "Axe"], ["Greatsword", ""]);
  assert.deepEqual(bladesworn.palette, [
    ID.UNSHEATHE_GUNSABER,
    ID.SHEATHE_GUNSABER,
    ID.DRAGON_TRIGGER,
  ]);
  assert.deepEqual(bladesworn.skillBar, bladesworn.palette);
  const dragonSlashSkills = [
    ID.DRAGON_SLASH_FORCE,
    ID.DRAGON_SLASH_BOOST,
    ID.DRAGON_SLASH_REACH,
  ];
  assert.deepEqual(
    bladesworn.paletteGroups.find((group) => group.id === "dragon-slash")
      .skillIds,
    dragonSlashSkills,
  );
  assert.deepEqual(
    bladesworn.skillBarGroups.find(
      (group) => group.id === "warrior-dragon-slash",
    ).skillIds,
    dragonSlashSkills,
  );

  const duplicate = groups("Core", ["Sword", "Sword"], ["Sword", ""]);
  assert.deepEqual(duplicate.palette, [ID.BLOODTHIRSTER]);
});

test("Warrior rotation F keys follow the active weapon set", () => {
  const build = {
    ...createWarriorBuildDefaults(),
    weapons: ["Axe", "Axe"],
    alternateWeapons: ["Greatsword", ""],
  };
  const availability = (activeWeaponSet, skillId) =>
    warriorProfession.ui.paletteSkillAvailability(
      {
        specialization: "Core",
        build,
        activeWeaponSet,
      },
      warriorCatalog.skillsById.get(skillId),
    );

  assert.deepEqual(availability(1, ID.EVISCERATE), {
    available: true,
    message: "",
  });
  assert.deepEqual(availability(1, ID.ARCING_SLICE), {
    available: false,
    message: "Switch to weapon set 2",
  });
  assert.deepEqual(availability(2, ID.EVISCERATE), {
    available: false,
    message: "Switch to weapon set 1",
  });
  assert.deepEqual(availability(2, ID.ARCING_SLICE), {
    available: true,
    message: "",
  });
});

test("Bladesworn palette availability follows gunsaber and Dragon Trigger state", () => {
  const availability = (professionState, skillId) =>
    warriorProfession.ui.paletteSkillAvailability(
      {
        specialization: "Bladesworn",
        professionState,
      },
      warriorCatalog.skillsById.get(skillId),
    );

  assert.deepEqual(availability({ gunsaberActive: false }, ID.CHOP), {
    available: true,
    message: "",
  });
  assert.deepEqual(availability({ gunsaberActive: false }, ID.BLOOMING_FIRE), {
    available: false,
    message: "Unsheathe the gunsaber first",
  });
  assert.deepEqual(
    availability({ gunsaberActive: false }, ID.SHEATHE_GUNSABER),
    {
      available: true,
      message: "",
    },
  );
  assert.equal(warriorCatalog.skillsById.get(ID.SHEATHE_GUNSABER).cooldown, 0);
  assert.deepEqual(
    availability({ gunsaberActive: false }, ID.DRAGON_SLASH_FORCE),
    {
      available: false,
      message: "Enter Dragon Trigger first",
    },
  );
  assert.deepEqual(availability({ gunsaberActive: true }, ID.CHOP), {
    available: false,
    message: "Sheathe the gunsaber first",
  });
  assert.deepEqual(availability({ gunsaberActive: true }, ID.BLOOMING_FIRE), {
    available: true,
    message: "",
  });
  assert.deepEqual(
    availability({ gunsaberActive: true }, ID.UNSHEATHE_GUNSABER),
    {
      available: false,
      message: "Gunsaber is already active",
    },
  );

  const charging = simulate("Bladesworn", ["Dragon Trigger"], {
    initialResource: 100,
  });
  assert.equal(charging.endState.profession.dragonTriggerActive, true);
  assert.equal(charging.endState.profession.dragonCharges, 0);
  assert.deepEqual(
    availability(charging.endState.profession, ID.DRAGON_SLASH_FORCE),
    { available: true, message: "" },
  );
});

test("Bladesworn gunsaber autos follow the standard autoattack chain display", () => {
  const chain = [ID.SWIFT_CUT, ID.STEEL_DIVIDE, ID.EXPLOSIVE_THRUST];
  assert.deepEqual(
    warriorCatalog.autoattackChains.find(
      (candidate) => candidate[0] === ID.SWIFT_CUT,
    ),
    chain,
  );
  const gunsaberGroup = warriorProfession.ui
    .skillBarGroups({
      specialization: "Bladesworn",
      build: createWarriorBuildDefaults(),
    })
    .find((group) => group.id === "warrior-gunsaber");
  assert.deepEqual(
    skillBarInspectionStacks(
      gunsaberGroup.skillIds.map((skillId) =>
        warriorCatalog.skillsById.get(skillId),
      ),
    ).map(({ root, children }) => [root.id, children.map((skill) => skill.id)]),
    [
      [ID.SWIFT_CUT, [ID.STEEL_DIVIDE, ID.EXPLOSIVE_THRUST]],
      [ID.BLOOMING_FIRE, []],
      [ID.ARTILLERY_SLASH, []],
      [ID.CYCLONE_TRIGGER, []],
      [ID.BREAK_STEP, []],
    ],
  );

  const displayedSteps = (rotation) => {
    const result = simulate("Bladesworn", ["Unsheathe Gunsaber", ...rotation], {
      initialResource: 100,
    });
    return chain.map((skillId) =>
      autoattackChainSkillAvailable(
        warriorCatalog.skillsById.get(skillId),
        result.endState.profession.autoattackChains,
      ),
    );
  };

  assert.deepEqual(displayedSteps([]), [true, false, false]);
  assert.deepEqual(displayedSteps(["Swift Cut"]), [false, true, false]);
  assert.deepEqual(displayedSteps(["Swift Cut", "Steel Divide"]), [
    false,
    false,
    true,
  ]);
  assert.deepEqual(
    displayedSteps(["Swift Cut", "Steel Divide", "Explosive Thrust"]),
    [true, false, false],
  );
  assert.deepEqual(displayedSteps(["Swift Cut", "Blooming Fire"]), [
    true,
    false,
    false,
  ]);

  const skippedFirstStep = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", "Steel Divide"],
    { initialResource: 100 },
  );
  assert.match(skippedFirstStep.warnings[0], /Cast Swift Cut first/);

  const skippedSecondStep = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", "Swift Cut", "Explosive Thrust"],
    { initialResource: 100 },
  );
  assert.match(skippedSecondStep.warnings[0], /Cast Steel Divide first/);

  const resetChain = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", "Swift Cut", "Blooming Fire", "Steel Divide"],
    { initialResource: 100 },
  );
  assert.match(resetChain.warnings[0], /Cast Swift Cut first/);
});

test("Warrior adrenaline renders one bar for each ten adrenaline", () => {
  const result = simulate("Core", [], { initialResource: 25 });
  const resource = warriorProfession.ui
    .resourceViews({
      specialization: "Core",
      professionState: result.endState.profession,
    })
    .find((view) => view.id === "adrenaline");
  assert.equal(resource.displayMode, "bar");
  assert.equal(resource.barSegments, 3);

  for (const [specialization, maximum, barSegments] of [
    ["Spellbreaker", 20, 2],
    ["Paragon", 10, 1],
  ]) {
    const specializationResource = warriorProfession.ui
      .resourceViews({
        specialization,
        professionState: { maximumAdrenaline: maximum },
      })
      .find((view) => view.id === "adrenaline");
    assert.equal(specializationResource.barSegments, barSegments);
  }

  const resourceHtml = activeResourceGroup({
    profession: warriorProfession,
    adapter: { eliteSpecialization: () => "Core" },
    build: { initialResource: 25 },
    results: result,
  });
  assert.equal(
    [
      ...resourceHtml.matchAll(
        /class="active-resource-bar warrior-adrenaline"/g,
      ),
    ].length,
    3,
  );
  assert.doesNotMatch(resourceHtml, /active-resource-pip/);
  assert.match(resourceHtml, /width:50%/);
});

test("Paragon motivation renders as a compact emblem counter", () => {
  const result = simulate("Paragon", ["Chant of Action"], {
    initialResource: 10,
  });
  const motivation = warriorProfession.ui
    .resourceViews({
      specialization: "Paragon",
      professionState: result.endState.profession,
    })
    .find((view) => view.id === "motivation");
  assert.equal(motivation.displayMode, "counter");
  assert.equal(motivation.pipStyle, "warrior-motivation");

  const resourceHtml = activeResourceGroup({
    profession: warriorProfession,
    adapter: { eliteSpecialization: () => "Paragon" },
    build: { initialResource: 10 },
    results: result,
  });
  assert.match(
    resourceHtml,
    /class="active-resource-counter warrior-motivation"[^>]*>[\s\S]*?<span>4<\/span>/,
  );
  assert.doesNotMatch(resourceHtml, /<strong>4\/10<\/strong>/);
});

test("Core bursts require and consume adrenaline", () => {
  const blocked = simulate("Core", ["Eviscerate"], { initialResource: 0 });
  assert.match(blocked.warnings[0], /requires 10 adrenaline/);

  const result = simulate("Core", ["Eviscerate"], { initialResource: 30 });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.totalDamage > 0, true);
  assert.equal(result.endState.profession.adrenaline < 30, true);
});

test("Core Warrior weapon swap toggles the active set", () => {
  const result = simulate("Core", ["Swap Weapons"]);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.activeWeaponSet, 2);
  assert.equal(
    result.events.some(
      (event) => event.type === "weapon_set" && event.weaponSet === 2,
    ),
    true,
  );
});

test("Berserker gates primal bursts behind berserk mode", () => {
  const blocked = simulate("Berserker", ["Arc Divider"], {
    initialResource: 30,
  });
  assert.match(blocked.warnings[0], /requires? berserk mode/);

  const result = simulate("Berserker", ["Berserk", "Arc Divider"], {
    initialResource: 30,
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.berserkActive, true);
  assert.equal(result.totalDamage > 0, true);
});

test("Berserker mode applies the supplied cap, duration, buffs, and modifiers", () => {
  const result = simulate("Berserker", ["Berserk", "Arc Divider", "Outrage"], {
    initialResource: 30,
    selectedTraitIds: [TRAIT.SMASH_BRAWLER, TRAIT.BLOODY_ROAR],
    stats: { precision: 0 },
    boons: { fury: false },
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.maximumAdrenaline, 10);
  assert.equal(result.endState.profession.berserkUntil, 25);
  assert.equal(
    result.events.some(
      (event) => event.kind === "quickness" && event.duration === 3,
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) => event.kind === "fury" && event.duration === 8,
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.sourceId === TRAIT.BLOODY_ROAR &&
        event.kind === "resistance" &&
        event.duration === 3.5,
    ),
    true,
  );
  const arc = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillId === ID.ARC_DIVIDER,
  );
  assert.equal(arc.criticalChance, 0.4);

  const attributes = berserkerAttributeRules.modifyAttributes(
    {
      config: { selectedTraitIds: [TRAIT.BLOOD_REACTION] },
      runtime: {
        profession: {
          specialization: {
            kind: "Berserker",
            state: { berserkActive: true },
          },
        },
      },
    },
    { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0 },
  );
  assert.deepEqual(attributes, {
    power: 1300,
    precision: 1000,
    ferocity: 240,
    conditionDamage: 462,
  });

  const bloodReactionOutsideBerserk = berserkerAttributeRules.modifyAttributes(
    {
      config: { selectedTraitIds: [TRAIT.BLOOD_REACTION] },
      runtime: {
        profession: {
          specialization: {
            kind: "Berserker",
            state: { berserkActive: false },
          },
        },
      },
    },
    { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0 },
  );
  assert.deepEqual(bloodReactionOutsideBerserk, {
    power: 1000,
    precision: 1000,
    ferocity: 120,
    conditionDamage: 120,
  });

  const greatFortitude = berserkerAttributeRules.modifyAttributes(
    {
      config: { selectedTraitIds: [TRAIT.GREAT_FORTITUDE] },
      runtime: {
        profession: {
          specialization: {
            kind: "Berserker",
            state: { berserkActive: true },
          },
        },
      },
    },
    {
      power: 1000,
      precision: 0,
      ferocity: 100,
      conditionDamage: 0,
      vitality: 1000,
    },
  );
  assert.deepEqual(greatFortitude, {
    power: 1300,
    precision: 0,
    ferocity: 130,
    conditionDamage: 150,
    vitality: 1030,
  });

  const strikeDamage = (selectedTraitIds) =>
    simulate("Berserker", ["Berserk", "Arc Divider"], {
      initialResource: 30,
      selectedTraitIds,
      stats: { precision: 0 },
      boons: { fury: false },
    }).strikeDamage;
  assert.ok(
    Math.abs(
      strikeDamage([TRAIT.SMASH_BRAWLER, TRAIT.BLOODY_ROAR]) /
        strikeDamage([TRAIT.SMASH_BRAWLER]) -
        1.1,
    ) < 1e-9,
  );
});

test("Berserker rage and primal-burst traits use the supplied behavior", () => {
  const reset = simulate(
    "Berserker",
    ["Berserk", "Arc Divider", "Blood Reckoning", "Arc Divider"],
    {
      initialResource: 30,
      selectedTraitIds: [TRAIT.SMASH_BRAWLER],
    },
  );
  assert.deepEqual(reset.warnings, []);
  assert.equal(
    reset.events.filter(
      (event) => event.type === "damage" && event.skillId === ID.ARC_DIVIDER,
    ).length,
    2,
  );

  const berserkersPowerTiming = simulate(
    "Berserker",
    ["Berserk", "Wild Throw"],
    {
      initialResource: 30,
      selectedTraitIds: [TRAIT.BERSERKERS_POWER],
    },
  );
  const firstWildThrowHit = berserkersPowerTiming.events.find(
    (event) => event.type === "damage" && event.skillId === ID.WILD_THROW,
  );
  const berserkersPower = berserkersPowerTiming.events.find(
    (event) =>
      event.kind === "berserkers-power" && event.skillId === ID.WILD_THROW,
  );
  assert.ok(
    Math.abs(berserkersPower.at - firstWildThrowHit.at - 0.0001) < 1e-9,
  );

  const traits = simulate("Berserker", ["Berserk", "Wild Throw"], {
    initialResource: 30,
    selectedTraitIds: [
      TRAIT.LAST_BLAZE,
      TRAIT.HEAT_THE_SOUL,
      TRAIT.KING_OF_FIRES,
    ],
    stats: { precision: 10000 },
  });
  assert.equal(
    traits.events.some(
      (event) =>
        event.sourceId === TRAIT.LAST_BLAZE &&
        event.condition === "Burning" &&
        event.stacks === 1 &&
        event.duration === 4,
    ),
    true,
  );
  assert.equal(
    traits.events.some(
      (event) =>
        event.sourceId === TRAIT.HEAT_THE_SOUL &&
        event.kind === "quickness" &&
        event.duration === 5 &&
        event.recipients === "party",
    ),
    true,
  );
  assert.equal(
    traits.events.some(
      (event) =>
        event.sourceId === TRAIT.KING_OF_FIRES &&
        event.type === "damage" &&
        event.coefficient === 0.7,
    ),
    true,
  );
});

test("Berserker spear and greatsword packets match the supplied benchmark", () => {
  const arc = warriorCatalog.skillsById.get(ID.ARC_DIVIDER);
  const wildThrow = warriorCatalog.skillsById.get(ID.WILD_THROW);
  const maimingSpear = warriorCatalog.skillsById.get(ID.MAIMING_SPEAR);
  const disruptingThrow = warriorCatalog.skillsById.get(ID.DISRUPTING_THROW);
  const support = warriorCatalog.skillsById.get(ID.SPEARMARSHALS_SUPPORT);
  const bladetrail = warriorCatalog.skillsById.get(ID.BLADETRAIL);
  const hundredBlades = warriorCatalog.skillsById.get(ID.HUNDRED_BLADES);

  const evtcCastTimes = [
    [ID.ARC_DIVIDER, 1040, 680],
    [ID.WILD_THROW, 1920, 1280],
    [ID.BLOOD_RECKONING, 440, 280],
    [ID.HEAD_BUTT, 1200, 800],
    [ID.SPEARMARSHALS_SUPPORT, 800, 520],
    [ID.MAIMING_SPEAR, 720, 480],
    [ID.MIGHTY_THROW, 960, 640],
    [ID.DISRUPTING_THROW, 800, 520],
    [ID.HUNDRED_BLADES, 3680, 2440],
    [ID.BULLS_CHARGE, 960, 640],
    [ID.BLADETRAIL, 840, 560],
    [ID.RUSH, 1520, 1000],
    [ID.GREATSWORD_SWING, 600, 400],
  ];
  for (const [skillId, castTimeMs, quicknessCastTimeMs] of evtcCastTimes) {
    const skill = warriorCatalog.skillsById.get(skillId);
    assert.equal(skill.castTimeMs, castTimeMs);
    assert.equal(skill.quicknessCastTimeMs, quicknessCastTimeMs);
    assert.equal(skill.castTimeMs % 40, 0);
    assert.equal(skill.quicknessCastTimeMs % 40, 0);
  }

  assert.equal(arc.cooldown, 5);
  assert.equal(arc.skillWeapon, "Greatsword");
  assert.equal(arc.effects[0].coefficient, 3.5);
  assert.equal(wildThrow.cooldown, 5);
  assert.equal(wildThrow.skillWeapon, "Spear");
  assert.deepEqual(
    wildThrow.effects[0].ticks.map((tick) => tick.coefficient),
    Array(7).fill(0.75),
  );
  assert.deepEqual(
    wildThrow.effects[0].ticks.map(
      (tick) => tick.metadata?.evtcSkillId || ID.WILD_THROW,
    ),
    [
      ID.WILD_THROW,
      ID.WILD_THROW_ALTERNATE,
      ID.WILD_THROW,
      ID.WILD_THROW_ALTERNATE,
      ID.WILD_THROW,
      ID.WILD_THROW_ALTERNATE,
      ID.WILD_THROW,
    ],
  );
  assert.equal(maimingSpear.cooldown, 5);
  assert.deepEqual(
    maimingSpear.effects
      .filter((effect) => effect.type === "strike")
      .map((effect) => effect.coefficient),
    [1.1, 0.9],
  );
  assert.equal(
    disruptingThrow.effects.some(
      (effect) =>
        effect.type === "condition" &&
        effect.condition === "Immobilized" &&
        effect.duration === 2,
    ),
    true,
  );
  assert.deepEqual(
    support.effects[0].ticks.map((tick) => [tick.atMs, tick.coefficient]),
    [
      [967, 0.5],
      [1167, 0.5],
      [1367, 0.5],
      [1567, 0.5],
      [1767, 0.5],
      [1967, 0.5],
      [2167, 0.5],
    ],
  );
  assert.equal(bladetrail.effects[0].ticks.length, 2);
  assert.equal(hundredBlades.effects[0].ticks.length, 9);

  const packetOffsets = (skillName, rotation = [skillName]) => {
    const result = simulate(
      "Berserker",
      [...rotation, { type: "wait", durationMs: 2500 }],
      {
        boons: { quickness: true },
        initialResource: 30,
        primaryWeapon: "Spear",
      },
    );
    const action = result.events.find(
      (event) => event.type === "action" && event.skillName === skillName,
    );
    return result.events
      .filter(
        (event) =>
          event.type === "damage" &&
          Number(event.coefficient) > 0 &&
          event.activationId === action.activationId,
      )
      .map((event) => Math.round((event.at - action.at) * 1000));
  };
  assert.deepEqual(
    packetOffsets("Wild Throw", ["Berserk", "Wild Throw"]),
    [233, 433, 600, 800, 967, 1167, 1280],
  );
  assert.deepEqual(packetOffsets("Maiming Spear"), [1000, 1517]);
  assert.deepEqual(packetOffsets("Mighty Throw"), [480]);
  assert.deepEqual(packetOffsets("Disrupting Throw"), [400]);
  assert.deepEqual(
    packetOffsets("Spearmarshal's Support"),
    [967, 1167, 1367, 1567, 1767, 1967, 2167],
  );

  const singleTarget = simulate("Berserker", ["Mighty Throw"]);
  assert.equal(
    singleTarget.events.find(
      (event) => event.name === "Mighty Throw — Shard Damage",
    ).coefficient,
    0,
  );
  const multipleTargets = simulate("Berserker", ["Mighty Throw"], {
    target: { count: 2 },
  });
  assert.equal(
    multipleTargets.events.find(
      (event) => event.name === "Mighty Throw — Shard Damage",
    ).coefficient,
    0.9,
  );
});

test("Spellbreaker uses its reduced adrenaline cap for Full Counter", () => {
  const result = simulate("Spellbreaker", ["Full Counter"], {
    initialResource: 30,
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.maximumAdrenaline, 20);
  assert.equal(result.endState.profession.adrenaline < 20, true);
  assert.equal(result.totalDamage > 0, true);
});

test("Spellbreaker Winds and Kick use the supplied PvE mechanics", () => {
  const winds = warriorCatalog.skillsById.get(ID.WINDS_OF_DISENCHANTMENT);
  const kick = warriorCatalog.skillsById.get(ID.KICK);
  const windsStrike = winds.effects.find((effect) => effect.type === "strike");
  const kickStrike = kick.effects.find((effect) => effect.type === "strike");
  const kickControl = kick.effects.find((effect) => effect.type === "control");

  assert.equal(windsStrike.coefficient, 2.25);
  assert.equal(windsStrike.hits, 5);
  assert.equal(windsStrike.intervalMs, 1000);
  assert.equal(windsStrike.coefficient / windsStrike.hits, 0.45);
  assert.equal(kick.ammo, 3);
  assert.equal(kick.recharge, 3);
  assert.equal(kick.ammoRecharge, 20);
  assert.equal(kickStrike.coefficient, 1);
  assert.equal(kickControl.metadata.controlKind, "knockback");

  const result = simulate("Spellbreaker", ["Winds of Disenchantment"]);
  const pulses = result.events.filter(
    (event) =>
      event.type === "damage" && event.skillId === ID.WINDS_OF_DISENCHANTMENT,
  );
  assert.deepEqual(
    pulses.map(({ coefficient }) => coefficient),
    [0.45, 0.45, 0.45, 0.45, 0.45],
  );
  assert.deepEqual(
    pulses.slice(1).map((pulse, index) => pulse.at - pulses[index].at),
    [1, 1, 1, 1],
  );
  assert.equal(
    Math.round(
      (pulses[0].at -
        result.steps.find((step) => step.skill === "Winds of Disenchantment")
          .end /
          1000) *
        1000,
    ),
    800,
  );
});

test("Warrior dagger attacks and bursts use the supplied PvE mechanics", () => {
  const keenStrike = warriorCatalog.skillsById.get(ID.KEEN_STRIKE);
  const focusedSlash = warriorCatalog.skillsById.get(ID.FOCUSED_SLASH);
  const preciseCut = warriorCatalog.skillsById.get(ID.PRECISE_CUT);
  const wastrelsRuin = warriorCatalog.skillsById.get(ID.WASTRELS_RUIN);
  const hushblade = warriorCatalog.skillsById.get(ID.HUSHBLADE);
  const breachingStrike = warriorCatalog.skillsById.get(ID.BREACHING_STRIKE);
  const slicingMaelstrom = warriorCatalog.skillsById.get(ID.SLICING_MAELSTROM);
  const strikeCoefficient = (skill) =>
    skill.effects.find((effect) => effect.type === "strike")?.coefficient;
  const damage = (result, name) =>
    result.breakdown.find((entry) => entry.name === name)?.damage || 0;

  assert.deepEqual(
    [keenStrike, focusedSlash, preciseCut].map((skill) => [
      strikeCoefficient(skill),
      skill.weapon,
    ]),
    [
      [1.05, "Dagger"],
      [0.65, "Dagger"],
      [0.6, "Dagger"],
    ],
  );

  assert.deepEqual(
    [wastrelsRuin.cooldown, strikeCoefficient(wastrelsRuin)],
    [12, 1.5],
  );
  assert.deepEqual(
    [
      hushblade.ammo,
      hushblade.recharge,
      hushblade.ammoRecharge,
      strikeCoefficient(hushblade),
      hushblade.effects.find((effect) => effect.type === "control")?.metadata
        .controlKind,
    ],
    [2, 1, 12, 1.5, "daze"],
  );
  assert.deepEqual(
    [
      breachingStrike.cooldown,
      strikeCoefficient(breachingStrike),
      breachingStrike.skillWeapon,
    ],
    [8, 2.5, "Dagger"],
  );
  assert.deepEqual(
    [slicingMaelstrom.cooldown, strikeCoefficient(slicingMaelstrom)],
    [5, 2.5],
  );

  const normalWastrel = simulate("Spellbreaker", ["Wastrel's Ruin"], {
    primaryWeapon: "Sword",
    secondaryWeapon: "Dagger",
    target: { defiant: false },
  });
  const defiantWastrel = simulate("Spellbreaker", ["Wastrel's Ruin"], {
    primaryWeapon: "Sword",
    secondaryWeapon: "Dagger",
    target: { defiant: true },
  });
  assert.ok(
    Math.abs(
      damage(defiantWastrel, "Wastrel's Ruin") /
        damage(normalWastrel, "Wastrel's Ruin") -
        2,
    ) < 1e-9,
  );

  const breachingDamage = (boonless) =>
    simulate("Spellbreaker", ["Breaching Strike"], {
      initialResource: 10,
      primaryWeapon: "Dagger",
      secondaryWeapon: "Mace",
      target: { boonless },
    }).strikeDamage;
  assert.ok(
    Math.abs(breachingDamage(true) / breachingDamage(false) - 1.5) < 1e-9,
  );

  const fixedBreaching = simulate("Spellbreaker", ["Breaching Strike"], {
    initialResource: 10,
    primaryWeapon: "Dagger",
    secondaryWeapon: "Mace",
    boons: { quickness: true },
    selectedTraitIds: [TRAIT.DUAL_WIELDING],
  });
  assert.equal(
    fixedBreaching.steps[0].end - fixedBreaching.steps[0].start,
    842,
  );
  const resolvedBreaching = fixedBreaching.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillId === ID.BREACHING_STRIKE,
  );
  assert.equal(resolvedBreaching.weaponStrengthProfileId, "weapon.dagger");
  assert.equal(resolvedBreaching.resolvedWeaponStrength, 1000);

  for (const id of [
    ID.BLOODTHIRSTER,
    ID.BLOODTHIRSTER_ID_80252,
    ID.BLOODTHIRSTER_ID_80263,
  ]) {
    assert.equal(warriorCatalog.skillsById.get(id).skillWeapon, "Sword");
  }
  const fixedBloodthirster = simulate("Spellbreaker", ["Bloodthirster"], {
    initialResource: 10,
    primaryWeapon: "Sword",
    secondaryWeapon: "Axe",
  });
  const resolvedBloodthirster = fixedBloodthirster.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillId === ID.BLOODTHIRSTER,
  );
  assert.equal(resolvedBloodthirster.weaponStrengthProfileId, "weapon.sword");
  assert.equal(resolvedBloodthirster.resolvedWeaponStrength, 1000);

  const slicingDamage = (boonless) =>
    simulate("Berserker", ["Berserk", "Slicing Maelstrom"], {
      initialResource: 30,
      primaryWeapon: "Dagger",
      secondaryWeapon: "Mace",
      boons: { quickness: true },
      selectedTraitIds: [TRAIT.DUAL_WIELDING],
      target: { boonless },
    });
  const normalSlicing = slicingDamage(false);
  const boonlessSlicing = slicingDamage(true);
  const slicingStep = boonlessSlicing.steps.find(
    (step) => step.skill === "Slicing Maelstrom",
  );
  assert.equal(slicingStep.end - slicingStep.start, 400);
  assert.ok(
    Math.abs(
      damage(boonlessSlicing, "Slicing Maelstrom") /
        damage(normalSlicing, "Slicing Maelstrom") -
        1.5,
    ) < 1e-9,
  );
});

test("Spellbreaker control grants independent Insight stacks and No Escape", () => {
  const result = simulate("Spellbreaker", ["Disrupting Stab"], {
    primaryWeapon: "Dagger",
    secondaryWeapon: "Mace",
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT, TRAIT.NO_ESCAPE],
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.profession.attackerInsightExpiries.length, 1);
  assert.equal(result.endState.profession.attackerInsightExpiries.length, 1);
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "condition" &&
        event.condition === "Immobilized" &&
        event.duration === 1 &&
        event.sourceId === TRAIT.NO_ESCAPE,
    ),
    true,
  );

  const attributes = spellbreakerAttributeRules.modifyAttributes(
    {
      time: 10,
      runtime: {
        profession: {
          specialization: {
            kind: "Spellbreaker",
            state: {
              attackerInsightExpiries: [11, 12, 13, 14, 15],
            },
          },
        },
      },
    },
    { power: 1000, precision: 1000, ferocity: 0 },
  );
  assert.deepEqual(attributes, {
    power: 1250,
    precision: 1250,
    ferocity: 250,
  });

  const kick = simulate("Spellbreaker", ["Kick"], {
    selectedTraitIds: [TRAIT.ATTACKERS_INSIGHT],
    target: { defiant: true },
  });
  assert.equal(kick.profession.attackerInsightExpiries.length, 2);
  assert.equal(kick.endState.profession.attackerInsightExpiries.length, 2);
});

test("Warrior benchmark packets use their measured Quickness offsets", () => {
  const packetOffsets = (skillName, config = {}) => {
    const rotation =
      skillName === "Focused Slash"
        ? ["Precise Cut", skillName]
        : skillName === "Keen Strike"
          ? ["Precise Cut", "Focused Slash", skillName]
          : skillName === "Hamstring"
            ? ["Sever Artery", "Gash", skillName]
            : [skillName];
    const result = simulate("Spellbreaker", rotation, {
      boons: { quickness: true },
      selectedTraitIds: [TRAIT.DUAL_WIELDING],
      ...config,
    });
    const action = result.events.find(
      (event) => event.type === "action" && event.skillName === skillName,
    );
    return result.events
      .filter(
        (event) =>
          event.type === "damage" && event.activationId === action.activationId,
      )
      .map((event) => Math.round((event.at - action.at) * 1000));
  };

  const daggerMace = {
    primaryWeapon: "Dagger",
    secondaryWeapon: "Mace",
    initialResource: 10,
  };
  const swordAxe = {
    primaryWeapon: "Sword",
    secondaryWeapon: "Axe",
    initialResource: 10,
  };
  assert.deepEqual(packetOffsets("Crushing Blow", daggerMace), [320]);
  assert.deepEqual(packetOffsets("Tremor", daggerMace), [320, 360]);
  assert.deepEqual(packetOffsets("Disrupting Stab", daggerMace), [120]);
  assert.deepEqual(packetOffsets("Precise Cut", daggerMace), [200]);
  assert.deepEqual(packetOffsets("Focused Slash", daggerMace), [200]);
  assert.deepEqual(packetOffsets("Keen Strike", daggerMace), [200]);
  assert.deepEqual(packetOffsets("Breaching Strike", daggerMace), [758]);
  assert.deepEqual(packetOffsets("Kick", daggerMace), [441]);
  assert.deepEqual(packetOffsets("Bloodthirster", swordAxe), [320]);
  assert.deepEqual(packetOffsets("Dual Strike", swordAxe), [280, 280]);
  assert.deepEqual(packetOffsets("Rend", swordAxe), [320, 640]);
  assert.deepEqual(packetOffsets("Hamstring", swordAxe), [160]);
  assert.deepEqual(
    packetOffsets("Whirling Axe", swordAxe),
    [
      240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1440, 1560, 1680,
      1800, 1920,
    ],
  );
});

test("Dagger autos land at 200 ms and use a 15% critical-damage factor", () => {
  const damage = (skillName, precision) => {
    const rotation =
      skillName === "Focused Slash"
        ? ["Precise Cut", skillName]
        : skillName === "Keen Strike"
          ? ["Precise Cut", "Focused Slash", skillName]
          : [skillName];
    const result = simulate("Spellbreaker", rotation, {
      primaryWeapon: "Dagger",
      secondaryWeapon: "Mace",
      stats: { precision, ferocity: 1000 },
      boons: { fury: false },
    });
    return (
      result.breakdown.find((entry) => entry.name === skillName)
        ?.strikeDamage || 0
    );
  };
  const normalized = (skillName, coefficient, precision) =>
    damage(skillName, precision) / coefficient;

  assert.ok(
    Math.abs(
      normalized("Precise Cut", 0.6, 0) / normalized("Keen Strike", 1.05, 0) -
        1,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      normalized("Precise Cut", 0.6, 10000) /
        normalized("Keen Strike", 1.05, 10000) -
        1.15,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      normalized("Focused Slash", 0.65, 10000) /
        normalized("Keen Strike", 1.05, 10000) -
        1.15,
    ) < 1e-9,
  );

  const interrupted = (interruptMs) =>
    simulate("Spellbreaker", [{ name: "Precise Cut", interruptMs }], {
      primaryWeapon: "Dagger",
      secondaryWeapon: "Mace",
      boons: { quickness: true },
      selectedTraitIds: [TRAIT.DUAL_WIELDING],
    });
  assert.equal(
    interrupted(159).events.filter(
      (event) => event.type === "damage" && event.skillId === ID.PRECISE_CUT,
    ).length,
    0,
  );
  assert.equal(
    interrupted(233).events.filter(
      (event) => event.type === "damage" && event.skillId === ID.PRECISE_CUT,
    ).length,
    1,
  );
});

test("Peak Performance buffs Kick and Leg Specialist requires impairment", () => {
  const strikeDamage = (selectedTraitIds, target = {}) =>
    simulate("Spellbreaker", ["Kick"], {
      selectedTraitIds,
      stats: { precision: 0 },
      target,
    }).strikeDamage;
  const baseKick = strikeDamage([]);
  const peakKick = strikeDamage([TRAIT.PEAK_PERFORMANCE]);
  assert.ok(Math.abs(peakKick / baseKick - 1.15) < 1e-9);

  const bullsChargeDamage = (selectedTraitIds) =>
    simulate("Spellbreaker", ["Bull's Charge"], {
      selectedTraitIds,
      stats: { precision: 0 },
    }).strikeDamage;
  assert.ok(
    Math.abs(
      bullsChargeDamage([TRAIT.PEAK_PERFORMANCE]) / bullsChargeDamage([]) -
        1.15,
    ) < 1e-9,
  );

  const mending = warriorCatalog.skillsById.get(ID.MENDING);
  assert.equal(mending.cooldown, 12);
  assert.equal(mending.quicknessCastTimeMs, 920);
  assert.equal(mending.categories.includes("Physical"), true);
  const mendingProc = simulate("Core", ["Mending"], {
    selectedTraitIds: [TRAIT.PEAK_PERFORMANCE],
    boons: { quickness: true },
  });
  assert.equal(
    mendingProc.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "peak-performance" &&
        event.skillId === ID.MENDING,
    ),
    true,
  );

  const legDamage = (conditions) =>
    simulate("Spellbreaker", ["Precise Cut", "Focused Slash", "Keen Strike"], {
      primaryWeapon: "Dagger",
      secondaryWeapon: "Mace",
      selectedTraitIds: [TRAIT.LEG_SPECIALIST],
      target: { conditions },
    }).breakdown.find((entry) => entry.name === "Keen Strike")?.strikeDamage ||
    0;
  assert.ok(
    Math.abs(legDamage({ Chilled: true }) / legDamage({}) - 1.05) < 1e-9,
  );
});

test("Warrior core damage traits use their correct modifier buckets", () => {
  const configuredKickDamage = (selectedTraitIds, overrides = {}) =>
    simulate("Core", ["Kick"], {
      selectedTraitIds,
      stats: { precision: 0 },
      boons: {
        swiftness: true,
        protection: true,
        regeneration: true,
      },
      ...overrides,
    }).strikeDamage;

  const baseline = configuredKickDamage([]);
  const empoweredSprintPeak = configuredKickDamage([
    TRAIT.EMPOWERED,
    TRAIT.WARRIORS_SPRINT,
    TRAIT.PEAK_PERFORMANCE,
  ]);
  assert.ok(Math.abs(empoweredSprintPeak / baseline - 1.25 * 1.03) < 1e-9);

  const boonedTargetBaseline = configuredKickDamage([], {
    target: { boonless: false, boonCount: 4 },
  });
  const destructionPeak = configuredKickDamage(
    [TRAIT.DESTRUCTION_OF_THE_EMPOWERED, TRAIT.PEAK_PERFORMANCE],
    { target: { boonless: false, boonCount: 4 } },
  );
  assert.ok(
    Math.abs(destructionPeak / boonedTargetBaseline - 1.15 * 1.12) < 1e-9,
  );
});

test("Defense traits apply Merciless Hammer and Stalwart Strength", () => {
  const maceDamage = (selectedTraitIds) =>
    simulate("Core", ["Mace Smash"], {
      primaryWeapon: "Mace",
      selectedTraitIds,
      stats: { precision: 0 },
      target: { defiant: true },
    }).strikeDamage;
  assert.ok(
    Math.abs(maceDamage([TRAIT.MERCILESS_HAMMER]) / maceDamage([]) - 1.25) <
      1e-9,
  );

  const baselineControl = simulate("Core", ["Kick"], { initialResource: 0 });
  const traitControl = simulate("Core", ["Kick"], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.MERCILESS_HAMMER, TRAIT.STALWART_STRENGTH],
  });
  assert.equal(
    traitControl.endState.profession.adrenaline -
      baselineControl.endState.profession.adrenaline,
    7,
  );
  const stability = traitControl.events.find(
    (event) =>
      event.type === "buff" && event.sourceId === TRAIT.STALWART_STRENGTH,
  );
  assert.equal(stability?.kind, "stability");
  assert.equal(stability?.duration, 5);

  const controlledStrikeDamage = (selectedTraitIds) =>
    simulate("Core", ["Kick", "Mace Smash"], {
      primaryWeapon: "Mace",
      selectedTraitIds,
      stats: { precision: 0 },
    }).breakdown.find((entry) => entry.name === "Mace Smash")?.strikeDamage ||
    0;
  assert.ok(
    Math.abs(
      controlledStrikeDamage([TRAIT.STALWART_STRENGTH]) /
        controlledStrikeDamage([]) -
        1.1,
    ) < 1e-9,
  );
});

test("Bloodlust handles deterministic progress and stochastic proc rolls", () => {
  const rotation = [
    "__combat_start",
    "Precise Cut",
    "Focused Slash",
    "Keen Strike",
    "Precise Cut",
    "Focused Slash",
    "Keen Strike",
    "Precise Cut",
    "Focused Slash",
    "Keen Strike",
    "Precise Cut",
    "Focused Slash",
    "Keen Strike",
  ];
  const config = {
    primaryWeapon: "Dagger",
    secondaryWeapon: "Mace",
    selectedTraitIds: [TRAIT.BLOODLUST],
    stats: { precision: 10000 },
  };
  const bleedingStacks = (result) =>
    result.events
      .filter(
        (event) =>
          event.type === "condition" && event.sourceId === TRAIT.BLOODLUST,
      )
      .reduce((total, event) => total + Number(event.stacks || 0), 0);

  assert.equal(
    bleedingStacks(
      simulate("Spellbreaker", rotation, {
        ...config,
        randomness: { mode: "deterministic", seed: 7 },
      }),
    ),
    3,
  );
  assert.equal(
    bleedingStacks(
      simulate("Spellbreaker", rotation.slice(0, 8), {
        ...config,
        stats: { precision: 1945 },
        randomness: { mode: "deterministic", seed: 7 },
      }),
    ),
    1,
  );

  const seed = 1;
  const random = createSimulationRandom({ mode: "stochastic", seed });
  const expectedStochasticStacks = Array.from({ length: 12 }, () =>
    random.roll(0.33, "warrior.bloodlust"),
  ).filter(Boolean).length;
  const stochastic = simulate("Spellbreaker", rotation, {
    ...config,
    randomness: { mode: "stochastic", seed },
  });
  assert.equal(bleedingStacks(stochastic), expectedStochasticStacks);
  assert.deepEqual(
    stochastic.events
      .filter(
        (event) => event.type === "damage" && event.actorType === "player",
      )
      .map((event) => event.didCrit),
    Array(12).fill(true),
  );
});

test("precombat Kick samples stochastic crits without advancing deterministic sigils", () => {
  const result = simulate("Spellbreaker", ["Kick", "__combat_start"], {
    selectedTraitIds: [TRAIT.BLOODLUST],
    stats: { precision: 10000 },
    randomness: { mode: "stochastic", seed: 7 },
  });
  const kick = result.events.find(
    (event) => event.type === "damage" && event.skillId === ID.KICK,
  );

  assert.equal(kick.didCrit, true);

  const deterministic = simulate(
    "Spellbreaker",
    ["Kick", "__combat_start", "Precise Cut"],
    {
      primaryWeapon: "Dagger",
      secondaryWeapon: "Mace",
      stats: { precision: 1945 },
      randomness: { mode: "deterministic", seed: 7 },
      sigilSets: [
        { names: ["Air"], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  );
  assert.equal(
    deterministic.events.some(
      (event) => event.source === "Sigil" && event.skillName === "Sigil of Air",
    ),
    false,
  );
});

test("Spellbreaker offensive traits use multiplicative damage modifiers", () => {
  const damage = (result, name) =>
    result.breakdown.find((entry) => entry.name === name)?.damage || 0;
  const traitStrike = (
    selectedTraitIds,
    targetBoonless,
    primaryWeapon,
    secondaryWeapon = "Mace",
  ) =>
    simulate("Spellbreaker", ["Throw Bolas"], {
      selectedTraitIds,
      primaryWeapon,
      secondaryWeapon,
      stats: { precision: 4000 },
      target: { boonless: targetBoonless },
    }).strikeDamage;

  const boonlessBase = traitStrike([], true, "Dagger");
  const boonlessPure = traitStrike([TRAIT.PURE_STRIKE], true, "Dagger");
  const boonedBase = traitStrike([], false, "Dagger");
  const boonedPure = traitStrike([TRAIT.PURE_STRIKE], false, "Dagger");
  const daggerStyle = traitStrike([TRAIT.SUN_AND_MOON_STYLE], true, "Dagger");
  const swordStyle = traitStrike([TRAIT.SUN_AND_MOON_STYLE], true, "Sword");
  const offhandDaggerStyle = traitStrike(
    [TRAIT.SUN_AND_MOON_STYLE],
    true,
    "Sword",
    "Dagger",
  );
  assert.ok(Math.abs(boonlessPure / boonlessBase - 1.1) < 1e-9);
  assert.ok(Math.abs(boonedPure / boonedBase - 1.05) < 1e-9);
  assert.ok(Math.abs(daggerStyle / boonlessBase - 1.1) < 1e-9);
  assert.ok(Math.abs(swordStyle / boonlessBase - 1) < 1e-9);
  assert.ok(Math.abs(offhandDaggerStyle / boonlessBase - 1) < 1e-9);

  const base = simulate("Spellbreaker", ["Breaching Strike", "Kick"], {
    initialResource: 10,
    primaryWeapon: "Dagger",
    secondaryWeapon: "Mace",
  });
  const tethered = simulate("Spellbreaker", ["Breaching Strike", "Kick"], {
    initialResource: 10,
    primaryWeapon: "Dagger",
    secondaryWeapon: "Mace",
    selectedTraitIds: [TRAIT.MAGEBANE_TETHER],
  });
  assert.ok(
    Math.abs(
      damage(tethered, "Breaching Strike") / damage(base, "Breaching Strike") -
        1,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(damage(tethered, "Kick") / damage(base, "Kick") - 1.15) < 1e-9,
  );
  assert.equal(
    tethered.procSteps.filter((step) => step.skill === "Magebane Tether")
      .length,
    1,
  );

  const internalCooldown = simulate(
    "Spellbreaker",
    [
      "Breaching Strike",
      { type: "wait", durationMs: 7500 },
      "Breaching Strike",
    ],
    {
      initialResource: 20,
      primaryWeapon: "Dagger",
      secondaryWeapon: "Mace",
      selectedTraitIds: [TRAIT.MAGEBANE_TETHER],
    },
  );
  assert.equal(
    internalCooldown.procSteps.filter(
      (step) => step.skill === "Magebane Tether",
    ).length,
    1,
  );
  assert.ok(
    internalCooldown.profession.magebaneTetherUntil < internalCooldown.duration,
  );
});

test("Bladesworn gates gunsaber and Dragon Slash state", () => {
  const blocked = simulate("Bladesworn", ["Swift Cut"], {
    initialResource: 100,
  });
  assert.match(blocked.warnings[0], /Unsheathe the gunsaber/);
  assert.equal(blocked.endState.profession.gunsaberActive, false);

  const standardWeaponBlocked = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", "Chop"],
    {
      initialResource: 100,
      primaryWeapon: "Axe",
      secondaryWeapon: "Axe",
    },
  );
  assert.match(standardWeaponBlocked.warnings[0], /Sheathe the gunsaber/);

  const result = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", "Swift Cut", "Dragon Trigger", "Dragon Slash—Force"],
    { initialResource: 100 },
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.gunsaberActive, true);
  assert.equal(result.endState.profession.dragonTriggerActive, false);
  assert.equal(result.endState.profession.maximumAdrenaline, 0);
  assert.equal(result.totalDamage > 0, true);
  assert.equal(
    result.steps.find((step) => step.skill === "Dragon Slash—Force").start,
    3709,
  );
});

test("Bladesworn automatically releases Dragon Slash at the requested charge count", () => {
  const full = simulate(
    "Bladesworn",
    ["Dragon Trigger", "Dragon Slash—Force"],
    { initialResource: 100 },
  );
  assert.deepEqual(full.warnings, []);
  assert.equal(
    full.steps.find((step) => step.skill === "Dragon Slash—Force").start,
    2750,
  );
  assert.equal(
    full.events.find(
      (event) =>
        event.type === "damage" && event.skillId === ID.DRAGON_SLASH_FORCE,
    ).coefficient,
    20.4,
  );

  const partial = simulate(
    "Bladesworn",
    ["Dragon Trigger", { name: "Dragon Slash—Force", releaseAtCharges: 3 }],
    { initialResource: 100 },
  );
  assert.deepEqual(partial.warnings, []);
  assert.equal(
    partial.steps.find((step) => step.skill === "Dragon Slash—Force").start,
    1000,
  );
  assert.ok(
    Math.abs(
      partial.events.find(
        (event) =>
          event.type === "damage" && event.skillId === ID.DRAGON_SLASH_FORCE,
      ).coefficient -
        (1.16 + (20.4 - 1.16) * (2 / 9)),
    ) < 1e-9,
  );
});

test("Daring Dragon automatically releases at its five-charge maximum", () => {
  const result = simulate(
    "Bladesworn",
    ["Dragon Trigger", { name: "Dragon Slash—Force", releaseAtCharges: 10 }],
    { initialResource: 100, selectedTraitIds: [TRAIT.DARING_DRAGON] },
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.steps.find((step) => step.skill === "Dragon Slash—Force").start,
    1500,
  );
  assert.equal(
    result.events.find(
      (event) =>
        event.type === "damage" && event.skillId === ID.DRAGON_SLASH_FORCE,
    ).coefficient,
    20.4,
  );
});

test("Bladesworn continues charging after Flow reaches zero", () => {
  const result = simulate(
    "Bladesworn",
    ["Dragon Trigger", "Dragon Slash—Force"],
    { initialResource: 10 },
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.endState.profession.flow > 0);
  assert.ok(result.endState.profession.flow < 5);
  assert.equal(
    result.events.find(
      (event) =>
        event.type === "damage" && event.skillId === ID.DRAGON_SLASH_FORCE,
    ).coefficient,
    20.4,
  );
});

test("Bladesworn preserves partial charge time across fragmented advancement", () => {
  const state = createBladeswornState({ initialResource: 100 });
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = 0;
  state.dragonTriggerChargeDeadline = 2.5;
  state.nextDragonChargeAt = 0.25;
  const context = {
    epsilon: 1e-9,
    config: {},
    state: {
      profession: {
        specialization: { kind: "Bladesworn", state },
      },
    },
  };

  for (const target of [0.05, 0.1, 0.15, 0.2, 0.24]) {
    advanceBladesworn(context, target);
  }
  assert.equal(state.dragonCharges, 0);
  advanceBladesworn(context, 0.25);
  assert.equal(state.dragonCharges, 1);
  for (let target = 0.5; target <= 2.5; target += 0.25) {
    advanceBladesworn(context, Number(target.toFixed(2)));
  }
  assert.equal(state.dragonCharges, 10);
  assert.equal(state.flow, 54.5);
});

test("Bladesworn gunsaber skills expose icons and current PvE ammo", () => {
  const gunsaberSkillIds = [
    ID.SWIFT_CUT,
    ID.STEEL_DIVIDE,
    ID.EXPLOSIVE_THRUST,
    ID.BLOOMING_FIRE,
    ID.ARTILLERY_SLASH,
    ID.CYCLONE_TRIGGER,
    ID.BREAK_STEP,
    ID.DRAGON_SLASH_FORCE,
    ID.DRAGON_SLASH_BOOST,
    ID.DRAGON_SLASH_REACH,
    ID.FLICKER_STEP,
    ID.TRIGGERGUARD,
  ];
  assert.equal(
    gunsaberSkillIds.every((skillId) =>
      /^https:\/\/.+\.png$/i.test(warriorCatalog.skillsById.get(skillId).icon),
    ),
    true,
  );

  for (const [skillId, ammo, ammoRecharge] of [
    [ID.BLOOMING_FIRE, 2, 10],
    [ID.ARTILLERY_SLASH, 2, 15],
    [ID.CYCLONE_TRIGGER, 2, 20],
    [ID.BREAK_STEP, 2, 20],
    [ID.FLICKER_STEP, 3, 20],
    [ID.TRIGGERGUARD, 2, 30],
  ]) {
    const skill = warriorCatalog.skillsById.get(skillId);
    assert.equal(skill.ammo, ammo);
    assert.equal(skill.ammoRecharge, ammoRecharge);
    assert.equal(skill.cooldown, ammoRecharge);
  }

  const ammoResult = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", "Blooming Fire", "Blooming Fire", "Blooming Fire"],
    { initialResource: 100 },
  );
  assert.deepEqual(ammoResult.warnings, []);
  assert.deepEqual(
    ammoResult.steps
      .filter((step) => step.skill === "Blooming Fire")
      .map((step) => step.start),
    [0, 2903, 10_903],
  );
});

test("Bladesworn gunsaber packets use the requested coefficients and explosion tag", () => {
  const result = simulate(
    "Bladesworn",
    [
      ID.UNSHEATHE_GUNSABER,
      ID.SWIFT_CUT,
      ID.STEEL_DIVIDE,
      ID.EXPLOSIVE_THRUST,
      ID.BLOOMING_FIRE,
      ID.CYCLONE_TRIGGER,
      ID.BREAK_STEP,
    ],
    { initialResource: 100 },
  );
  assert.deepEqual(result.warnings, []);
  const damage = result.events.filter((event) => event.type === "damage");
  assert.deepEqual(
    damage.map((event) => Number(event.coefficient.toFixed(6))),
    [0.9, 0.255, 1.1, 0.255, 1.35, 0.408, 0.8, 0.4, 0.4, 0.4, 2.5, 0.5],
  );
  assert.equal(
    damage.every((event) => event.damageKind === "explosion"),
    true,
  );
  assert.equal(
    result.resolvedEvents
      .filter((event) => event.type === "damage")
      .every(
        (event) =>
          event.weaponStrengthProfileId === "bundle.ascended" &&
          event.resolvedWeaponStrength === 968.5,
      ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "buff" && event.kind === "aegis" && event.duration === 3,
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "buff" && event.kind === "fury" && event.duration === 5,
    ),
    true,
  );
});

test("Bladesworn ammo lockouts, all-count attacks, and reloads are modeled", () => {
  assert.equal(warriorCatalog.skillsById.get(ID.ARTILLERY_SLASH).ammo, 2);
  const artillery = simulate(
    "Bladesworn",
    [
      ID.UNSHEATHE_GUNSABER,
      ID.ARTILLERY_SLASH,
      ID.TACTICAL_RELOAD,
      ID.ARTILLERY_SLASH,
    ],
    { initialResource: 100 },
  );
  assert.deepEqual(artillery.warnings, []);
  assert.deepEqual(
    artillery.steps
      .filter((step) => step.skill === "Artillery Slash")
      .map((step) => step.start),
    [0, 3022],
  );
  assert.deepEqual(
    artillery.events
      .filter(
        (event) =>
          event.type === "damage" && event.skillId === ID.ARTILLERY_SLASH,
      )
      .map((event) => event.coefficient),
    [3, 2],
  );
  assert.equal(
    artillery.events.some(
      (event) =>
        event.type === "control" &&
        event.skillId === ID.ARTILLERY_SLASH &&
        event.controlKind === "daze",
    ),
    true,
  );
  assert.equal(
    artillery.events.find(
      (event) =>
        event.type === "action" && event.skillId === ID.ARTILLERY_SLASH,
    ).rechargeReadyAt,
    16.022,
  );

  const pistol = simulate(
    "Bladesworn",
    [
      ID.DRAGONS_ROAR,
      ID.GUNSTINGER,
      ID.DRAGONS_ROAR,
      { name: "__wait", waitMs: 500 },
    ],
    { primaryWeapon: "Pistol", secondaryWeapon: "Pistol" },
  );
  assert.deepEqual(pistol.warnings, []);
  assert.deepEqual(
    pistol.steps.slice(0, 3).map((step) => step.start),
    [0, 840, 1840],
  );
  const roarPackets = pistol.events.filter(
    (event) => event.type === "damage" && event.skillId === ID.DRAGONS_ROAR,
  );
  assert.equal(roarPackets.length, 9);
  assert.deepEqual(
    roarPackets.slice(0, 6).map((event) => Math.round(event.at * 1000)),
    [720, 960, 1200, 1440, 1680, 1920],
  );
  assert.equal(
    roarPackets.every(
      (event) => event.coefficient === 0.75 && event.damageKind === "explosion",
    ),
    true,
  );
  assert.equal(
    pistol.events.find(
      (event) => event.type === "action" && event.skillId === ID.DRAGONS_ROAR,
    ).rechargeReadyAt,
    5.84,
  );
  assert.equal(
    pistol.events.some(
      (event) =>
        event.type === "condition" &&
        event.skillId === ID.GUNSTINGER &&
        event.condition === "Vulnerability" &&
        event.stacks === 5 &&
        event.duration === 8,
    ),
    true,
  );
  assert.equal(warriorCatalog.skillsById.get(ID.GUNSTINGER).cooldown, 15);
  assert.equal(warriorCatalog.skillsById.get(ID.GUNSTINGER).ammo, 0);
});

test("Flow Stabilizer, Tactical Reload, and adrenaline conversion drive Flow", () => {
  const baseline = simulate(
    "Bladesworn",
    [{ type: "wait", durationMs: 9000 }],
    { initialResource: 0 },
  );
  assert.equal(baseline.endState.profession.flow, 18);

  const stabilized = simulate(
    "Bladesworn",
    [ID.FLOW_STABILIZER, { type: "wait", durationMs: 8500 }],
    { initialResource: 0 },
  );
  assert.equal(warriorCatalog.skillsById.get(ID.FLOW_STABILIZER).castTimeMs, 0);
  assert.equal(stabilized.endState.profession.flow, 49);
  assert.equal(
    stabilized.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "positive-flow" &&
        event.stacks === 2 &&
        event.duration === 8,
    ),
    true,
  );

  const converted = simulate("Bladesworn", [ID.SIGNET_OF_FURY], {
    initialResource: 0,
  });
  assert.equal(converted.endState.profession.flow, 31);

  const accelerated = simulate(
    "Bladesworn",
    [ID.TACTICAL_RELOAD, ID.DRAGON_TRIGGER, ID.DRAGON_SLASH_FORCE],
    { initialResource: 100 },
  );
  assert.deepEqual(accelerated.warnings, []);
  assert.equal(
    accelerated.steps.find((step) => step.skill.startsWith("Dragon Slash"))
      .start,
    2328,
  );
});

test("Dragon Slash scales from each minimum to maximum coefficient", () => {
  for (const [skillId, minimum, maximum] of [
    [ID.DRAGON_SLASH_FORCE, 1.16, 20.4],
    [ID.DRAGON_SLASH_BOOST, 0.92, 16.3],
    [ID.DRAGON_SLASH_REACH, 0.56, 10.21],
  ]) {
    const partial = simulate(
      "Bladesworn",
      [ID.DRAGON_TRIGGER, { skillId, releaseAtCharges: 1 }],
      { initialResource: 100 },
    );
    const full = simulate("Bladesworn", [ID.DRAGON_TRIGGER, skillId], {
      initialResource: 100,
    });
    assert.equal(
      partial.events.find(
        (event) => event.type === "damage" && event.skillId === skillId,
      ).coefficient,
      minimum,
    );
    assert.equal(
      full.events.find(
        (event) => event.type === "damage" && event.skillId === skillId,
      ).coefficient,
      maximum,
    );
  }
});

test("Dragon Trigger utilities expose defense, shadowstep ammo, and cooldown reset", () => {
  assert.equal(warriorCatalog.skillsById.get(ID.TRIGGERGUARD).castTimeMs, 0);
  assert.equal(
    warriorCatalog.skillsById.get(ID.TRIGGERGUARD).quicknessCastTimeMs,
    0,
  );
  const utility = simulate(
    "Bladesworn",
    [ID.DRAGON_TRIGGER, ID.TRIGGERGUARD, ID.FLICKER_STEP],
    { initialResource: 100 },
  );
  assert.deepEqual(utility.warnings, []);
  assert.equal(
    utility.events.some(
      (event) =>
        event.type === "buff" && event.kind === "aegis" && event.duration === 2,
    ),
    true,
  );
  assert.equal(
    warriorCatalog.skillsById.get(ID.FLICKER_STEP).shadowstepSkill,
    true,
  );

  const reset = simulate(
    "Bladesworn",
    [
      ID.DRAGON_TRIGGER,
      { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 1 },
      ID.DRAGONSPIKE_MINE,
      ID.DRAGON_TRIGGER,
      { skillId: ID.DRAGON_SLASH_FORCE, releaseAtCharges: 1 },
    ],
    { initialResource: 100 },
  );
  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(
    reset.steps
      .filter((step) => step.skill === "Dragon Trigger")
      .map((step) => step.start),
    [0, 3021],
  );
  assert.equal(
    reset.events.some(
      (event) =>
        event.type === "damage" &&
        event.skillId === ID.DRAGONSPIKE_MINE &&
        event.damageKind === "explosion",
    ),
    true,
  );
});

test("Overcharged Cartridges buffs explosion damage and burning", () => {
  const strikeDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.skillId === ID.SWIFT_CUT,
      )
      .reduce((sum, event) => sum + event.damage, 0);
  const base = simulate("Bladesworn", [ID.UNSHEATHE_GUNSABER, ID.SWIFT_CUT], {
    initialResource: 100,
    stats: { precision: 0, ferocity: 0 },
    target: { conditions: {} },
  });
  const overcharged = simulate(
    "Bladesworn",
    [ID.OVERCHARGED_CARTRIDGES, ID.UNSHEATHE_GUNSABER, ID.SWIFT_CUT],
    {
      initialResource: 100,
      stats: { precision: 0, ferocity: 0 },
      target: { conditions: {} },
    },
  );
  const supercharged = simulate(
    "Bladesworn",
    [
      ID.OVERCHARGED_CARTRIDGES,
      ID.OVERCHARGED_CARTRIDGES,
      ID.UNSHEATHE_GUNSABER,
      ID.SWIFT_CUT,
    ],
    {
      initialResource: 100,
      stats: { precision: 0, ferocity: 0 },
      target: { conditions: {} },
    },
  );
  assert.ok(
    Math.abs(strikeDamage(overcharged) / strikeDamage(base) - 1.15) < 1e-9,
  );
  assert.ok(
    Math.abs(strikeDamage(supercharged) / strikeDamage(base) - 1.2) < 1e-9,
  );
  assert.deepEqual(
    overcharged.events
      .filter((event) => event.condition === "Burning")
      .map((event) => event.duration),
    [3, 3],
  );
  assert.deepEqual(
    supercharged.events
      .filter((event) => event.condition === "Burning")
      .map((event) => event.duration),
    [5, 5],
  );

  const roarBase = simulate("Bladesworn", [ID.DRAGONS_ROAR], {
    selectedTraitIds: [TRAIT.PEAK_PERFORMANCE],
    stats: { precision: 0, ferocity: 0 },
    target: { conditions: {} },
  });
  const roarSupercharged = simulate(
    "Bladesworn",
    [ID.OVERCHARGED_CARTRIDGES, ID.OVERCHARGED_CARTRIDGES, ID.DRAGONS_ROAR],
    {
      selectedTraitIds: [TRAIT.PEAK_PERFORMANCE],
      stats: { precision: 0, ferocity: 0 },
      target: { conditions: {} },
    },
  );
  const roarDamage = (result) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.skillId === ID.DRAGONS_ROAR,
      )
      .reduce((sum, event) => sum + event.damage, 0);
  assert.equal(
    roarSupercharged.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.skillId === ID.DRAGONS_ROAR,
      )
      .every(
        (event) =>
          event.damageKind === "explosion" &&
          event.weaponStrengthProfileId === "weapon.pistol",
      ),
    true,
  );
  assert.ok(
    Math.abs(roarDamage(roarSupercharged) / roarDamage(roarBase) - 1.2) < 1e-9,
  );
});

test("Paragon chants consume adrenaline and start a refrain", () => {
  const result = simulate("Paragon", ["Chant of Action"], {
    initialResource: 10,
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.maximumAdrenaline, 10);
  assert.equal(result.endState.profession.adrenaline, 0);
  assert.equal(result.endState.profession.motivation, 4);
  assert.equal(result.endState.profession.activeRefrain, "Chant of Action");
});

test("Rally the Valiant grants motivation when a burst starts", () => {
  const selectedTraitIds = [TRAIT.CALL_TO_ACTION, TRAIT.RALLY_THE_VALIANT];
  const result = simulate("Paragon", ["__combat_start", "Breaching Strike"], {
    initialResource: 10,
    selectedTraitIds,
  });
  assert.equal(result.endState.profession.motivation, 8);

  const withoutRally = simulate(
    "Paragon",
    ["__combat_start", "Breaching Strike"],
    {
      initialResource: 10,
      selectedTraitIds: [TRAIT.CALL_TO_ACTION],
    },
  );
  assert.equal(withoutRally.endState.profession.motivation, 4);
});

test("Warrior signets use the supplied active effects and passive downtime", () => {
  const fury = warriorCatalog.skillsById.get(ID.SIGNET_OF_FURY);
  const might = warriorCatalog.skillsById.get(ID.SIGNET_OF_MIGHT);
  const rage = warriorCatalog.skillsById.get(ID.SIGNET_OF_RAGE);
  assert.equal(fury.cooldown, 16);
  assert.equal(fury.adrenalineGain, 30);
  assert.deepEqual(fury.effects, [
    {
      type: "buff",
      kind: "signet-of-fury-active",
      duration: 4,
      durationScale: "fixed",
      atMs: 40,
      timingAnchor: "castStart",
      timingScale: "fixed",
      stacks: 1,
    },
  ]);
  assert.equal(might.cooldown, 20);
  assert.equal(
    might.effects.some(
      (effect) =>
        effect.type === "boon" &&
        effect.boon === "might" &&
        effect.stacks === 10 &&
        effect.duration === 6,
    ),
    true,
  );
  assert.equal(rage.cooldown, 40);
  assert.equal(rage.adrenalineGain, undefined);

  const fixedFuryDuration = simulate("Core", ["Signet of Fury"], {
    stats: { concentration: 1500 },
  }).events.find((event) => event.kind === "signet-of-fury-active");
  assert.equal(fixedFuryDuration.at, 0.04);
  assert.equal(fixedFuryDuration.duration, 4);

  const noAutomaticPrecast = simulate("Core", ["__combat_start"], {
    selectedTraitIds: [TRAIT.SIGNET_MASTERY],
  });
  assert.equal(
    noAutomaticPrecast.events.some((event) => event.kind === "signet-mastery"),
    false,
  );

  const result = simulate(
    "Core",
    [
      "__combat_start",
      { type: "wait", durationMs: 3000 },
      "Signet of Rage",
      { type: "wait", durationMs: 42000 },
    ],
    { initialResource: 0, selectedSkills: ["Signet of Rage"] },
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.adrenaline, 4);
  assert.deepEqual(
    result.events
      .filter(
        (event) =>
          event.type === "buff" && event.skillName === "Signet of Rage",
      )
      .map(({ kind, stacks, duration }) => ({ kind, stacks, duration })),
    [
      { kind: "fury", stacks: 1, duration: 25 },
      { kind: "might", stacks: 5, duration: 25 },
      { kind: "swiftness", stacks: 1, duration: 25 },
    ],
  );
});

test("Lesser Signet of Might procs use the signet skill icon", () => {
  const result = simulate("Core", ["Throw Bolas"], {
    selectedTraitIds: [TRAIT.SIGNET_MASTERY],
    target: { health: 1 },
  });
  const proc = result.procSteps.find(
    (step) => step.skill === "Lesser Signet of Might",
  );

  assert.equal(
    proc?.icon,
    warriorCatalog.skillsById.get(ID.SIGNET_OF_MIGHT).icon,
  );
});

test("Burst Precision duration follows the adrenaline stage", () => {
  for (const [initialResource, duration] of [
    [10, 2],
    [20, 2],
    [30, 4],
  ]) {
    const result = simulate("Core", ["Eviscerate"], {
      initialResource,
      selectedTraitIds: [TRAIT.BURST_PRECISION],
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.events.find((event) => event.kind === "burst-precision").duration,
      duration,
    );
  }

  const result = simulate("Core", ["Eviscerate", "Throw Bolas"], {
    initialResource: 30,
    selectedTraitIds: [TRAIT.BURST_PRECISION],
    stats: { precision: 0, ferocity: 1000 },
  });
  const eviscerate = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillId === ID.EVISCERATE,
  );
  const followUp = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillId === ID.THROW_BOLAS,
  );
  assert.equal(eviscerate.criticalChance, 1);
  assert.ok(
    Math.abs(followUp.criticalDamage - eviscerate.criticalDamage - 250 / 1500) <
      1e-9,
  );
});

test("Bladesworn swap and Dragon Trigger traits use supplied behavior", () => {
  const swap = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", { type: "wait", durationMs: 5000 }],
    {
      initialResource: 0,
      selectedTraitIds: [TRAIT.UNSEEN_SWORD],
    },
  );
  assert.equal(
    swap.events.find((event) => event.name === "Unseen Sword").coefficient,
    1.2,
  );
  assert.equal(
    swap.events.find((event) => event.kind === "positive-flow").duration,
    5,
  );
  assert.equal(swap.endState.profession.flow, 20);

  const trigger = simulate(
    "Bladesworn",
    ["Dragon Trigger", "Dragon Slash—Force"],
    {
      initialResource: 100,
      selectedTraitIds: [
        TRAIT.DRAGONSCALE_DEFENSE,
        TRAIT.UNYIELDING_DRAGON,
        TRAIT.DARING_DRAGON,
      ],
    },
  );
  assert.deepEqual(trigger.warnings, []);
  assert.equal(
    trigger.events.some(
      (event) => event.kind === "stability" && event.duration === 3,
    ),
    true,
  );
  assert.equal(
    trigger.events.some(
      (event) => event.controlKind === "stun" && event.duration === 1,
    ),
    true,
  );
  assert.equal(
    trigger.events.some(
      (event) =>
        event.kind === "alacrity" &&
        event.duration === 10 &&
        event.recipients === "party",
    ),
    true,
  );
});

test("Bladesworn ammunition and explosion traits retain stack chronology", () => {
  const result = simulate(
    "Bladesworn",
    ["Unsheathe Gunsaber", "Blooming Fire"],
    {
      initialResource: 100,
      selectedTraitIds: [
        TRAIT.FIERCE_AS_FIRE,
        TRAIT.LUSH_FOREST,
        TRAIT.GUNS_AND_GLORY,
      ],
    },
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some(
      (event) =>
        event.kind === "fierce-as-fire" &&
        event.stacks === 1 &&
        event.duration === 15,
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) => event.type === "proc" && event.sourceId === TRAIT.LUSH_FOREST,
    ),
    true,
  );
  assert.equal(
    result.events.filter((event) => event.kind === "guns-and-glory").at(-1)
      .duration,
    12,
  );
});

test("Strength and Tactics traits react to dodge, burst, cripple, and control", () => {
  const result = simulate(
    "Core",
    ["Dodge", "Eviscerate", "Throw Bolas", "Stomp"],
    {
      initialResource: 30,
      selectedTraitIds: [
        TRAIT.RECKLESS_DODGE,
        TRAIT.BUILDING_MOMENTUM,
        TRAIT.BERSERKERS_POWER,
        TRAIT.MARCHING_ORDERS,
        TRAIT.SOLDIERS_COMFORT,
        TRAIT.LEG_SPECIALIST,
        TRAIT.BODY_BLOW,
        TRAIT.AGGRESSIVE_ONSLAUGHT,
      ],
    },
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.find((event) => event.name === "Reckless Dodge").coefficient,
    1.5,
  );
  assert.equal(
    result.events.find(
      (event) => event.type === "damage" && event.skillId === ID.EVISCERATE,
    ).coefficient,
    3,
  );
  const berserkersPower = result.events.find(
    (event) => event.kind === "berserkers-power",
  );
  assert.deepEqual(
    { stacks: berserkersPower.stacks, duration: berserkersPower.duration },
    { stacks: 4, duration: 15 },
  );
  assert.equal(
    result.events.some(
      (event) => event.name === "Soldier's Focus — Might" && event.stacks === 3,
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) => event.name === "Soldier's Comfort" && event.duration === 4,
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) => event.name === "Body Blow — Weakness" && event.duration === 3,
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) => event.name === "Aggressive Onslaught" && event.duration === 3,
    ),
    true,
  );
  assert.ok(result.endState.profession.endurance > 50);
});

test("Berserker's Power retains applications beyond its visible stack cap", () => {
  const rotation = [
    "Eviscerate",
    "Signet of Fury",
    "Eviscerate",
    "Throw Bolas",
    { type: "wait", durationMs: 7000 },
    "Throw Bolas",
  ];
  const config = { initialResource: 30 };
  const result = simulate("Core", rotation, {
    ...config,
    selectedTraitIds: [TRAIT.BERSERKERS_POWER],
  });
  const baseline = simulate("Core", rotation, config);
  const applications = result.events.filter(
    (event) => event.kind === "berserkers-power",
  );
  const bolasHits = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillId === ID.THROW_BOLAS,
  );
  const baselineBolasHits = baseline.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillId === ID.THROW_BOLAS,
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    applications.map(({ stacks, duration }) => [stacks, duration]),
    [
      [4, 15],
      [4, 15],
    ],
  );
  assert.equal(bolasHits.length, 2);
  assert.deepEqual(
    bolasHits.map((hit, index) =>
      Number((hit.damage / baselineBolasHits[index].damage).toFixed(9)),
    ),
    [1.15, 1.15],
  );
});

test("Axe packets and burst coefficients use the supplied PvE values", () => {
  assert.deepEqual(
    [ID.CHOP, ID.DOUBLE_CHOP, ID.TRIPLE_CHOP].map((skillId) =>
      warriorCatalog.skillsById
        .get(skillId)
        .effects.filter((effect) => effect.type === "strike")
        .map((effect) => [effect.coefficient, effect.hits]),
    ),
    [
      [[0.7, 1]],
      [
        [0.45, 1],
        [1.05, 1],
      ],
      [
        [1.5, 2],
        [1.6, 1],
      ],
    ],
  );
  const throwAxe = warriorCatalog.skillsById.get(ID.THROW_AXE);
  assert.deepEqual(
    [throwAxe.ammo, throwAxe.recharge, throwAxe.ammoRecharge],
    [2, 1, 10],
  );
  assert.equal(warriorCatalog.skillsById.get(ID.CYCLONE_AXE).cooldown, 6);
  assert.equal(warriorCatalog.skillsById.get(ID.DUAL_STRIKE).cooldown, 12);
  assert.equal(
    warriorCatalog.skillsById
      .get(ID.DUAL_STRIKE)
      .effects.find((effect) => effect.type === "boon")?.stacks,
    1,
  );
  assert.equal(warriorCatalog.skillsById.get(ID.WHIRLING_AXE).cooldown, 15);
  assert.equal(warriorCatalog.skillsById.get(ID.EVISCERATE).cooldown, 8);
  assert.equal(
    warriorCatalog.skillsById.get(ID.EVISCERATE_ID_14422).cooldown,
    8,
  );
  assert.equal(warriorCatalog.skillsById.get(ID.DECAPITATE).cooldown, 0);

  for (const [resource, coefficient] of [
    [10, 2],
    [20, 2.5],
    [30, 3],
  ]) {
    const result = simulate("Core", ["Eviscerate"], {
      initialResource: resource,
    });
    assert.equal(
      result.events.find((event) => event.type === "damage").coefficient,
      coefficient,
    );
  }
});

test("Power Berserker preset preserves the supplied build and EVTC", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-berserker-spear-greatsword.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/warrior/r-power-berserker-spear-greatsword-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/warrior/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.deepEqual(raw.weapons, ["Spear", ""]);
  assert.deepEqual(raw.alternateWeapons, ["Greatsword", ""]);
  assert.deepEqual(raw.weaponSigils, [
    ["Force", "Air"],
    ["Force", "Hydromancy"],
  ]);
  assert.equal(raw.rune, "Scholar");
  assert.equal(raw.relic, "Claw");
  assert.equal(raw.food, "Plate of Coq Au Vin with Salsa");
  assert.equal(raw.utility, "Superior Sharpening Stone");
  assert.equal(raw.assumptions.aegis, true);
  assert.deepEqual(raw.infusions, [
    { stat: "Precision", count: 4 },
    { stat: "Power", count: 14 },
  ]);
  assert.deepEqual(
    raw.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Strength", "3-3-1"],
      ["Tactics", "1-1-1"],
      ["Berserker", "1-1-1"],
    ],
  );
  assert.deepEqual(Object.values(raw.selectedSkills), [
    "Blood Reckoning",
    "Bull's Charge",
    "Signet of Might",
    "Outrage",
    "Head Butt",
  ]);
  const preset = manifest.find((section) => section.section === "Berserker")
    .presets[0];
  assert.equal(preset.benchmarkDps, 41063);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 96.631);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3967923);
  assert.equal(savedRotation.metadata.benchmarkDps, 41062.630004863866);
  assert.equal(savedRotation.metadata.castTimeQuantizationMs, 40);
  assert.equal(savedRotation.rotation.length, 146);
  assert.deepEqual(savedRotation.rotation.slice(0, 4), [
    { name: "Head Butt", skillId: ID.HEAD_BUTT },
    { name: "__combat_start", offset: 790 },
    { name: "Outrage", skillId: ID.OUTRAGE },
    { name: "Berserk", skillId: ID.BERSERK },
  ]);
  assert.equal(
    savedRotation.rotation.filter((command) => command === "Greatsword Swing")
      .length,
    3,
  );
  assert.equal(
    savedRotation.rotation.filter((command) => command === "Arc Divider")
      .length,
    17,
  );

  const build = migrateWarriorBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  assert.deepEqual(result.warnings, []);
  const hitCounts = new Map(
    result.breakdown.map((entry) => [entry.name, entry.hits]),
  );
  assert.equal(hitCounts.get("Wild Throw"), 105);
  assert.equal(
    result.casts.find((entry) => entry.name === "Arc Divider").count,
    16,
  );
  // The corrected Empowered multiplier reaches the configured target health
  // before the seventeenth Arc Divider cast begins.
  assert.equal(hitCounts.get("Arc Divider"), 16);
  assert.equal(hitCounts.get("Hundred Blades"), 63);
  assert.equal(hitCounts.get("Bladetrail"), 14);
  assert.equal(hitCounts.get("Mighty Throw — Spear Damage"), 24);
  assert.equal(hitCounts.get("Maiming Spear — Initial Strike Damage"), 14);
  assert.equal(hitCounts.get("Disrupting Throw"), 8);
  assert.equal(hitCounts.get("Head Butt"), 4);
  assert.equal(hitCounts.get("Greatsword Swing"), 3);
  assert.equal(hitCounts.get("Rush"), 4);
  assert.equal(hitCounts.get("Bull's Charge"), 4);
  assert.equal(hitCounts.get("Sigil of Air"), 20);
  assert.equal(hitCounts.get("Sigil of Hydromancy"), 7);
  const damageByName = new Map(
    result.breakdown.map((entry) => [entry.name, entry.damage]),
  );
  const inCombatHeadButtHits = result.resolvedEvents
    .filter(
      (event) => event.type === "damage" && event.skillId === ID.HEAD_BUTT,
    )
    .slice(1);
  const inCombatHeadButtDamage = inCombatHeadButtHits.reduce(
    (total, event) => total + event.damage,
    0,
  );
  for (const [name, actual, evtc] of [
    ["Arc Divider", damageByName.get("Arc Divider"), 700170],
    ["Bladetrail", damageByName.get("Bladetrail"), 246934],
    [
      "Head Butt per hit",
      inCombatHeadButtDamage / inCombatHeadButtHits.length,
      124241 / 4,
    ],
  ]) {
    assert.ok(
      Math.abs(actual / evtc - 1) < 0.06,
      `${name} damage ${actual} drifted from EVTC ${evtc}.`,
    );
  }
  assert.ok(
    Math.abs(result.dps / savedRotation.metadata.benchmarkDps - 1) < 0.05,
  );
  assert.ok(
    Math.abs(result.totalDamage / savedRotation.metadata.benchmarkDamage - 1) <
      0.01,
  );
});

test("Power Bladesworn Sword/Pistol preset follows the supplied EVTC", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-bladesworn-sword-pistol.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/warrior/r-power-bladesworn-sword-pistol-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/warrior/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);
  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.deepEqual(raw.weapons, ["Sword", "Pistol"]);
  assert.equal(raw.gear.Leggins, "Assassin's");
  assert.equal(raw.rune, "Infiltration");
  assert.equal(raw.relic, "Peitha");
  assert.equal(raw.food, "Plate of Truffle Steak");
  assert.equal(raw.utility, "Furious Sharpening Stone");
  assert.deepEqual(raw.infusions.slice(0, 2), [
    { stat: "Power", count: 17 },
    { stat: "Precision", count: 1 },
  ]);
  assert.deepEqual(
    raw.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Strength", "3-3-1"],
      ["Tactics", "1-1-1"],
      ["Bladesworn", "1-2-2"],
    ],
  );
  assert.equal(manifest[0].presets[0].benchmarkDps, 41535);

  const build = migrateWarriorBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.steps.filter((step) => step.skill === "Dragon Slash—Force").length,
    14,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Triggerguard").length,
    2,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Flicker Step").length,
    11,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Cyclone Trigger").length,
    9,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Blooming Fire").length,
    10,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Artillery Slash").length,
    6,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Explosive Thrust").length,
    6,
  );
  assert.equal(
    result.breakdown.find(
      (entry) => entry.name === "Dragon's Roar — Damage per Bullet",
    ).hits,
    28,
  );
  assert.deepEqual(
    Object.fromEntries(
      ["Rend", "Sever Artery", "Gash", "Hamstring"].map((name) => [
        name,
        result.steps.filter((step) => step.skill === name).length,
      ]),
    ),
    { Rend: 4, "Sever Artery": 6, Gash: 6, Hamstring: 5 },
  );
  assert.equal(
    result.steps.some((step) =>
      ["Chop", "Double Chop", "Triple Chop", "Cyclone Axe"].includes(
        step.skill,
      ),
    ),
    false,
  );
  const strikeDamage = (skillId, maximumHits = Number.POSITIVE_INFINITY) =>
    result.resolvedEvents
      .filter((event) => event.type === "damage" && event.skillId === skillId)
      .slice(0, maximumHits)
      .reduce((total, event) => total + event.damage, 0);
  for (const [skillId, maximumHits, evtcDamage] of [
    [ID.DRAGONS_ROAR, 28, 198403],
    [ID.DRAGON_SLASH_FORCE, 14, 2679221],
    [ID.CYCLONE_TRIGGER, 9, 171241],
    [ID.BLOOMING_FIRE, 40, 152614],
    [ID.ARTILLERY_SLASH, 6, 126825],
    [ID.EXPLOSIVE_THRUST, 11, 73192],
  ]) {
    const simulatedDamage = strikeDamage(skillId, maximumHits);
    const tolerance = skillId === ID.EXPLOSIVE_THRUST ? 0.09 : 0.07;
    assert.ok(
      Math.abs(simulatedDamage / evtcDamage - 1) < tolerance,
      `${warriorCatalog.skillsById.get(skillId).name} damage ${simulatedDamage} drifted from EVTC ${evtcDamage}.`,
    );
  }
  assert.ok(result.dps > 0);
});

test("Power Spellbreaker preset preserves the supplied build and EVTC", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-spellbreaker-dagger-mace-sword-axe.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/warrior/r-power-spellbreaker-dagger-mace-sword-axe-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/warrior/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.deepEqual(raw.weapons, ["Dagger", "Mace"]);
  assert.deepEqual(raw.alternateWeapons, ["Sword", "Axe"]);
  assert.deepEqual(raw.weaponSigils, [
    ["Force", "Air"],
    ["Force", "Hydromancy"],
  ]);
  assert.equal(raw.rune, "Scholar");
  assert.equal(raw.relic, "Claw");
  assert.equal(raw.food, "Cilantro Lime Sous-Vide Steak");
  assert.equal(raw.utility, "Superior Sharpening Stone");
  assert.deepEqual(raw.infusions, [{ stat: "Power", count: 18 }]);
  assert.deepEqual(
    raw.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Arms", "2-3-3"],
      ["Strength", "3-3-1"],
      ["Spellbreaker", "1-3-3"],
    ],
  );
  assert.deepEqual(Object.values(raw.selectedSkills), [
    "Healing Signet",
    "Kick",
    "Signet of Fury",
    "Signet of Might",
    "Winds of Disenchantment",
  ]);
  assert.equal(
    manifest.find((section) => section.section === "Spellbreaker").presets[0]
      .rotation,
    "Rotations/warrior/r-power-spellbreaker-dagger-mace-sword-axe-bench.json",
  );
  assert.equal(
    manifest.find((section) => section.section === "Spellbreaker").presets[0]
      .benchmarkDps,
    42690,
  );
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 92.521);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3949729);
  assert.equal(savedRotation.metadata.benchmarkDps, 42690.08117076123);
  assert.equal(savedRotation.rotation.length, 242);
  assert.deepEqual(savedRotation.rotation[6], {
    name: "__combat_start",
    offset: 100,
  });

  const build = migrateWarriorBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  assert.deepEqual(result.warnings, []);
  const hitCounts = new Map(
    result.breakdown.map((entry) => [entry.name, entry.hits]),
  );
  assert.equal(hitCounts.get("Winds of Disenchantment"), 5);
  assert.equal(hitCounts.get("Whirling Axe"), 90);
  assert.equal(hitCounts.get("Kick"), 7);
  assert.equal(hitCounts.get("Crushing Blow"), 14);
  assert.equal(hitCounts.get("Precise Cut"), 37);
  assert.equal(hitCounts.get("Focused Slash"), 36);
  assert.equal(hitCounts.get("Keen Strike"), 36);
  assert.equal(hitCounts.get("Tremor"), 14);
  assert.equal(hitCounts.get("Rend"), 6);
  assert.equal(hitCounts.get("Rend \u2014 Follow-Up Damage"), 6);
  assert.equal(hitCounts.get("Dual Strike"), 14);
  assert.equal(hitCounts.get("Bloodthirster"), 7);
  assert.equal(hitCounts.get("Hamstring"), 11);
  assert.equal(hitCounts.get("Disrupting Stab"), 7);
  assert.deepEqual(
    result.steps.slice(0, 7).map((step) => step.skill),
    [
      "Healing Signet",
      "Signet of Might",
      "Kick",
      "Signet of Fury",
      "Winds of Disenchantment",
      "Breaching Strike",
      "Combat Start",
    ],
  );
  const rendDamage = result.breakdown
    .filter(
      (entry) =>
        entry.name === "Rend" || entry.name === "Rend \u2014 Follow-Up Damage",
    )
    .reduce((total, entry) => total + entry.strikeDamage, 0);
  const strikeDamageByName = new Map(
    result.breakdown.map((entry) => [entry.name, entry.strikeDamage]),
  );
  for (const [name, simulatedDamage, evtcDamage] of [
    ["Keen Strike", strikeDamageByName.get("Keen Strike"), 376963],
    ["Focused Slash", strikeDamageByName.get("Focused Slash"), 271153],
    ["Precise Cut", strikeDamageByName.get("Precise Cut"), 259300],
    ["Bloodthirster", strikeDamageByName.get("Bloodthirster"), 169255],
    ["Dual Strike", strikeDamageByName.get("Dual Strike"), 193586],
    ["Rend (first six casts)", rendDamage, 212432],
  ]) {
    assert.ok(
      Math.abs(simulatedDamage / evtcDamage - 1) < 0.04,
      `${name} damage ${simulatedDamage} drifted from EVTC ${evtcDamage}.`,
    );
  }
  assert.ok(Math.abs(result.dps - 42690) < 3000);

  const randomApp = {
    ...app,
    build: {
      ...build,
      assumptions: { ...build.assumptions, simulationMode: "stochastic" },
    },
  };
  recalculate(randomApp);
  const request = warriorAppAdapter.randomDistributionRequest(randomApp);
  assert.ok(request);
  const distribution = warriorAppAdapter.calculateRandomDistribution({
    ...request,
    trials: 3,
  });
  assert.equal(distribution.trials, 3);
  assert.equal(Number.isFinite(distribution.mean), true);
});

test("Sword/Dagger Spellbreaker preset preserves the supplied build and EVTC", async () => {
  const [raw, referenceBuild, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-spellbreaker-dagger-mace-sword-dagger.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-spellbreaker-dagger-mace-sword-axe.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/warrior/r-power-spellbreaker-dagger-mace-sword-dagger-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/warrior/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.deepEqual(raw, {
    ...referenceBuild,
    alternateWeapons: ["Sword", "Dagger"],
  });
  const preset = manifest
    .find((section) => section.section === "Spellbreaker")
    .presets.find((entry) => entry.build.endsWith("sword-dagger.json"));
  assert.equal(preset.benchmarkDps, 42828);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 92.406);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3957534);
  assert.equal(savedRotation.metadata.benchmarkDps, 42827.673527693005);

  const build = migrateWarriorBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  assert.deepEqual(result.warnings, []);
  const hitCounts = new Map(
    result.breakdown.map((entry) => [entry.name, entry.hits]),
  );
  assert.equal(hitCounts.get("Winds of Disenchantment"), 5);
  assert.equal(hitCounts.get("Kick"), 7);
  assert.equal(hitCounts.get("Crushing Blow"), 14);
  assert.equal(hitCounts.get("Wastrel's Ruin"), 7);
  assert.equal(hitCounts.get("Hushblade"), 9);
  assert.equal(hitCounts.get("Precise Cut"), 36);
  assert.equal(hitCounts.get("Focused Slash"), 36);
  assert.equal(hitCounts.get("Keen Strike"), 36);
  assert.equal(hitCounts.get("Sever Artery"), 23);
  assert.equal(hitCounts.get("Gash"), 20);
  assert.equal(hitCounts.get("Hamstring"), 20);
  assert.ok(Math.abs(result.dps - 42828) < 3000);
});

test("Power Paragon preset preserves the EVTC build and executes", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-paragon-sword-axe-dagger-mace.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/warrior/r-power-paragon-sword-axe-dagger-mace-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/warrior/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);
  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.deepEqual(raw.weapons, ["Sword", "Axe"]);
  assert.deepEqual(raw.alternateWeapons, ["Dagger", "Mace"]);
  assert.deepEqual(raw.weaponSigils, [
    ["Force", "Hydromancy"],
    ["Force", "Air"],
  ]);
  assert.equal(raw.rune, "Scholar");
  assert.equal(raw.relic, "Claw");
  assert.equal(raw.food, "Cilantro Lime Sous-Vide Steak");
  assert.equal(raw.utility, "Superior Sharpening Stone");
  assert.deepEqual(raw.infusions, [{ stat: "Power", count: 18 }]);
  assert.deepEqual(
    raw.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Arms", "2-1-3"],
      ["Strength", "3-3-1"],
      ["Paragon", "1-1-2"],
    ],
  );
  assert.deepEqual(Object.values(raw.selectedSkills), [
    "Healing Signet",
    "Bull's Charge",
    "Signet of Fury",
    "Signet of Might",
    "Signet of Rage",
  ]);
  assert.equal(
    manifest.find((section) => section.section === "Paragon").presets[0]
      .benchmarkDps,
    42115,
  );
  assert.equal(savedRotation.metadata.benchmarkDamage, 3957198);
  assert.deepEqual(savedRotation.rotation.slice(0, 6), [
    { name: "Healing Signet", skillId: ID.HEALING_SIGNET },
    "Signet of Rage",
    "Signet of Might",
    "Signet of Fury",
    "Bull's Charge",
    { name: "__combat_start", offset: 100 },
  ]);

  const build = migrateWarriorBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 2,
  };
  recalculate(app);
  const result = runSimulation(app);
  assert.deepEqual(result.warnings, []);
  const combatStart = result.events.find(
    (event) => event.type === "combat_start",
  ).at;
  assert.deepEqual(
    result.events
      .filter(
        (event) => event.kind === "signet-mastery" && event.at < combatStart,
      )
      .map((event) => event.skillName),
    ["Healing Signet", "Signet of Rage", "Signet of Might", "Signet of Fury"],
  );
  assert.equal(
    simulationEventLogRows(result, build, warriorProfession).some(
      (row) => row.description === "UNPRESENTED CUSTOM EVENT paragon.state",
    ),
    false,
  );
  const hitCounts = new Map(
    result.breakdown.map((entry) => [entry.name, entry.hits]),
  );
  assert.equal(hitCounts.get("Breaching Strike"), 13);
  assert.equal(hitCounts.get("Crushing Blow"), 14);
  assert.equal(hitCounts.get("Tremor"), 14);
  assert.equal(hitCounts.get("Precise Cut"), 43);
  assert.equal(hitCounts.get("Focused Slash"), 39);
  assert.equal(hitCounts.get("Keen Strike"), 39);
  assert.equal(hitCounts.get("Sever Artery"), 12);
  assert.equal(hitCounts.get("Gash"), 12);
  assert.equal(hitCounts.get("Hamstring"), 12);
  const damageByName = new Map(
    result.breakdown.map((entry) => [entry.name, entry.damage]),
  );
  for (const [name, evtcDamage] of [
    ["Breaching Strike", 520714],
    ["Crushing Blow", 360880],
    ["Tremor", 200470],
    ["Dual Strike", 182114],
    ["Precise Cut", 303944],
  ]) {
    const simulatedDamage = damageByName.get(name);
    assert.ok(
      Math.abs(simulatedDamage / evtcDamage - 1) < 0.05,
      `${name} damage ${simulatedDamage} drifted from EVTC ${evtcDamage}.`,
    );
  }
  assert.ok(Math.abs(result.dps - 42115) < 3000);

  const randomApp = {
    ...app,
    build: {
      ...build,
      assumptions: { ...build.assumptions, simulationMode: "stochastic" },
    },
  };
  recalculate(randomApp);
  const request = warriorAppAdapter.randomDistributionRequest(randomApp);
  assert.ok(request);
  const distribution = warriorAppAdapter.calculateRandomDistribution({
    ...request,
    trials: 3,
  });
  assert.equal(distribution.trials, 3);
  assert.equal(Number.isFinite(distribution.mean), true);
});

test("Warrior is exposed through the shared application registry", async () => {
  assert.equal(professionRoute("warrior"), "warrior.html");
  assert.equal(
    professionOptions.some((profession) => profession.id === "warrior"),
    true,
  );
  assert.equal(await loadProfession("warrior"), warriorProfession);
  assert.equal(
    typeof (await loadProfessionAppAdapter("warrior")).recalculate,
    "function",
  );

  const html = await readFile(
    new URL("../../../warrior.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /data-profession="warrior"/);
  assert.match(html, /js\/app\/app\.js/);
});
