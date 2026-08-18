import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  currentAutoattackSkill,
  paletteActionSkills,
  weaponSkills,
} from "../../../js/app/rotation/palette-model.js";
import { skillBarInspectionStacks } from "../../../js/app/build/skills-panel.js";
import { timelineWeaponRows } from "../../../js/app/rotation/timeline-model.js";
import {
  activeResourceGroup,
  paletteSkillResourceView,
} from "../../../js/app/rotation/resource-view.js";
import { renderPalette } from "../../../js/app/rotation/palette-view.js";
import {
  loadProfession,
  loadProfessionAppAdapter,
  professionOptions,
} from "../../../js/app/profession/registry.js";
import { professionRoute } from "../../../js/app/profession/selector.js";
import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import {
  applyBalanceProfilePatch,
  applySkillPatch,
} from "../../../js/platform/gw2/skill-patch.js";
import { skillBreakdownRows } from "../../../js/platform/ui/result-tables.js";
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
import { RANGER_CORE_BALANCE_PROFILE_IDS } from "../../../js/professions/ranger/core/profiles.js";
import { DRUID_BALANCE_PROFILE_IDS } from "../../../js/professions/ranger/specializations/druid/profiles.js";
import { SOULBEAST_BALANCE_PROFILE_IDS } from "../../../js/professions/ranger/specializations/soulbeast/profiles.js";
import { UNTAMED_BALANCE_PROFILE_IDS } from "../../../js/professions/ranger/specializations/untamed/profiles.js";
import { GALESHOT_BALANCE_PROFILE_IDS } from "../../../js/professions/ranger/specializations/galeshot/profiles.js";
import { rangerPetCombatMetadata } from "../../../js/professions/ranger/core/pets.js";
import {
  rangerCoreAttributeRules,
  rangerCoreCastRules,
  rangerCoreModifierRules,
} from "../../../js/professions/ranger/core/rules.js";
import { RANGER_SKILL_MECHANICS } from "../../../js/professions/ranger/mechanics/skill-mechanics.js";
import { soulbeastModifierRules } from "../../../js/professions/ranger/specializations/soulbeast/rules.js";
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
  selectedPet2: "Fanged Iboga",
  selectedHammerSkillIds: [
    ID.WILD_SWING,
    ID.OVERBEARING_SMASH,
    ID.SAVAGE_SHOCK_WAVE,
    ID.THUMP,
  ],
  professionAssumptions: {
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

const applyRangerPatch = (patch) =>
  applyBalanceProfilePatch(applySkillPatch(rangerCatalog, patch), patch);

test("Ranger scheduler snapshots expose flat profession state", () => {
  const result = simulate("Soulbeast", []);

  assert.equal(result.snapshot.core, undefined);
  assert.equal(result.snapshot.specialization, undefined);
  assert.equal(result.snapshot.activePet, "Lynx");
  assert.equal(result.snapshot.beastmodeActive, true);
});

test("Ranger catalog pins API identity and explicit module-owned mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-08-08");
  assert.equal(rangerCatalog.specializations.length, 9);
  assert.equal(rangerCatalog.traits.length, 108);
  assert.equal(rangerCatalog.skills.length, 310);
  assert.equal(Object.keys(RANGER_SKILL_MECHANICS).length, 302);
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
    [
      ID.TWIN_DARTS,
      ID.PET_TAIL_LASH,
      ID.CONSUMING_BITE,
      ID.CRIPPLING_ANGUISH_PET,
      ID.NARCOTIC_SPORES_PET,
      ID.FANG_GRAPPLE,
    ].every((skillId) => rangerCatalog.skillsById.get(skillId)?.icon),
    true,
  );
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
  assert.equal(
    rangerCatalog.skillsById.get(ID.PET_SWAP).icon,
    rangerCatalog.skillsById.get(ID.SWAP_WEAPONS).icon,
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
  assert.deepEqual(
    [ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE].map(
      (id) => rangerCatalog.skillsById.get(id).icon,
    ),
    [
      "https://render.guildwars2.com/file/1FD6BA0D5205082CF724026543A9CE3EA9E3AB10/2565748.png",
      "https://render.guildwars2.com/file/583FF23D285DAFF432CF2C3BFBE27FF4142D4C9B/2565753.png",
    ],
  );
});

