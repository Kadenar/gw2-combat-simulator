import assert from "node:assert/strict";
import test from "node:test";

import { getProfession } from "../js/app/composition.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "../js/professions/guardian/build.js";
import {
  guardianCatalog,
  GUARDIAN_SKILL_IDS,
} from "../js/professions/guardian/catalog.js";
import {
  DATA_SNAPSHOT,
} from "../js/professions/guardian/data/guardian-catalog.js";
import {
  guardianProfession,
} from "../js/professions/guardian/definition.js";
import { GUARDIAN_TRAIT_IDS } from "../js/professions/guardian/ids.js";

const config = {
  stats: {
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000,
  },
  target: { armor: 2597 },
};

test("Guardian uses a current API catalog with real skills and trait lines", () => {
  assert.match(DATA_SNAPSHOT, /^2026-/);
  assert.equal(guardianCatalog.specializations.length, 9);
  assert.equal(guardianCatalog.traits.length, 108);
  assert.ok(guardianCatalog.skills.length >= 190);
  assert.equal(
    guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.TRUE_STRIKE).name,
    "True Strike",
  );
  assert.equal(
    guardianCatalog.skillsByName.get("Virtue of Justice").id,
    9115,
  );
  assert.equal(
    guardianCatalog.specializations.some(spec => spec.name === "Luminary"),
    true,
  );
});

test("Justice active burning resolves through simulateGw2", () => {
  const withoutJustice = simulateGw2({
    profession: guardianProfession,
    rotation: ["True Strike"],
    config,
  });
  const withJustice = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Virtue of Justice",
      "True Strike",
      { type: "wait", durationMs: 2000 },
    ],
    config,
  });

  assert.equal(withoutJustice.conditionDamage, 0);
  assert.ok(withJustice.conditionDamage > 0);
  assert.equal(withJustice.endState.profession.justiceBurns, 1);
  assert.equal(withJustice.endState.profession.justiceActiveBurns, 1);
  assert.equal(withJustice.endState.profession.justiceArmed, false);
});

test("Justice passive counts individual hits and respects its active cooldown", () => {
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ["Whirling Wrath"],
    config: { ...config, primaryWeapon: "Greatsword" },
  });
  const activated = simulateGw2({
    profession: guardianProfession,
    rotation: ["Virtue of Justice", "Whirling Wrath"],
    config: { ...config, primaryWeapon: "Greatsword" },
  });
  const permeating = simulateGw2({
    profession: guardianProfession,
    rotation: ["Whirling Wrath"],
    config: {
      ...config,
      primaryWeapon: "Greatsword",
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH],
    },
  });

  assert.equal(passive.endState.profession.justicePassiveBurns, 1);
  assert.equal(passive.endState.profession.justiceHitCount, 3);
  assert.equal(activated.endState.profession.justiceActiveBurns, 1);
  assert.equal(activated.endState.profession.justicePassiveBurns, 0);
  assert.equal(activated.endState.profession.virtueReadyAt.justice, 20);
  assert.equal(permeating.endState.profession.justicePassiveBurns, 2);
  assert.equal(permeating.endState.profession.justiceHitCount, 2);
});

test("Guardian swaps weapons and exposes profession palette groups", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ["Swap Weapons"],
    config,
  });
  assert.equal(result.endState.activeWeaponSet, 2);
  assert.deepEqual(guardianProfession.ui.resourceViews({}), []);
  assert.deepEqual(
    guardianProfession.ui.paletteGroups({})[0].skillIds,
    [
      GUARDIAN_SKILL_IDS.JUSTICE,
      GUARDIAN_SKILL_IDS.RESOLVE,
      GUARDIAN_SKILL_IDS.COURAGE,
    ],
  );
});

test("Guardian only casts weapon skills equipped on the active set", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Through the Heart",
      "Swap Weapons",
      "Through the Heart",
    ],
    config: {
      ...config,
      primaryWeapon: "Sword",
      secondaryWeapon: "Focus",
      weaponSet2Primary: "Pistol",
      weaponSet2Secondary: "Torch",
    },
  });

  assert.equal(
    result.resolvedEvents.filter(event =>
      event.skillName === "Through the Heart"
      && event.type === "damage").length,
    1,
  );
  assert.match(result.warnings.join(" "), /Through the Heart is unavailable/);
});

test("Guardian player strikes trigger shared player-owned sigils", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ["True Strike"],
    config: {
      ...config,
      stats: {
        ...config.stats,
        precision: 3100,
      },
      boons: { fury: true },
      sigilSets: [
        { names: ["Air"], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  });

  assert.equal(
    result.resolvedEvents.find(event => event.skillName === "True Strike")
      .actorType,
    "player",
  );
  assert.equal(
    result.procSteps.some(step => step.skill === "Sigil of Air"),
    true,
  );
});

