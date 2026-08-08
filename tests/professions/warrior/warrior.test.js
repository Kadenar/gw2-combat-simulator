import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionOptions,
} from "../../../js/app/profession/registry.js";
import { professionRoute } from "../../../js/app/profession/selector.js";
import { activeResourceGroup } from "../../../js/app/rotation/resource-view.js";
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
import { createWarriorCoreState } from "../../../js/professions/warrior/core/state.js";
import { DATA_SNAPSHOT } from "../../../js/professions/warrior/data/warrior-api-metadata.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../../js/professions/warrior/data/ids.js";
import { warriorProfession } from "../../../js/professions/warrior/definition.js";
import { berserkerModule } from "../../../js/professions/warrior/specializations/berserker/module.js";
import { bladeswornModule } from "../../../js/professions/warrior/specializations/bladesworn/module.js";
import { advanceBladesworn } from "../../../js/professions/warrior/specializations/bladesworn/handlers.js";
import { createBladeswornState } from "../../../js/professions/warrior/specializations/bladesworn/state.js";
import { paragonModule } from "../../../js/professions/warrior/specializations/paragon/module.js";
import { spellbreakerModule } from "../../../js/professions/warrior/specializations/spellbreaker/module.js";
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
  assert.equal(warriorCatalog.skills.length, 208);
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
    return {
      palette: warriorProfession.ui.paletteGroups(context)[0].skillIds,
      skillBar: warriorProfession.ui.skillBarGroups(context)[0].skillIds,
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
    ID.DRAGON_SLASH_FORCE,
    ID.DRAGON_SLASH_BOOST,
    ID.DRAGON_SLASH_REACH,
  ]);
  assert.deepEqual(bladesworn.skillBar, bladesworn.palette);

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
      available: false,
      message: "Gunsaber is not active",
    },
  );
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

test("Spellbreaker uses its reduced adrenaline cap for Full Counter", () => {
  const result = simulate("Spellbreaker", ["Full Counter"], {
    initialResource: 30,
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.maximumAdrenaline, 20);
  assert.equal(result.endState.profession.adrenaline < 20, true);
  assert.equal(result.totalDamage > 0, true);
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
    5750,
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
    5250,
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
    1750,
  );
  assert.ok(
    Math.abs(
      partial.events.find(
        (event) =>
          event.type === "damage" && event.skillId === ID.DRAGON_SLASH_FORCE,
      ).coefficient - 6.12,
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
    2750,
  );
  assert.equal(
    result.events.find(
      (event) =>
        event.type === "damage" && event.skillId === ID.DRAGON_SLASH_FORCE,
    ).coefficient,
    20.4,
  );
});

test("Bladesworn reports when the requested Dragon Slash charge is unreachable", () => {
  const result = simulate(
    "Bladesworn",
    ["Dragon Trigger", "Dragon Slash—Force"],
    { initialResource: 30 },
  );
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /needs 100 Flow to reach 10 charges/);
});

test("Bladesworn preserves partial charge time across fragmented advancement", () => {
  const state = createBladeswornState({ initialResource: 100 });
  state.dragonTriggerActive = true;
  state.dragonTriggerStartedAt = 0;
  state.nextDragonChargeAt = 0.5;
  const context = {
    epsilon: 1e-9,
    config: {},
    state: {
      profession: {
        specialization: { kind: "Bladesworn", state },
      },
    },
  };

  for (const target of [0.1, 0.2, 0.3, 0.4, 0.49]) {
    advanceBladesworn(context, target);
  }
  assert.equal(state.dragonCharges, 0);
  advanceBladesworn(context, 0.5);
  assert.equal(state.dragonCharges, 1);
  for (let target = 0.6; target <= 5; target += 0.1) {
    advanceBladesworn(context, Number(target.toFixed(1)));
  }
  assert.equal(state.dragonCharges, 10);
  assert.equal(state.flow, 0);
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
    [0, 750, 10_750],
  );
});

test("Paragon chants consume adrenaline and start a refrain", () => {
  const result = simulate("Paragon", ["Chant of Action"], {
    initialResource: 10,
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.maximumAdrenaline, 10);
  assert.equal(result.endState.profession.adrenaline, 0);
  assert.equal(result.endState.profession.motivation, 2);
  assert.equal(result.endState.profession.activeRefrain, "Chant of Action");
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