test("Ranger modules expose isolated balance-profile authoring", () => {
  const modules = new Map(
    rangerProfession.patchAuthoring.modules.map((module) => [
      module.id,
      module,
    ]),
  );
  assert.deepEqual(
    [...modules.keys()],
    ["Core", "Druid", "Soulbeast", "Untamed", "Galeshot"],
  );
  assert.equal(
    [...modules.values()].every((module) => module.balanceProfiles.length > 0),
    true,
  );

  const profile = (moduleId, profileId) =>
    modules
      .get(moduleId)
      .balanceProfiles.find((entry) => entry.id === profileId);
  assert.equal(
    profile("Core", RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha).patchableFields
      .weaponAttributeBonus,
    300,
  );
  assert.equal(
    profile("Druid", DRUID_BALANCE_PROFILE_IDS.resources).patchableFields
      .maximumStacks,
    100,
  );
  assert.equal(
    profile("Soulbeast", SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack).profile
      .effects[0].coefficient,
    0.95,
  );
  assert.equal(
    profile("Untamed", UNTAMED_BALANCE_PROFILE_IDS.resources).patchableFields
      .durationMultiplier,
    4,
  );
  assert.equal(
    profile("Galeshot", GALESHOT_BALANCE_PROFILE_IDS.resources).patchableFields
      .pulseInterval,
    5,
  );

  const opaqueModifierRules = [...modules.values()].flatMap((module) =>
    module.modifierRules.filter(
      (rule) =>
        (typeof rule.amount === "function" ||
          typeof rule.factor === "function") &&
        Object.keys(rule.parameters).length === 0,
    ),
  );
  assert.deepEqual(opaqueModifierRules, []);
  assert.deepEqual(
    modules
      .get("Core")
      .modifierRules.find(
        (rule) => rule.id === "ranger.consuming-bite-condition-count",
      ).parameters,
    { maximumConditions: 5, coefficientPerCondition: 0.025 },
  );

  const preview = applyRangerPatch({
    skills: {
      [ID.SUPERSONIC_ARROW]: {
        fields: { arrowCost: { from: 3, to: 2 } },
      },
    },
    balanceProfiles: {
      [RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha]: {
        fields: { weaponAttributeBonus: { from: 300, to: 350 } },
      },
      [DRUID_BALANCE_PROFILE_IDS.resources]: {
        fields: { maximumStacks: { from: 100, to: 120 } },
      },
      [SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack]: {
        effects: [{ effectIndex: 0, coefficient: { from: 0.95, to: 1 } }],
      },
      [UNTAMED_BALANCE_PROFILE_IDS.resources]: {
        fields: { durationMultiplier: { from: 4, to: 5 } },
      },
      [GALESHOT_BALANCE_PROFILE_IDS.resources]: {
        fields: { pulseInterval: { from: 5, to: 4 } },
      },
    },
  });

  assert.equal(preview.skillsById.get(ID.SUPERSONIC_ARROW).arrowCost, 2);
  assert.equal(
    preview.balanceProfilesById.get(RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha)
      .weaponAttributeBonus,
    350,
  );
  assert.equal(
    preview.balanceProfilesById.get(DRUID_BALANCE_PROFILE_IDS.resources)
      .maximumStacks,
    120,
  );
  assert.equal(
    preview.balanceProfilesById.get(SOULBEAST_BALANCE_PROFILE_IDS.oneWolfPack)
      .effects[0].coefficient,
    1,
  );
  assert.equal(
    preview.balanceProfilesById.get(UNTAMED_BALANCE_PROFILE_IDS.resources)
      .durationMultiplier,
    5,
  );
  assert.equal(
    preview.balanceProfilesById.get(GALESHOT_BALANCE_PROFILE_IDS.resources)
      .pulseInterval,
    4,
  );

  const petMetadata = rangerPetCombatMetadata({
    catalog: preview,
    config: {
      selectedPet: "Pig",
      selectedTraitIds: [TRAIT.PACK_ALPHA],
    },
    state: {
      time: 0,
      cooldowns: new Map(),
      profession: {
        core: { activePet: "Pig", activePetSlot: 1, petAutoGeneration: 0 },
      },
    },
  });
  assert.equal(petMetadata.summonBasePower, 1874);

  assert.equal(rangerCatalog.skillsById.get(ID.SUPERSONIC_ARROW).arrowCost, 3);
  assert.equal(
    rangerCatalog.balanceProfilesById.get(
      RANGER_CORE_BALANCE_PROFILE_IDS.packAlpha,
    ).weaponAttributeBonus,
    300,
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
  assert.equal(defaults.selectedPet2, "Lynx");
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
    ["targetDefiant", "simulationMode"],
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

  const withoutAutonomousPetCasts = migrateRangerBuild({
    ...defaults,
    selectedPet: "Carrion Devourer",
    selectedPet2: "Fanged Iboga",
    rotation: [
      { name: "Twin Darts", skillId: ID.TWIN_DARTS },
      { name: "Tail Lash", skillId: ID.PET_TAIL_LASH },
      "Poisonous Cloud",
      { name: "Regenerate", skillId: ID.REGENERATE },
      { name: "Consuming Bite", skillId: ID.CONSUMING_BITE },
      {
        name: "Crippling Anguish",
        skillId: ID.CRIPPLING_ANGUISH_PET,
      },
      { name: "Narcotic Spores", skillId: ID.NARCOTIC_SPORES_PET },
      { name: "Fang Grapple", skillId: ID.FANG_GRAPPLE },
    ],
  });
  assert.deepEqual(
    withoutAutonomousPetCasts.rotation.map((command) => command.skillId),
    [ID.POISONOUS_CLOUD, ID.NARCOTIC_SPORES_PET],
  );
});

test("Go for the Throat follows Soulbeast F3 and unmerged pet F2", () => {
  const soulbeast = simulate("Soulbeast", ["Worldly Impact"], {
    selectedPet: "Pig",
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT],
  });
  const soulbeastProcs = soulbeast.procSteps.filter(
    (step) => step.skill === 'Lesser "Sic \'Em!"',
  );
  assert.equal(soulbeastProcs.length, 1);
  assert.equal(soulbeastProcs[0].sourceSkill, "Worldly Impact");
  assert.equal(soulbeastProcs[0].detail, "5s, +15% strike damage");
  assert.equal(Boolean(soulbeastProcs[0].icon), true);

  const core = simulate("Core", ["Intimidating Howl"], {
    selectedPet: "Krytan Drakehound",
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT],
  });
  const coreProcs = core.procSteps.filter(
    (step) => step.skill === 'Lesser "Sic \'Em!"',
  );
  assert.equal(coreProcs.length, 1);
  assert.equal(coreProcs[0].sourceSkill, "Intimidating Howl");
  assert.equal(coreProcs[0].detail, "8s, +40% pet strike damage");
  assert.equal(Boolean(coreProcs[0].icon), true);

  const familySkill = simulate("Core", ["Spit"], {
    selectedPet: "Forest Spider",
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT],
  });
  assert.equal(
    familySkill.procSteps.some((step) => step.skill === 'Lesser "Sic \'Em!"'),
    false,
  );
});

test("precombat pet F2 starts combat before Go for the Throat applies", () => {
  const rotation = [
    "Furious Pounce",
    "__combat_start",
    { type: "wait", durationMs: 8000 },
  ];
  const config = {
    selectedPet: "Tiger",
    target: { health: 10000000 },
  };
  const baseline = simulate("Core", rotation, config);
  const goForTheThroat = simulate("Core", rotation, {
    ...config,
    selectedTraitIds: [TRAIT.GO_FOR_THE_THROAT],
  });
  const proc = goForTheThroat.procSteps.find(
    (step) => step.skill === 'Lesser "Sic \'Em!"',
  );
  const f2Damage = (result) =>
    result.breakdown.find((row) => row.name === "Furious Pounce").damage;
  const slashDamage = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.skillId === ID.FELINE_SLASH,
    ).damage;

  assert.equal(proc.sourceSkill, "Furious Pounce");
  assert.equal(proc.start, goForTheThroat.combatStartTime * 1000);
  assert.equal(goForTheThroat.firstHitTime, goForTheThroat.combatStartTime);
  assert.equal(f2Damage(goForTheThroat), f2Damage(baseline));
  assert.ok(
    Math.abs(slashDamage(goForTheThroat) / slashDamage(baseline) - 1.4) < 1e-9,
  );
});

test("Soulbeast condition modifiers and duration bonuses use their actual targets", () => {
  const rotation = ["Splitblade", { type: "wait", durationMs: 10000 }];
  const config = {
    primaryWeapon: "Axe",
    secondaryWeapon: "Axe",
    selectedPet: "Pig",
    professionAssumptions: { targetDefiant: true },
    stats: { conditionDamage: 1000, expertise: 0 },
    target: { health: 10000000 },
  };
  const baseline = simulate("Soulbeast", rotation, config);
  const huntersTactics = simulate("Soulbeast", rotation, {
    ...config,
    selectedTraitIds: [TRAIT.HUNTERS_TACTICS],
  });
  const oppressive = simulate("Soulbeast", rotation, {
    ...config,
    selectedTraitIds: [TRAIT.OPPRESSIVE_SUPERIORITY],
  });
  const oppressiveWithExpertise = simulate("Soulbeast", rotation, {
    ...config,
    selectedTraitIds: [TRAIT.OPPRESSIVE_SUPERIORITY],
    stats: { ...config.stats, expertise: 150 },
  });
  const bleeding = (result) =>
    result.breakdown
      .filter((row) => row.name.includes("Bleeding"))
      .reduce((total, row) => total + row.damage, 0);
  const splitbladeStrike = (result) =>
    result.breakdown.find((row) => row.name === "Splitblade").damage;
  const splitbladeBleedDuration = (result) => {
    const application = result.resolvedEvents.find(
      (event) =>
        event.type === "condition" &&
        event.skillId === ID.SPLITBLADE &&
        event.condition === "Bleeding",
    );
    return application.expiresAt - application.at;
  };

  assert.equal(bleeding(huntersTactics), bleeding(baseline));
  assert.ok(splitbladeStrike(huntersTactics) > splitbladeStrike(baseline));
  assert.ok(Math.abs(splitbladeBleedDuration(oppressive) - 6.6) < 1e-9);
  assert.ok(
    Math.abs(splitbladeBleedDuration(oppressiveWithExpertise) - 7.2) < 1e-9,
  );
});

test("Twice as Vicious activates from a disable", () => {
  const rotation = ["Overbearing Smash", "Heavy Smash"];
  const config = {
    primaryWeapon: "Hammer",
    selectedPet: "Pig",
    selectedHammerSkillIds: [
      ID.WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.SAVAGE_SHOCK_WAVE,
      ID.THUMP,
    ],
  };
  const baseline = simulate("Soulbeast", rotation, config);
  const twiceAsVicious = simulate("Soulbeast", rotation, {
    ...config,
    selectedTraitIds: [TRAIT.TWICE_AS_VICIOUS],
  });
  const heavySmashDamage = (result) =>
    result.breakdown.find((row) => row.name === "Heavy Smash").damage;

  assert.ok(
    Math.abs(
      heavySmashDamage(twiceAsVicious) / heavySmashDamage(baseline) - 1.07,
    ) < 1e-12,
  );
});