test("Guardian timing applies Quickness, Alacrity, ammo, and trait recharge", () => {
  const quick = simulateGw2({
    profession: guardianProfession,
    rotation: ["True Strike"],
    config: { ...config, boons: { quickness: true } },
  });
  const alacrity = simulateGw2({
    profession: guardianProfession,
    rotation: ["Virtue of Justice"],
    config: { ...config, boons: { alacrity: true } },
  });
  const virtuous = simulateGw2({
    profession: guardianProfession,
    rotation: ["Virtue of Justice"],
    config: {
      ...config,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS],
    },
  });
  const ammo = simulateGw2({
    profession: guardianProfession,
    rotation: ["Hail of Justice", "Hail of Justice", "Hail of Justice"],
    config: { ...config, primaryWeapon: "Pistol" },
  });

  assert.equal(quick.endState.time, 333);
  assert.equal(
    alacrity.endState.cooldowns["Virtue of Justice"].readyAt,
    16000,
  );
  assert.equal(
    virtuous.endState.cooldowns["Virtue of Justice"].readyAt,
    17000,
  );
  assert.equal(ammo.endState.ammo["Hail of Justice"].charges, 0);
  assert.match(ammo.warnings.join(" "), /on cooldown/);
});

test("Guardian symbols and persistent attacks resolve after their casts", () => {
  const symbol = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Symbol of Resolution",
      { type: "wait", durationMs: 4000 },
    ],
    config: { ...config, primaryWeapon: "Greatsword" },
  });
  const procession = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Procession of Blades",
      { type: "wait", durationMs: 5000 },
    ],
    config: {
      ...config,
      specialization: "Dragonhunter",
    },
  });

  assert.equal(
    symbol.resolvedEvents.filter(event =>
      event.type === "damage"
      && event.skillName === "Symbol of Resolution").length,
    5,
  );
  assert.equal(
    procession.resolvedEvents.filter(event =>
      event.type === "damage"
      && event.skillName === "Procession of Blades").length,
    10,
  );
});

test("Guardian autoattack chains and torch flips enforce sequence state", () => {
  const invalidChain = simulateGw2({
    profession: guardianProfession,
    rotation: ["True Strike", "Faithful Strike"],
    config: { ...config, primaryWeapon: "Mace" },
  });
  const chain = simulateGw2({
    profession: guardianProfession,
    rotation: ["True Strike", "Pure Strike", "Faithful Strike"],
    config: { ...config, primaryWeapon: "Mace" },
  });
  const invalidFlip = simulateGw2({
    profession: guardianProfession,
    rotation: ["Zealot's Fire"],
    config: {
      ...config,
      primaryWeapon: "Sword",
      secondaryWeapon: "Torch",
    },
  });
  const flip = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Zealot's Flame",
      "Zealot's Fire",
      { type: "wait", durationMs: 3000 },
    ],
    config: {
      ...config,
      primaryWeapon: "Sword",
      secondaryWeapon: "Torch",
    },
  });

  assert.match(invalidChain.warnings.join(" "), /Faithful Strike is unavailable/);
  assert.equal(
    chain.resolvedEvents.filter(event => event.type === "damage").length,
    3,
  );
  assert.match(invalidFlip.warnings.join(" "), /Zealot's Fire is unavailable/);
  assert.ok(flip.strikeDamage > 0);
  assert.ok(flip.conditionDamage > 0);
});

test("Guardian damage traits use resolver-time target state", () => {
  const baseline = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Zealot's Flame",
      "True Strike",
      { type: "wait", durationMs: 3000 },
    ],
    config: {
      ...config,
      primaryWeapon: "Mace",
      secondaryWeapon: "Torch",
    },
  });
  const traited = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Zealot's Flame",
      "True Strike",
      { type: "wait", durationMs: 3000 },
    ],
    config: {
      ...config,
      primaryWeapon: "Mace",
      secondaryWeapon: "Torch",
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.FIERY_WRATH,
        GUARDIAN_TRAIT_IDS.RADIANT_POWER,
        GUARDIAN_TRAIT_IDS.RADIANT_FIRE,
        GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH,
      ],
    },
  });

  assert.ok(traited.strikeDamage > baseline.strikeDamage);
  assert.ok(traited.conditionDamage > baseline.conditionDamage);
});