test("Ranger Ice projectile finishers resolve per projectile without triggering Twice as Vicious", () => {
  const rotation = [
    "Frost Trap",
    "Splitblade",
    "Ricochet",
    "Ricochet",
    "Ricochet",
    "Ricochet",
    "Ricochet",
  ];
  const deterministic = simulate("Soulbeast", rotation, {
    primaryWeapon: "Axe",
    secondaryWeapon: "Axe",
    selectedPet: "Pig",
    selectedTraitIds: [TRAIT.TWICE_AS_VICIOUS],
  });
  const withoutTwiceAsVicious = simulate("Soulbeast", rotation, {
    primaryWeapon: "Axe",
    secondaryWeapon: "Axe",
    selectedPet: "Pig",
  });
  const comboConditions = deterministic.resolvedEvents.filter(
    (event) =>
      event.type === "combo" &&
      event.fieldType === "Ice" &&
      event.finisherType === "Projectile",
  );

  assert.deepEqual(
    comboConditions.map((event) => [
      event.skillName,
      event.outcome.condition,
      event.outcome.duration,
    ]),
    [
      ["Splitblade", "Chilled", 1],
      ["Ricochet", "Chilled", 1],
    ],
  );
  assert.equal(deterministic.totalDamage, withoutTwiceAsVicious.totalDamage);

  const stochastic = simulate("Soulbeast", rotation.slice(0, 6), {
    primaryWeapon: "Axe",
    secondaryWeapon: "Axe",
    selectedPet: "Pig",
    randomness: { mode: "stochastic", seed: 1 },
  });
  assert.equal(
    stochastic.resolvedEvents.filter(
      (event) =>
        event.type === "combo" &&
        event.fieldType === "Ice" &&
        event.finisherType === "Projectile",
    ).length,
    3,
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

test("Ranger pet AI skills are autonomous and Beast commands stay independent", () => {
  const carrionContext = {
    specialization: "Core",
    professionState: {
      activePet: "Carrion Devourer",
      activePetSkillIds: RANGER_PETS.find(
        (pet) => pet.name === "Carrion Devourer",
      ).skillIds,
    },
  };
  const carrionPalette = rangerProfession.ui
    .paletteGroups(carrionContext)
    .find((group) => group.id === "ranger-pet");
  assert.deepEqual(carrionPalette.skillIds, [ID.POISONOUS_CLOUD, ID.PET_SWAP]);
  assert.equal(carrionPalette.includeActionSkills, true);
  assert.equal(carrionPalette.statusIcon.label, "Carrion Devourer");
  assert.equal(
    carrionPalette.statusIcon.icon,
    RANGER_PETS.find((pet) => pet.name === "Carrion Devourer").icon,
  );

  const endurance = rangerProfession.ui.resourceViews({
    specialization: "Galeshot",
    professionState: { endurance: 35, maximumEndurance: 100 },
  })[0];
  assert.equal(endurance.value, 35);
  assert.equal(endurance.paletteSkillId, ID.DODGE);
  const resourceApp = {
    profession: rangerProfession,
    adapter: { eliteSpecialization: () => "Core" },
    build: { initialResource: 0 },
    results: {
      endState: {
        profession: { endurance: 35, maximumEndurance: 100 },
      },
    },
  };
  assert.deepEqual(paletteSkillResourceView(resourceApp, ID.DODGE), {
    id: "endurance",
    label: "Current endurance: 35/100",
    value: 35,
    maximum: 100,
  });
  assert.equal(activeResourceGroup(resourceApp), "");

  const directAuto = simulate("Core", ["Twin Darts"], {
    selectedPet: "Carrion Devourer",
  });
  assert.match(directAuto.warnings[0], /uses this skill automatically/);

  const result = simulate(
    "Core",
    [
      "__combat_start",
      "Rapid Fire",
      "Poisonous Cloud",
      "Point-Blank Shot",
      { type: "wait", durationMs: 4000 },
    ],
    { primaryWeapon: "Longbow", selectedPet: "Carrion Devourer" },
  );
  const rapidFire = result.steps.find((step) => step.skill === "Rapid Fire");
  const poison = result.steps.find((step) => step.skill === "Poisonous Cloud");
  const pointBlankShot = result.steps.find(
    (step) => step.skill === "Point-Blank Shot",
  );
  const poisonAction = result.events.find(
    (event) => event.type === "action" && event.skillId === ID.POISONOUS_CLOUD,
  );
  assert.equal(poison.start, rapidFire.start);
  assert.equal(pointBlankShot.start, rapidFire.end);
  assert.equal(poisonAction.actorType, "summon");
  assert.equal(poisonAction.at > rapidFire.start / 1000, true);
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "action" &&
        event.skillId === ID.TWIN_DARTS &&
        event.actorType === "summon" &&
        event.autonomousPetSkill,
    ),
    true,
  );
});

test("queued Beast commands never delay player skills", () => {
  const result = simulate(
    "Core",
    [
      "__combat_start",
      "Poisonous Cloud",
      "Rapid Fire",
      "Poisonous Cloud",
      "Point-Blank Shot",
      { type: "wait", durationMs: 35000 },
    ],
    { primaryWeapon: "Longbow", selectedPet: "Carrion Devourer" },
  );
  const rapidFire = result.steps.find((step) => step.skill === "Rapid Fire");
  const pointBlankShot = result.steps.find(
    (step) => step.skill === "Point-Blank Shot",
  );
  const poisonActions = result.events.filter(
    (event) => event.type === "action" && event.skillId === ID.POISONOUS_CLOUD,
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(rapidFire.start, 0);
  assert.equal(pointBlankShot.start, rapidFire.end);
  assert.equal(poisonActions.length, 2);
  assert.equal(poisonActions[1].at - poisonActions[0].at >= 29.999, true);
});

test("Ranger pet commands require Alacrity on the active pet", () => {
  const config = {
    selectedPet: "Fanged Iboga",
    boons: { alacrity: true },
  };
  const playerAlacrity = simulate("Core", ["Narcotic Spores"], config);
  const petAlacrity = simulate(
    "Core",
    ['"We Heal As One!"', "Narcotic Spores"],
    config,
  );
  const rechargeMs = (result) => {
    const step = result.steps.find(
      (candidate) => candidate.skill === "Narcotic Spores",
    );
    return result.endState.cooldowns["Narcotic Spores"].readyAt - step.end;
  };

  assert.equal(rechargeMs(playerAlacrity), 15000);
  assert.equal(rechargeMs(petAlacrity), 12000);
  assert.equal(
    petAlacrity.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "alacrity" &&
        event.affectsSummons === true,
    ),
    true,
  );
});

test("Pack Alpha excludes unleashed-pet and Beastmode skill recharges", () => {
  const recharge = (skill) =>
    rangerCoreCastRules.modifyRechargeDuration(
      {
        skill,
        traits: new Set([TRAIT.PACK_ALPHA]),
        state: {
          time: 0,
          profession: { core: { quickDrawUntil: 0 } },
        },
      },
      10,
    );

  assert.equal(recharge({ name: "Pet skill", petSkill: true }), 8);
  assert.equal(
    recharge({
      name: "Unleashed pet skill",
      petSkill: true,
      unleashedPetSkill: true,
    }),
    10,
  );
  assert.equal(
    recharge({
      name: "Beastmode skill",
      petSkill: true,
      beastmodeSkill: true,
    }),
    10,
  );
});

test("Pack Alpha improves only the Pig's five documented attributes", () => {
  const metadata = rangerPetCombatMetadata({
    config: { selectedTraitIds: [TRAIT.PACK_ALPHA] },
    state: {
      cooldowns: new Map(),
      profession: {
        core: { activePet: "Pig", activePetSlot: 1, petAutoGeneration: 0 },
      },
    },
  });

  assert.deepEqual(
    {
      power: metadata.summonBasePower,
      precision: metadata.summonBasePrecision,
      toughness: metadata.summonBaseToughness,
      vitality: metadata.summonBaseVitality,
      conditionDamage: metadata.summonBaseConditionDamage,
      ferocity: metadata.summonBaseFerocity,
      expertise: metadata.summonBaseExpertise,
      healingPower: metadata.summonBaseHealingPower,
    },
    {
      power: 1824,
      precision: 1480,
      toughness: 2511,
      vitality: 3885,
      conditionDamage: 1000,
      ferocity: 0,
      expertise: 0,
      healingPower: 600,
    },
  );
});

test("Tiger uses its documented attributes and nominal Bite recharge", () => {
  const metadata = rangerPetCombatMetadata({
    config: {
      selectedTraitIds: [TRAIT.PACK_ALPHA],
      selectedSkills: ["Signet of the Wild"],
    },
    state: {
      time: 0,
      cooldowns: new Map(),
      profession: {
        core: { activePet: "Tiger", activePetSlot: 1, petAutoGeneration: 0 },
      },
    },
  });

  assert.deepEqual(
    {
      power: metadata.summonBasePower,
      precision: metadata.summonBasePrecision,
      toughness: metadata.summonBaseToughness,
      vitality: metadata.summonBaseVitality,
      ferocity: metadata.summonBaseFerocity,
      conditionDamage: metadata.summonBaseConditionDamage,
    },
    {
      power: 1824,
      precision: 2511,
      toughness: 1824,
      vitality: 2511,
      ferocity: 180,
      conditionDamage: 1300,
    },
  );

  const result = simulate(
    "Core",
    ["__combat_start", { type: "wait", durationMs: 30000 }],
    { selectedPet: "Tiger", target: { health: 10000000 } },
  );
  const biteTimes = result.resolvedEvents
    .filter(
      (event) => event.type === "damage" && event.skillId === ID.FELINE_BITE,
    )
    .map((event) => event.at);
  assert.equal(biteTimes.length, 4);
  assert.equal(
    biteTimes.slice(1).every((at, index) => at - biteTimes[index] >= 8),
    true,
  );
});

test("Ranger autonomous pet cooldowns use only pet Alacrity", () => {
  const config = {
    selectedPet: "Carrion Devourer",
    boons: { alacrity: true },
    stats: { concentration: 1500 },
  };
  const baseline = simulate(
    "Core",
    ["__combat_start", { type: "wait", durationMs: 24000 }],
    config,
  );
  const petAlacrity = simulate(
    "Core",
    [
      '"We Heal As One!"',
      "__combat_start",
      { type: "wait", durationMs: 24000 },
    ],
    config,
  );
  const tailLashes = (result) =>
    result.events.filter(
      (event) =>
        event.type === "action" &&
        event.skillId === ID.PET_TAIL_LASH &&
        event.autonomousPetSkill,
    ).length;

  assert.equal(tailLashes(baseline), 1);
  assert.equal(tailLashes(petAlacrity), 2);
});

test("Galeshot passive arrow recharge uses the player's Alacrity", () => {
  const rotation = [{ type: "wait", durationMs: 4000 }];
  const baseline = simulate("Galeshot", rotation, {
    initialArrows: 0,
    boons: { alacrity: false },
  });
  const alacrity = simulate("Galeshot", rotation, {
    initialArrows: 0,
    boons: { alacrity: true },
  });

  assert.equal(baseline.endState.profession.arrows, 0);
  assert.equal(alacrity.endState.profession.arrows, 1);
});

test("Ranger palette groups the active pet, command, swap, and Dodge endurance", () => {
  const build = createRangerBuildDefaults();
  build.specializations = [];
  build.selectedPet = "Carrion Devourer";
  build.selectedPet2 = "Fanged Iboga";
  build.weapons = ["Longbow", ""];
  build.alternateWeapons = ["Axe", "Axe"];
  const app = {
    build,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skills: rangerCatalog.skills,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    results: simulate("Core", [], {
      selectedPet: "Carrion Devourer",
      selectedPet2: "Fanged Iboga",
      primaryWeapon: "Longbow",
      weaponSet2Primary: "Axe",
      weaponSet2Secondary: "Axe",
    }),
  };
  const paletteElement = {
    innerHTML: "",
    querySelectorAll: () => [],
  };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === "rotation-palette" ? paletteElement : null),
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const html = paletteElement.innerHTML;
  assert.equal((html.match(/data-skill-id="-4"/g) || []).length, 1);
  assert.ok(html.indexOf("Carrion Devourer") < html.indexOf("Poisonous Cloud"));
  assert.ok(
    html.indexOf("Poisonous Cloud") < html.indexOf('data-skill="Swap Pets"'),
  );
  assert.match(html, /class="[^"]*pal-has-resource[^"]*" data-skill="Dodge"/);
  assert.match(html, /data-resource-id="endurance"/);
  assert.doesNotMatch(
    html,
    /class="active-resource" data-resource-id="endurance"/,
  );
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
  const naturalConvergenceDuration =
    rangerCatalog.skillsById.get(ID.NATURAL_CONVERGENCE).castTimeMs / 1000;
  assert.deepEqual(result.warnings, []);
  assert.ok(
    Math.abs(
      result.endState.profession.astralForce -
        100 * ((15 - naturalConvergenceDuration) / 15) * 0.5,
    ) < 0.01,
  );
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
  const alreadyMerged = simulate("Soulbeast", ["Beastmode"]);
  assert.match(alreadyMerged.warnings[0], /already active/);

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
  assert.equal(leftBeastmode.endState.profession.beastmodeActive, false);
});

test("Soulbeast palette swaps between merged skills and the active pet", () => {
  const merged = simulate("Soulbeast", [], { selectedPet: "Smokescale" });
  const unmerged = simulate("Soulbeast", ["Leave Beastmode"], {
    selectedPet: "Smokescale",
  });
  const context = (professionState) => ({
    specialization: "Soulbeast",
    config: { specialization: "Soulbeast", selectedPet: "Smokescale" },
    professionState,
  });
  const availability = (professionState, skillId) =>
    rangerProfession.ui.paletteSkillAvailability(
      context(professionState),
      rangerCatalog.skillsById.get(skillId),
    ).available;

  const mergedGroups = rangerProfession.ui.paletteGroups(
    context(merged.endState.profession),
  );
  assert.deepEqual(
    mergedGroups.map((group) => group.id),
    ["ranger-soulbeast-profession"],
  );
  assert.deepEqual(mergedGroups[0].skillIds, [
    ID.LEAVE_BEASTMODE,
    ...RANGER_PETS.find((pet) => pet.name === "Smokescale").beastmodeSkillIds,
  ]);
  assert.equal(availability(merged.endState.profession, ID.BEASTMODE), false);
  assert.equal(
    availability(merged.endState.profession, ID.LEAVE_BEASTMODE),
    true,
  );

  const unmergedGroups = rangerProfession.ui.paletteGroups(
    context(unmerged.endState.profession),
  );
  assert.deepEqual(
    unmergedGroups.map((group) => group.id),
    ["ranger-soulbeast-profession", "ranger-pet"],
  );
  assert.deepEqual(unmergedGroups[0].skillIds, [ID.BEASTMODE]);
  assert.deepEqual(unmergedGroups[1].skillIds, [ID.SMOKE_CLOUD, ID.PET_SWAP]);
  assert.equal(unmergedGroups[1].statusIcon.label, "Smokescale");
  assert.equal(availability(unmerged.endState.profession, ID.BEASTMODE), true);
  assert.equal(
    availability(unmerged.endState.profession, ID.LEAVE_BEASTMODE),
    false,
  );

  const actionApp = {
    skills: [...rangerCatalog.skills],
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    build: { ...createRangerBuildDefaults(), rotation: [] },
    results: { endState: { profession: merged.endState.profession } },
  };
  assert.equal(
    paletteActionSkills(actionApp, "Soulbeast").some(
      (skill) => skill.id === ID.PET_SWAP,
    ),
    false,
  );
  actionApp.results.endState.profession = unmerged.endState.profession;
  assert.equal(
    paletteActionSkills(actionApp, "Soulbeast").some(
      (skill) => skill.id === ID.PET_SWAP,
    ),
    true,
  );
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

test("Ranger Hammer autoattacks advance their palette chain", () => {
  const config = {
    primaryWeapon: "Hammer",
    selectedHammerSkillIds: [
      ID.UNLEASHED_WILD_SWING,
      ID.OVERBEARING_SMASH,
      ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
      ID.UNLEASHED_THUMP,
    ],
  };
  const afterStrike = simulate("Soulbeast", ["Hammer Strike"], config);
  const afterSlam = simulate(
    "Soulbeast",
    ["Hammer Strike", "Hammer Slam"],
    config,
  );
  const afterSmash = simulate(
    "Soulbeast",
    ["Hammer Strike", "Hammer Slam", "Heavy Smash"],
    config,
  );

  assert.equal(
    afterStrike.endState.profession.autoattackChains[ID.HAMMER_STRIKE],
    ID.HAMMER_SLAM,
  );
  assert.equal(
    afterSlam.endState.profession.autoattackChains[ID.HAMMER_STRIKE],
    ID.HEAVY_SMASH,
  );
  assert.equal(
    afterSmash.endState.profession.autoattackChains[ID.HAMMER_STRIKE],
    undefined,
  );

  const build = {
    ...createRangerBuildDefaults(),
    weapons: ["Hammer", ""],
    selectedHammerSkillIds: config.selectedHammerSkillIds,
  };
  const app = {
    build,
    skills: [...rangerCatalog.skills],
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    results: afterStrike,
  };
  assert.equal(currentAutoattackSkill(app).id, ID.HAMMER_SLAM);
  app.results = afterSlam;
  assert.equal(currentAutoattackSkill(app).id, ID.HEAVY_SMASH);
  app.results = afterSmash;
  assert.equal(currentAutoattackSkill(app).id, ID.HAMMER_STRIKE);
});

test("Selected unleashed Hammer skills remain castable after Overbearing Smash", () => {
  const selectedHammerSkillIds = [
    ID.UNLEASHED_WILD_SWING,
    ID.OVERBEARING_SMASH,
    ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
    ID.UNLEASHED_THUMP,
  ];
  const result = simulate("Soulbeast", ["Overbearing Smash"], {
    primaryWeapon: "Hammer",
    selectedHammerSkillIds,
  });
  const build = {
    ...createRangerBuildDefaults(),
    weapons: ["Hammer", ""],
    selectedHammerSkillIds,
  };
  const app = {
    build,
    skills: [...rangerCatalog.skills],
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    results: result,
  };
  const availableIds = new Set(weaponSkills(app, 1).map((skill) => skill.id));

  for (const skillId of [
    ID.UNLEASHED_WILD_SWING,
    ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
    ID.UNLEASHED_THUMP,
  ]) {
    assert.equal(availableIds.has(skillId), true);
    assert.deepEqual(
      rangerProfession.ui.paletteSkillAvailability(
        {
          build,
          specialization: "Soulbeast",
          professionState: result.endState.profession,
          time: result.durationMs / 1000,
        },
        rangerCatalog.skillsById.get(skillId),
      ),
      { available: true, message: "" },
    );
  }

  const paletteElement = {
    innerHTML: "",
    querySelectorAll: () => [],
  };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === "rotation-palette" ? paletteElement : null),
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }
  for (const skillId of [
    ID.UNLEASHED_WILD_SWING,
    ID.UNLEASHED_SAVAGE_SHOCK_WAVE,
    ID.UNLEASHED_THUMP,
  ]) {
    const skill = rangerCatalog.skillsById.get(skillId);
    assert.equal(skill.paletteFlip, false);
    const markup = paletteElement.innerHTML.match(
      new RegExp(
        `<div class="([^"]*)" data-skill="${skill.name}"\\s+data-skill-id="${skill.id}"[^>]*>`,
      ),
    );
    assert.ok(markup, `${skill.name} should be rendered`);
    assert.doesNotMatch(markup[1], /pal-context-disabled/);
    assert.match(markup[0], /draggable="true"/);
  }
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

test("Untamed Unleash forms share a fixed one-second recharge", () => {
  const result = simulate("Untamed", ["Unleash Pet", "Unleash Ranger"], {
    initialUntamedState: "Ranger",
    boons: { alacrity: true },
  });
  const unleashSteps = result.steps.filter((step) =>
    ["Unleash Pet", "Unleash Ranger"].includes(step.skill),
  );
  const unleashActions = result.events.filter(
    (event) =>
      event.type === "action" &&
      [ID.UNLEASH_PET, ID.UNLEASH_RANGER].includes(event.skillId),
  );

  assert.deepEqual(
    unleashSteps.map(({ skill, start }) => ({ skill, start })),
    [
      { skill: "Unleash Pet", start: 0 },
      { skill: "Unleash Ranger", start: 1000 },
    ],
  );
  assert.deepEqual(
    unleashActions.map((event) => event.rechargeReadyAt - event.at),
    [1, 1],
  );
  assert.equal(result.endState.profession.ambushReadyUntil, 5);

  const suppressed = simulate(
    "Untamed",
    ["Unleash Pet", "Unleash Ranger", "Unleash Pet", "Unleash Ranger"],
    { initialUntamedState: "Ranger" },
  );
  assert.equal(suppressed.endState.profession.ambushReadyUntil, 5);

  const refreshed = simulate(
    "Untamed",
    [
      "Unleash Pet",
      "Unleash Ranger",
      "Unleash Pet",
      { type: "wait", durationMs: 8000 },
      "Unleash Ranger",
    ],
    { initialUntamedState: "Ranger" },
  );
  assert.equal(refreshed.endState.profession.ambushReadyUntil, 14);
});

test("Untamed ambush skills require the specialization and an active unleash proc", () => {
  const relentlessWhirl = rangerCatalog.skillsById.get(ID.RELENTLESS_WHIRL);

  for (const specialization of ["Core", "Druid", "Soulbeast", "Galeshot"]) {
    assert.equal(
      rangerAppAdapter.isSkillAvailable(relentlessWhirl, { specialization }),
      false,
      `${specialization} should not have Relentless Whirl`,
    );
  }
  assert.equal(
    rangerAppAdapter.isSkillAvailable(relentlessWhirl, {
      specialization: "Untamed",
    }),
    true,
  );

  const availability = (professionState, time = 0) =>
    rangerProfession.ui.paletteSkillAvailability(
      { specialization: "Untamed", professionState, time },
      relentlessWhirl,
    );

  assert.deepEqual(
    availability({ rangerUnleashed: false, ambushReadyUntil: 4 }),
    { available: false, message: "Unleash Ranger first" },
  );
  assert.deepEqual(availability({ rangerUnleashed: true }), {
    available: false,
    message: "Unleash to make an ambush available",
  });
  assert.deepEqual(
    availability({ rangerUnleashed: true, ambushReadyUntil: 4 }, 3.9),
    { available: true, message: "" },
  );
  assert.deepEqual(
    availability({ rangerUnleashed: true, ambushReadyUntil: 4 }, 4),
    {
      available: false,
      message: "Unleash to make an ambush available",
    },
  );

  assert.match(
    simulate("Untamed", ["Relentless Whirl"], {
      primaryWeapon: "Hammer",
    }).warnings[0],
    /Unleash Ranger first/,
  );
  assert.deepEqual(
    simulate("Untamed", ["Unleash Ranger", "Relentless Whirl"], {
      primaryWeapon: "Hammer",
    }).warnings,
    [],
  );
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
  const petGroups = rangerProfession.ui
    .skillBarGroups(soulbeastContext)
    .filter((group) => group.id.startsWith("ranger-pet-"));
  const [pet1Group, pet2Group] = petGroups;
  assert.deepEqual(
    petGroups.map((group) => group.label),
    ["Pet 1", "Pet 2"],
  );
  assert.deepEqual(
    petGroups.map((group) => group.className),
    ["ranger-pet ranger-pet-1", "ranger-pet ranger-pet-2"],
  );
  assert.equal(pet1Group.layout, "ranger-mechanics ranger-soulbeast-mechanics");
  assert.equal(pet2Group.layout, "ranger-mechanics ranger-soulbeast-mechanics");
  assert.equal(
    rangerProfession.ui
      .skillBarGroups(soulbeastContext)
      .find((group) => group.id === "ranger-soulbeast-f5").className,
    "ranger-soulbeast-beastmode",
  );
  assert.equal(pet1Group.selections[0].selectionValue, "Pig");
  assert.equal(pet2Group.selections[0].selectionValue, "Lynx");
  assert.deepEqual(
    petGroups.map((group) => group.selections[0].filterPlaceholder),
    ["Filter pets...", "Filter pets..."],
  );
  assert.deepEqual(pet1Group.selections[0].skillIds, [ID.FORAGE_SWORD]);
  assert.deepEqual(pet2Group.selections[0].skillIds, [ID.RENDING_POUNCE]);
  assert.equal(
    pet1Group.selections[0].optionEntries.length,
    RANGER_PETS.length,
  );
  assert.equal(
    rangerProfession.ui.updateSkillBarSelection(soulbeastContext, {
      key: "selectedPet",
      index: 0,
      value: "Smokescale",
    }),
    true,
  );
  assert.equal(
    rangerProfession.ui.updateSkillBarSelection(soulbeastContext, {
      key: "selectedPet2",
      index: 1,
      value: "Fanged Iboga",
    }),
    true,
  );
  assert.equal(build.selectedPet2, "Fanged Iboga");
  const smokescale = RANGER_PETS.find((pet) => pet.name === "Smokescale");
  const mergedPetGroups = rangerProfession.ui
    .skillBarGroups(soulbeastContext)
    .filter((group) => group.id.startsWith("ranger-pet-"));
  const fangedIboga = RANGER_PETS.find((pet) => pet.name === "Fanged Iboga");
  assert.deepEqual(
    mergedPetGroups.map((group) => group.skillIds),
    [[], []],
  );
  assert.deepEqual(
    mergedPetGroups[0].selections[0].leadingSkillIds,
    smokescale.beastmodeSkillIds,
  );
  assert.deepEqual(
    mergedPetGroups[1].selections[0].leadingSkillIds,
    fangedIboga.beastmodeSkillIds,
  );
  assert.deepEqual(mergedPetGroups[0].selections[0].skillIds, [ID.SMOKE_CLOUD]);
  assert.deepEqual(mergedPetGroups[1].selections[0].skillIds, [
    ID.NARCOTIC_SPORES_PET,
  ]);
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
    untamedGroups.find((group) => group.id === "ranger-pet-1-selection").layout,
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
  const expectedQuicknessCastTimes = new Map([
    ["Mistral", 320],
    ["Long Range Shot", 480],
    ["Rapid Fire", 1800],
    ["Hunter's Shot", 320],
    ["Point-Blank Shot", 360],
    ["Barrage", 1880],
    ["Keen Shot", 480],
    ["Hawkeye", 880],
    ["Bluster", 680],
    ["Fleeting Zephyr", 520],
    ["Quarry's Peril", 680],
    ["Pelt", 680],
    ["Supersonic Arrow", 1000],
    ["Piercing Gales", 640],
    ["Perfect Storm", 600],
  ]);
  for (const [name, castTimeMs] of expectedQuicknessCastTimes) {
    assert.equal(
      rangerCatalog.skillsByName.get(name).quicknessCastTimeMs,
      castTimeMs,
    );
    assert.equal(castTimeMs % 40, 0);
  }

  const blocked = simulate("Galeshot", ["Bluster"]);
  assert.match(blocked.warnings[0], /summon the Cyclone Bow/);

  const result = simulate(
    "Galeshot",
    [
      "Summon Cyclone Bow",
      "Bluster",
      "Fleeting Zephyr",
      "Pelt",
      "Supersonic Arrow",
      "Hawkeye",
    ],
    {
      selectedTraitIds: [TRAIT.PERILOUS_SKIES],
    },
  );
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
    "Supersonic Arrow",
  ]);
  const keenBlocked = simulate("Galeshot", [
    "Summon Cyclone Bow",
    "Bluster",
    "Fleeting Zephyr",
    "Quarry's Peril",
    "Supersonic Arrow",
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
  const untraitedBowGroup = rangerProfession.ui
    .skillBarGroups(inactiveContext)
    .find((group) => group.id === "ranger-cyclone-bow");
  const traitedBowGroup = rangerProfession.ui
    .skillBarGroups({
      ...inactiveContext,
      traits: new Set([TRAIT.PERILOUS_SKIES]),
    })
    .find((group) => group.id === "ranger-cyclone-bow");
  // Perilous Skies owns the preview replacement just as it owns the runtime
  // replacement, so Pelt is never displayed beside Quarry's Peril.
  assert.equal(untraitedBowGroup.className, "ranger-cyclone-bow-skills");
  assert.equal(untraitedBowGroup.skillIds.includes(ID.QUARRYS_PERIL), true);
  assert.equal(untraitedBowGroup.skillIds.includes(ID.PELT), false);
  assert.equal(traitedBowGroup.skillIds.includes(ID.QUARRYS_PERIL), false);
  assert.equal(traitedBowGroup.skillIds.includes(ID.PELT), true);
  assert.deepEqual(
    skillBarInspectionStacks(
      untraitedBowGroup.skillIds.map((skillId) =>
        rangerCatalog.skillsById.get(skillId),
      ),
      untraitedBowGroup.inspectionChainRoots,
    ).map(({ root, children }) => [root.id, children.map((skill) => skill.id)]),
    [
      [ID.KEEN_SHOT, [ID.HAWKEYE]],
      [ID.BLUSTER, []],
      [ID.FLEETING_ZEPHYR, []],
      [ID.QUARRYS_PERIL, []],
      [ID.SUPERSONIC_ARROW, []],
    ],
  );
  const galeshotPaletteGroups =
    rangerProfession.ui.paletteGroups(inactiveContext);
  assert.deepEqual(
    galeshotPaletteGroups.map((group) => group.id),
    ["ranger-pet", "ranger-galeshot-profession", "ranger-cyclone-bow"],
  );
  assert.equal(
    galeshotPaletteGroups.every((group) => group.stackId === "ranger-galeshot"),
    true,
  );
  const galeshotF5Group = galeshotPaletteGroups.find(
    (group) => group.id === "ranger-galeshot-profession",
  );
  assert.equal(galeshotF5Group.className, "ranger-galeshot-f5");
  assert.deepEqual(galeshotF5Group.resourceIds, ["arrows"]);
  assert.equal(galeshotF5Group.resourcePlacement, "beside");
  const cycloneBowGroup = galeshotPaletteGroups.find(
    (group) => group.id === "ranger-cyclone-bow",
  );
  assert.equal(cycloneBowGroup.className, "ranger-cyclone-bow-skills");
  assert.deepEqual(cycloneBowGroup.resourceIds, ["wind-force"]);
  assert.equal(cycloneBowGroup.resourcePlacement, "above");
  const galeshotResources = rangerProfession.ui.resourceViews(inactiveContext);
  assert.equal(
    galeshotResources.find((view) => view.id === "wind-force").pipStyle,
    "ranger-wind-force",
  );
  assert.equal(
    galeshotResources
      .filter((view) => ["arrows", "wind-force"].includes(view.id))
      .every((view) => view.showValue === false),
    true,
  );
  const galeshotBuild = createRangerBuildDefaults();
  galeshotBuild.specializations[2] = {
    name: "Galeshot",
    traits: "3-3-2",
  };
  const galeshotApp = {
    build: galeshotBuild,
    adapter: rangerAppAdapter,
    profession: rangerProfession,
    skills: rangerCatalog.skills,
    skillById: rangerCatalog.skillsById,
    skillByName: rangerCatalog.skillsByName,
    results: charged,
  };
  const paletteElement = { innerHTML: "", querySelectorAll: () => [] };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === "rotation-palette" ? paletteElement : null),
  };
  try {
    renderPalette(galeshotApp);
  } finally {
    globalThis.document = previousDocument;
  }
  assert.match(
    paletteElement.innerHTML,
    /profession-palette-resource-group resource-beside[\s\S]*ranger-galeshot-f5[\s\S]*data-resource-id="arrows"/,
  );
  assert.match(
    paletteElement.innerHTML,
    /profession-palette-resource-group resource-above[\s\S]*data-resource-id="wind-force"[\s\S]*ranger-cyclone-bow-skills/,
  );
  assert.doesNotMatch(paletteElement.innerHTML, />\d+\/(?:8|5)<\/strong>/);
  assert.doesNotMatch(
    paletteElement.innerHTML,
    /title="[^"]*(?:arrows|Wind Force): \d+\/(?:8|5)"/,
  );
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

  const hawkeyeHits = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillId === ID.HAWKEYE,
  );
  assert.equal(hawkeyeHits.length, 5);
  assert.ok(
    Math.abs(
      hawkeyeHits.reduce((sum, event) => sum + event.coefficient, 0) - 6.8,
    ) < 1e-9,
  );

  const shrike = simulate(
    "Galeshot",
    ["Mistral", "Rapid Fire", "Long Range Shot", "Long Range Shot"],
    {
      primaryWeapon: "Longbow",
      selectedTraitIds: [TRAIT.SHRIKE],
    },
  );
  assert.deepEqual(shrike.warnings, []);
  assert.equal(
    shrike.resolvedEvents.filter(
      (event) => event.type === "damage" && event.skillId === ID.MISTRAL,
    ).length,
    12,
  );
  assert.equal(
    shrike.resolvedEvents.filter(
      (event) => event.type === "damage" && event.sourceId === TRAIT.SHRIKE,
    ).length,
    3,
  );

  const barrage = simulate("Galeshot", ["Mistral", "Barrage"], {
    primaryWeapon: "Longbow",
  });
  assert.equal(
    barrage.resolvedEvents.some(
      (event) => event.type === "damage" && event.skillId === ID.MISTRAL,
    ),
    false,
  );
});