test("Renewed Focus recharges all three core virtues", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Virtue of Justice",
      "Virtue of Resolve",
      "Virtue of Courage",
      "Renewed Focus",
    ],
    config,
  });

  assert.equal(
    Object.hasOwn(result.endState.cooldowns, "Virtue of Justice"),
    false,
  );
  assert.equal(
    Object.hasOwn(result.endState.cooldowns, "Virtue of Resolve"),
    false,
  );
  assert.equal(
    Object.hasOwn(result.endState.cooldowns, "Virtue of Courage"),
    false,
  );
  assert.deepEqual(result.endState.profession.virtueReadyAt, {
    justice: 2,
    resolve: 2,
    courage: 2,
  });
});

test("every catalog skill has executable mechanics", () => {
  assert.equal(
    guardianCatalog.skills.every(skill => skill.implemented === true),
    true,
  );
  assert.equal(
    guardianCatalog.skillsByName.has("Chapter 1: Searing Spell"),
    true,
  );
  assert.equal(
    guardianCatalog.skillsByName.has("Dazzling Hammer"),
    true,
  );

  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ["Hammer Swing"],
    config: { ...config, primaryWeapon: "Hammer" },
  });
  assert.ok(result.totalDamage > 0);
  assert.deepEqual(result.warnings, []);
});

test("API mode aliases are not exposed as parent-child skill flips", () => {
  for (const name of ["Sword of Justice", "\"Feel My Wrath!\""]) {
    const variants = guardianCatalog.skills.filter(skill =>
      skill.name === name);
    assert.equal(variants.length, 2);
    assert.equal(
      variants.every(skill => skill.flipParentId == null),
      true,
    );
  }
});

test("non-DPS Guardian slot skills are excluded from the simulator surface", () => {
  const excludedNames = [
    "\"Advance!\"",
    "\"Save Yourselves!\"",
    "\"Hold the Line!\"",
    "Signet of Mercy",
    "Merciful Intervention",
    "Wall of Reflection",
    "Contemplation of Purity",
    "\"Stand Your Ground!\"",
    "Valorous Stance",
    "Stalwart Stance",
    "Mantra of Lore",
    "Hallowed Ground",
  ];
  for (const name of excludedNames) {
    assert.equal(
      guardianCatalog.skillsByName.get(name)?.simulatorExcluded,
      true,
      name,
    );
  }

  const migrated = migrateGuardianBuild({
    ...createGuardianBuildDefaults(),
    selectedSkills: {
      ...createGuardianBuildDefaults().selectedSkills,
      Utility1: "Contemplation of Purity",
    },
  });
  assert.notEqual(
    migrated.selectedSkills.Utility1,
    "Contemplation of Purity",
  );
});

test("Guardian results expose cast timestamps and cooldown-invalid steps", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "True Strike",
      { type: "wait", durationMs: 1000 },
      "Pure Strike",
      "Virtue of Justice",
      "Virtue of Justice",
    ],
    config: { ...config, primaryWeapon: "Mace" },
  });

  assert.deepEqual(
    result.steps.map(step => ({
      ri: step.ri,
      skill: step.skill,
      start: step.start,
      end: step.end,
      invalid: Boolean(step.invalid),
    })),
    [
      { ri: 0, skill: "True Strike", start: 0, end: 500, invalid: false },
      { ri: 1, skill: "Wait", start: 500, end: 1500, invalid: false },
      { ri: 2, skill: "Pure Strike", start: 1500, end: 2000, invalid: false },
      {
        ri: 3,
        skill: "Virtue of Justice",
        start: 2000,
        end: 2000,
        invalid: false,
      },
      {
        ri: 4,
        skill: "Virtue of Justice",
        start: 2000,
        end: 2000,
        invalid: true,
      },
    ],
  );
  assert.equal(
    result.endState.cooldowns["Virtue of Justice"].readyAt,
    22000,
  );
  assert.match(result.steps[4].invalidReason, /on cooldown/);
});

test("Firebrand tomes consume shared pages and execute tome damage", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Tome of Justice",
      "Chapter 1: Searing Spell",
      "Chapter 4: Scorched Aftermath",
      "Epilogue: Ashes of the Just",
      "True Strike",
      { type: "wait", durationMs: 6000 },
    ],
    config: {
      ...config,
      specialization: "Firebrand",
      primaryWeapon: "Mace",
      initialTomePages: 5,
    },
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.tomePages, 2);
  assert.equal(result.endState.profession.ashesCharges, 0);
  assert.ok(result.conditionBreakdown.some(row => row.name === "Burning"));
  assert.ok(result.conditionBreakdown.some(row => row.name === "Bleeding"));
  assert.equal(
    result.procSteps.some(step => step.skill === "Ashes of the Just"),
    true,
  );
});