test("Cyclone Bow strikes use its normalized weapon strength", () => {
  for (const primaryWeapon of ["Axe", "Longbow", "Hammer"]) {
    const result = simulate("Galeshot", ["Summon Cyclone Bow", "Keen Shot"], {
      primaryWeapon,
    });
    const hit = result.resolvedEvents.find(
      (event) => event.type === "damage" && event.skillId === ID.KEEN_SHOT,
    );

    assert.equal(hit.weaponStrengthProfileId, "transform.cyclone-bow");
    assert.equal(hit.resolvedWeaponStrength, 1015);
  }
});

test("Quarry's Peril commits at 320 ms and deals damage at 800 ms", () => {
  const rotation = (interruptAfterMs) => [
    "Summon Cyclone Bow",
    {
      name: "Quarry's Peril",
      ...(interruptAfterMs == null ? {} : { interruptAfterMs }),
    },
    "Fleeting Zephyr",
    { type: "wait", durationMs: 1000 },
  ];
  const config = { boons: { quickness: true } };
  const beforeCommit = simulate("Galeshot", rotation(319), config);
  const committed = simulate("Galeshot", rotation(320), config);
  const fullCast = simulate("Galeshot", rotation(), config);
  const quarryStep = (result) =>
    result.steps.find((step) => step.skill === "Quarry's Peril");
  const quarryDamage = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.skillId === ID.QUARRYS_PERIL,
    );
  const quarryAction = (result) =>
    result.events.find(
      (event) => event.type === "action" && event.skillId === ID.QUARRYS_PERIL,
    );
  const fleetingStep = (result) =>
    result.steps.find((step) => step.skill === "Fleeting Zephyr");

  assert.equal(
    rangerCatalog.skillsById.get(ID.QUARRYS_PERIL).paletteInterruptMs,
    320,
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.QUARRYS_PERIL).interruptCommitMs,
    320,
  );
  assert.equal(
    rangerCatalog.skillsById.get(ID.QUARRYS_PERIL)
      .retainsCastLockoutAfterInterrupt,
    true,
  );
  assert.equal(quarryStep(fullCast).fullCastMs, 680);
  assert.equal(quarryStep(fullCast).end - quarryStep(fullCast).start, 680);
  assert.equal(quarryStep(committed).end - quarryStep(committed).start, 320);
  assert.equal(
    fleetingStep(committed).start - quarryStep(committed).start,
    680,
  );
  assert.equal(
    Math.round(
      (quarryAction(committed).rechargeReadyAt - quarryAction(committed).at) *
        1000,
    ),
    12320,
  );
  assert.equal(
    Math.round(
      (quarryAction(fullCast).rechargeReadyAt - quarryAction(fullCast).at) *
        1000,
    ),
    12680,
  );
  assert.equal(quarryDamage(beforeCommit), undefined);
  assert.equal(
    Math.round(quarryDamage(committed).at * 1000) - quarryStep(committed).start,
    800,
  );
  assert.equal(
    Math.round(quarryDamage(fullCast).at * 1000) - quarryStep(fullCast).start,
    800,
  );
});

test("Cyclone Bow transitions trigger swap sigils and dedicated weapon lines", () => {
  const result = simulate(
    "Galeshot",
    [
      "__combat_start",
      "Summon Cyclone Bow",
      { type: "wait", durationMs: 10000 },
      "Dismiss Cyclone Bow",
    ],
    {
      sigilSets: [
        { names: ["Hydromancy"], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.procSteps
      .filter((step) => step.skill === "Sigil of Hydromancy")
      .map((step) => step.sourceSkill),
    ["Summon Cyclone Bow", "Dismiss Cyclone Bow"],
  );

  const transition = rangerProfession.ui.timelineWeaponLineTransition;
  const rotation = [
    "Long Range Shot",
    "Summon Cyclone Bow",
    "Keen Shot",
    "Dismiss Cyclone Bow",
    "Long Range Shot",
  ];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponLineTransition(entry, current) {
      const name = typeof entry === "string" ? entry : entry.name;
      return transition({
        entry: { name },
        skill: rangerCatalog.skillsByName.get(name),
        specialization: "Galeshot",
        ...current,
      });
    },
  });
  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, "Cyclone Bow", null],
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]],
  );
});

test("Ranger trait rules affect their owned damage and attributes", () => {
  assert.equal(RANGER_TRAIT_COVERAGE.length, 108);
  assert.equal(
    RANGER_TRAIT_COVERAGE.filter((entry) => entry.status === "implemented")
      .length,
    66,
  );

  const coreOperations = new Map(
    rangerCoreModifierRules.map((rule) => [rule.id, rule.operation]),
  );
  const soulbeastOperations = new Map(
    soulbeastModifierRules.map((rule) => [rule.id, rule.operation]),
  );
  for (const id of [
    "ranger.remorseless",
    "ranger.predators-onslaught-player",
    "ranger.predators-onslaught-pet",
    "ranger.wolfsong",
    "ranger.farsighted",
    "ranger.hunters-tactics-damage",
    "ranger.light-on-your-feet",
    "ranger.bountiful-hunter-player",
    "ranger.bountiful-hunter-pet",
    "ranger.loud-whistle-player",
  ]) {
    assert.equal(coreOperations.get(id), "multiply", id);
  }
  for (const id of ["ranger.sic-em-player", "ranger.oppressive-superiority"]) {
    assert.equal(soulbeastOperations.get(id), "multiply", id);
  }
  for (const id of [
    "ranger.furious-strength",
    "ranger.twice-as-vicious-strike",
    "ranger.twice-as-vicious-condition",
  ]) {
    assert.equal(soulbeastOperations.get(id), "damage-additive", id);
  }
  const baseline = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
  });
  const farsighted = simulate("Core", ["Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.FARSIGHTED],
  });
  assert.equal(farsighted.totalDamage > baseline.totalDamage, true);

  const dodgeBaseline = simulate("Core", ["Dodge", "Rapid Fire"], {
    primaryWeapon: "Longbow",
  });
  const lightOnYourFeet = simulate("Core", ["Dodge", "Rapid Fire"], {
    primaryWeapon: "Longbow",
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET],
  });
  assert.ok(
    Math.abs(lightOnYourFeet.totalDamage / dodgeBaseline.totalDamage - 1.1) <
      1e-9,
  );

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
  assert.ok(
    Math.abs(bountiful.totalDamage / boonBaseline.totalDamage - 1.03) < 1e-9,
  );

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
  assert.ok(
    Math.abs(survival.totalDamage / baseline.totalDamage - 1.15) < 1e-9,
  );
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
    Math.abs(
      strongerPoison.conditionDamage / poisonBaseline.conditionDamage - 1.25,
    ) < 1e-9,
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