test("Firebrand page exhaustion stows the tome and pages regenerate", () => {
  const exhausted = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Tome of Resolve",
      "Epilogue: Eternal Oasis",
      "Chapter 1: Desert Bloom",
      { type: "wait", durationMs: 8000 },
    ],
    config: {
      ...config,
      specialization: "Firebrand",
      initialTomePages: 2,
    },
  });
  const traited = simulateGw2({
    profession: guardianProfession,
    rotation: [],
    config: {
      ...config,
      specialization: "Firebrand",
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS,
        GUARDIAN_TRAIT_IDS.LOREMASTER,
      ],
    },
  });

  assert.match(
    exhausted.warnings.join(" "),
    /Chapter 1: Desert Bloom is unavailable/,
  );
  assert.equal(exhausted.endState.profession.activeTome, "");
  assert.equal(exhausted.endState.profession.tomePages, 1);
  assert.equal(traited.endState.profession.maximumTomePages, 8);
  assert.equal(traited.endState.profession.tomePages, 8);
  assert.equal(traited.endState.profession.tomePageInterval, 6);
});

test("Luminary Radiant Forge enforces entry and radiant weapon flips", () => {
  const unavailable = simulateGw2({
    profession: guardianProfession,
    rotation: ["Dazzling Hammer"],
    config: { ...config, specialization: "Luminary" },
  });
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Enter Radiant Forge",
      "Dazzling Hammer",
      "Shining Spin",
      "Glaring Burst",
    ],
    config: { ...config, specialization: "Luminary" },
  });

  assert.match(
    unavailable.warnings.join(" "),
    /Dazzling Hammer is unavailable/,
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.radiantForge, true);
  assert.equal(result.endState.profession.radiantWeapon, "hammer");
  assert.ok(result.totalDamage > 0);
});

test("elite specializations expose their profession mechanics", () => {
  const spear = guardianCatalog.skillsByName.get("Spear of Justice");
  const verdict = guardianCatalog.skillsByName.get("Hunter's Verdict");
  const dragonhunter = guardianProfession.ui.paletteGroups({
    specialization: "Dragonhunter",
  })[0].skillIds;
  const firebrand = guardianProfession.ui.paletteGroups({
    specialization: "Firebrand",
    professionState: {
      activeTome: "justice",
      tomePages: 5,
      maximumTomePages: 5,
    },
  })[0].skillIds;
  const firebrandResources = guardianProfession.ui.resourceViews({
    specialization: "Firebrand",
    professionState: {
      tomePages: 3,
      maximumTomePages: 5,
    },
  });

  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.WINGS_OF_RESOLVE), true);
  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.SHIELD_OF_COURAGE), true);
  assert.equal(spear.flipParentId, null);
  assert.equal(verdict.flipParentId, spear.id);
  assert.equal(firebrand.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL), true);
  assert.equal(firebrandResources[0].value, 3);
});

test("Guardian declarative scheduling respects the configured starting set", () => {
  const initial = simulateGw2({
    profession: guardianProfession,
    rotation: [],
    config: { ...config, startingWeaponSet: 2 },
  });
  const swapped = simulateGw2({
    profession: guardianProfession,
    rotation: ["Swap Weapons"],
    config: { ...config, startingWeaponSet: 2 },
  });

  assert.equal(initial.endState.activeWeaponSet, 2);
  assert.equal(swapped.endState.activeWeaponSet, 1);
  assert.equal(
    swapped.events.find(event => event.type === "weapon_set").weaponSet,
    1,
  );
});

test("Guardian builds migrate and validate against real catalog metadata", () => {
  const defaults = createGuardianBuildDefaults();
  const migrated = migrateGuardianBuild({
    ...defaults,
    rotation: ["Virtue of Justice", "True Strike"],
  });
  assert.equal(validateGuardianBuild(migrated).valid, true);
  assert.deepEqual(
    migrated.rotation.map(command => command.skillId),
    [
      guardianProfession.catalog.skillsByName.get("Virtue of Justice").id,
      guardianProfession.catalog.skillsByName.get("True Strike").id,
    ],
  );
  assert.equal(validateGuardianBuild({
    ...migrated,
    weapons: ["Greatsword", "Torch"],
  }).valid, false);
});

test("Guardian is registered at the profession composition boundary", async () => {
  assert.equal(await getProfession("guardian"), guardianProfession);
});