test("Ranger Nature Magic traits grant support and scale with boons", () => {
  const healing = simulate(
    "Core",
    ["Troll Unguent", "Hunter's Call", { type: "wait", durationMs: 10000 }],
    {
      primaryWeapon: "Axe",
      secondaryWeapon: "Warhorn",
      selectedTraitIds: [
        TRAIT.WELLSPRING,
        TRAIT.CHILD_OF_EARTH,
        TRAIT.WINDBORNE_NOTES,
        TRAIT.LINGERING_MAGIC,
      ],
    },
  );
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
        event.sourceId === TRAIT.CHILD_OF_EARTH && event.condition === "Slow",
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

  const petBoonBaseline = simulate(
    "Core",
    ["Call of the Wild", "Intimidating Howl"],
    {
      primaryWeapon: "Axe",
      secondaryWeapon: "Warhorn",
      selectedPet: "Krytan Drakehound",
    },
  );
  const petBountiful = simulate(
    "Core",
    ["Call of the Wild", "Intimidating Howl"],
    {
      primaryWeapon: "Axe",
      secondaryWeapon: "Warhorn",
      selectedPet: "Krytan Drakehound",
      selectedTraitIds: [TRAIT.BOUNTIFUL_HUNTER],
    },
  );
  const petHit = (result) =>
    result.resolvedEvents.find(
      (event) => event.skillId === ID.INTIMIDATING_HOWL,
    ).damage;
  assert.ok(
    Math.abs(petHit(petBountiful) / petHit(petBoonBaseline) - 1.03) < 1e-9,
    JSON.stringify({
      baseline: petHit(petBoonBaseline),
      bountiful: petHit(petBountiful),
      ratio: petHit(petBountiful) / petHit(petBoonBaseline),
    }),
  );
});

test("Ranger pet-swap and Marksmanship traits resolve at their combat timings", () => {
  const swapped = simulate("Core", ["__combat_start", "Swap Pets"], {
    selectedPet: "Carrion Devourer",
    selectedPet2: "Fanged Iboga",
    selectedTraitIds: [TRAIT.SPIRITED_ARRIVAL, TRAIT.CLARION_BOND],
  });
  assert.deepEqual(swapped.warnings, []);
  assert.equal(swapped.endState.profession.petSwapCount, 1);
  assert.equal(swapped.endState.profession.activePetSlot, 2);
  assert.equal(swapped.endState.profession.activePet, "Fanged Iboga");
  assert.deepEqual(swapped.endState.profession.petNames, [
    "Carrion Devourer",
    "Fanged Iboga",
  ]);
  assert.equal(
    swapped.endState.profession.activePetSkillIds.includes(ID.CONSUMING_BITE),
    true,
  );
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
    swapped.resolvedEvents.some(
      (event) =>
        event.sourceId === TRAIT.CLARION_BOND && event.type === "combo",
    ),
    false,
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
        event.sourceId === TRAIT.ALPHA_FOCUS && event.condition === "Crippled",
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
    ["__combat_start", { type: "wait", durationMs: 4000 }],
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

  const familyAttackDoesNotArmPoisonMaster = simulate(
    "Core",
    ["__combat_start", "Spit", { type: "wait", durationMs: 4000 }],
    {
      selectedPet: "Forest Spider",
      selectedTraitIds: [TRAIT.POISON_MASTER],
    },
  );
  assert.equal(
    familyAttackDoesNotArmPoisonMaster.resolvedEvents.some(
      (event) => event.sourceId === TRAIT.POISON_MASTER,
    ),
    false,
  );
  const armedSpider = simulate(
    "Core",
    [
      "__combat_start",
      "Deadly Venom",
      "Spit",
      { type: "wait", durationMs: 8000 },
    ],
    {
      selectedPet: "Forest Spider",
      selectedTraitIds: [TRAIT.POISON_MASTER],
    },
  );
  assert.equal(
    armedSpider.resolvedEvents.some(
      (event) =>
        event.sourceId === TRAIT.POISON_MASTER &&
        event.condition === "Poisoned" &&
        event.stacks === 2,
    ),
    true,
  );

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
    (attributes.Power.base +
      attributes.Power.gear +
      attributes.Power.runes +
      attributes.Power.food +
      attributes.Power.infusions +
      attributes.Power.jbc) *
      0.07,
  );

  const petTraitContext = {
    config: { selectedPet: "Forest Spider", stats: { power: 2000 } },
    traits: new Set([
      TRAIT.ARACHNOPHOBIA,
      TRAIT.LINGERING_MAGIC,
      TRAIT.WELLSPRING,
    ]),
    event: {
      actorType: "summon",
      source: "ranger-pet",
      summonBasePower: 1500,
    },
    time: 0,
    runtime: { activeWeaponSet: 1 },
    query: { mightStacksAt: () => 0 },
  };
  const petAttributes = rangerCoreAttributeRules.modifyAttributes(
    petTraitContext,
    {
      power: 2000,
      precision: 1000,
      toughness: 1000,
      vitality: 1000,
      ferocity: 0,
      conditionDamage: 1000,
      expertise: 0,
      concentration: 0,
      healingPower: 0,
    },
  );
  assert.equal(petAttributes.expertise, 375);
  assert.equal(petAttributes.concentration, 240);
  assert.ok(Math.abs(petAttributes.healingPower - 105) < 1e-9);
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
