import assert from "node:assert/strict";
import test from "node:test";

import { loadProfession } from "../js/app/profession-registry.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "../js/professions/guardian/build.js";
import {
  guardianCatalog,
} from "../js/professions/guardian/catalog.js";
import {
  DATA_SNAPSHOT,
} from "../js/professions/guardian/data/guardian-api-metadata.js";
import {
  guardianProfession,
} from "../js/professions/guardian/definition.js";
import {
  calculateAttributes as calculateGuardianAttributes,
} from "../js/professions/guardian/core/calc-attributes.js";
import {
  GUARDIAN_SKILL_IDS,
  GUARDIAN_TRAIT_IDS,
} from "../js/professions/guardian/data/ids.js";

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
  const radiantPassive = simulateGw2({
    profession: guardianProfession,
    rotation: ["Whirling Wrath"],
    config: {
      ...config,
      specialization: "Luminary",
      primaryWeapon: "Greatsword",
    },
  });
  const radiantPermeating = simulateGw2({
    profession: guardianProfession,
    rotation: ["Whirling Wrath"],
    config: {
      ...config,
      specialization: "Luminary",
      primaryWeapon: "Greatsword",
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PERMEATING_WRATH],
    },
  });
  const radiantActivated = simulateGw2({
    profession: guardianProfession,
    rotation: ["Radiant Justice", "Whirling Wrath"],
    config: {
      ...config,
      specialization: "Luminary",
      primaryWeapon: "Greatsword",
    },
  });

  assert.equal(passive.endState.profession.justicePassiveBurns, 2);
  assert.equal(passive.endState.profession.justiceHitCount, 4);
  assert.equal(activated.endState.profession.justiceActiveBurns, 1);
  assert.equal(activated.endState.profession.justicePassiveBurns, 0);
  assert.equal(activated.endState.profession.virtueReadyAt.justice, 20);
  assert.equal(permeating.endState.profession.justicePassiveBurns, 4);
  assert.equal(permeating.endState.profession.justiceHitCount, 2);
  assert.equal(radiantPassive.endState.profession.justicePassiveBurns, 2);
  assert.equal(radiantPassive.endState.profession.justiceHitCount, 4);
  assert.equal(radiantPermeating.endState.profession.justicePassiveBurns, 4);
  assert.equal(radiantPermeating.endState.profession.justiceHitCount, 2);
  assert.equal(radiantActivated.endState.profession.justicePassiveBurns, 0);
});

test("Guardian greatsword uses the reference cast and strike profiles", () => {
  const simulate = quickness => simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Strike",
      "Vengeful Strike",
      "Wrathful Strike",
      "Whirling Wrath",
      "Leap of Faith",
      "Symbol of Resolution",
      "Binding Blade",
      { type: "wait", durationMs: 15000 },
    ],
    config: {
      ...config,
      boons: { quickness },
      primaryWeapon: "Greatsword",
    },
  });
  const profile = (result, skillName) => {
    const action = result.events.find(event =>
      event.type === "action" && event.skillName === skillName);
    return {
      cast: Math.round((action.endsAt - action.at) * 1000),
      ticks: result.resolvedEvents
        .filter(event =>
          event.type === "damage" && event.skillName === skillName)
        .map(event => Math.round((event.at - action.at) * 1000)),
      coefficient: Number(result.resolvedEvents
        .filter(event =>
          event.type === "damage" && event.skillName === skillName)
        .reduce((sum, event) => sum + event.coefficient, 0)
        .toFixed(4)),
    };
  };
  const normal = simulate(false);
  const quick = simulate(true);

  assert.deepEqual(
    ["Strike", "Vengeful Strike", "Wrathful Strike"]
      .map(name => profile(normal, name).cast),
    [600, 840, 1000],
  );
  assert.deepEqual(
    ["Strike", "Vengeful Strike", "Wrathful Strike"]
      .map(name => profile(quick, name).cast),
    [400, 600, 680],
  );
  assert.deepEqual(profile(normal, "Whirling Wrath"), {
    cast: 2200,
    ticks: [
      157, 314, 471, 628, 785, 942, 1099,
      1257, 1414, 1571, 1728, 1885, 2042, 2200,
    ],
    coefficient: 4.375,
  });
  assert.deepEqual(profile(quick, "Whirling Wrath"), {
    cast: 1480,
    ticks: [
      106, 211, 317, 422, 528, 634, 739,
      846, 951, 1057, 1162, 1268, 1374, 1480,
    ],
    coefficient: 4.375,
  });
  assert.deepEqual(profile(quick, "Leap of Faith"), {
    cast: 720,
    ticks: [720],
    coefficient: 2,
  });
  assert.deepEqual(profile(quick, "Symbol of Resolution"), {
    cast: 280,
    ticks: [280, 1280, 2280, 3280, 4280],
    coefficient: 3.4,
  });
  assert.deepEqual(profile(quick, "Binding Blade"), {
    cast: 480,
    ticks: [
      480, 1480, 2480, 3480, 4480, 5480,
      6480, 7480, 8480, 9480, 10480,
    ],
    coefficient: 2.5,
  });
  const tether = quick.resolvedEvents.filter(event =>
    event.sourceId === GUARDIAN_SKILL_IDS.BINDING_BLADE_TETHER
  );
  assert.equal(tether.length, 10);
  assert.equal(tether.every(event => event.canCrit === false), true);
  assert.equal(tether.every(event =>
    event.flatStrikeBase === 160 && event.flatStrikePowerCoeff === 0.3), true);
});

test("Guardian utilities and traps use the reference damage timelines", () => {
  const skillNames = [
    "Sword of Justice",
    "Procession of Blades",
    "Bane Signet",
    "Dragon's Maw",
    "Purification",
    "Test of Faith",
  ];
  const simulate = quickness => simulateGw2({
    profession: guardianProfession,
    rotation: [
      ...skillNames,
      { type: "wait", durationMs: 5000 },
    ],
    config: {
      ...config,
      boons: { quickness },
      specialization: "Dragonhunter",
    },
  });
  const profiles = result => Object.fromEntries(skillNames.map(skillName => {
    const action = result.events.find(event =>
      event.type === "action" && event.skillName === skillName);
    const damage = result.resolvedEvents.filter(event =>
      event.type === "damage" && event.skillName === skillName);
    return [skillName, {
      cast: Math.round((action.endsAt - action.at) * 1000),
      ticks: damage.map(event =>
        Math.round((event.at - action.at) * 1000)),
      coefficient: Number(damage
        .reduce((sum, event) => sum + event.coefficient, 0)
        .toFixed(4)),
    }];
  }));
  const normal = profiles(simulate(false));
  const quick = profiles(simulate(true));

  assert.deepEqual(
    skillNames.map(name => normal[name].cast),
    [900, 660, 750, 660, 660, 0],
  );
  assert.deepEqual(
    skillNames.map(name => quick[name].cast),
    [600, 440, 500, 440, 600, 0],
  );
  assert.deepEqual(quick["Sword of Justice"], {
    cast: 600,
    ticks: [650, 1050, 1450, 1850],
    coefficient: 3.2,
  });
  assert.deepEqual(quick["Procession of Blades"], {
    cast: 440,
    ticks: [
      1280, 1560, 1840, 2120, 2400,
      2680, 2960, 3240, 3520, 3800,
    ],
    coefficient: 4.4,
  });
  assert.deepEqual(quick["Bane Signet"], {
    cast: 500,
    ticks: [500],
    coefficient: 1,
  });
  assert.deepEqual(quick["Dragon's Maw"], {
    cast: 440,
    ticks: [500],
    coefficient: 3.6,
  });
  assert.deepEqual(quick.Purification, {
    cast: 600,
    ticks: [500],
    coefficient: 0.1875,
  });
  assert.deepEqual(quick["Test of Faith"], {
    cast: 0,
    ticks: [500],
    coefficient: 1.4,
  });
});

test("Spear Helio Rush arms Illuminated and enhances the next spear skill", () => {
  const spearConfig = { ...config, primaryWeapon: "Spear" };

  const helioAlone = simulateGw2({
    profession: guardianProfession,
    rotation: ["Helio Rush"],
    config: spearConfig,
  });
  const gleamingAlone = simulateGw2({
    profession: guardianProfession,
    rotation: ["Gleaming Disc", { type: "wait", durationMs: 1000 }],
    config: spearConfig,
  });
  const combo = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Helio Rush",
      "Gleaming Disc",
      { type: "wait", durationMs: 1000 },
    ],
    config: spearConfig,
  });

  // Helio Rush is not illuminated itself but arms the buff for the next attack.
  assert.equal(helioAlone.endState.profession.spearIlluminatedArmed, true);
  assert.equal(
    helioAlone.procSteps.some(step => step.skill === "Illuminated"),
    false,
  );
  assert.equal(
    helioAlone.events.some(event =>
      event.type === "buff"
      && event.kind === "resolution"
      && event.duration === 4),
    true,
  );
  assert.equal(
    gleamingAlone.procSteps.some(step => step.skill === "Illuminated"),
    false,
  );

  // The armed buff makes Gleaming Disc illuminated: an "Illuminated" proc fires
  // and the combo out-damages the two skills cast in isolation.
  const illuminated = combo.procSteps.filter(step => step.skill === "Illuminated");
  assert.equal(illuminated.length, 1);
  assert.equal(illuminated[0].sourceSkill, "Gleaming Disc");
  assert.ok(
    combo.strikeDamage
      > helioAlone.strikeDamage + gleamingAlone.strikeDamage + 1,
  );

  const expired = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Helio Rush",
      { type: "wait", durationMs: 5001 },
      "Gleaming Disc",
      { type: "wait", durationMs: 1000 },
    ],
    config: spearConfig,
  });
  assert.deepEqual(
    expired.resolvedEvents
      .filter(event => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map(event => event.coefficient),
    [1.5, 1.5],
  );

  const consumedByFiller = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Helio Rush",
      "Daybreaking Slash",
      "Gleaming Disc",
      { type: "wait", durationMs: 1000 },
    ],
    config: spearConfig,
  });
  assert.deepEqual(
    consumedByFiller.resolvedEvents
      .filter(event => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map(event => event.coefficient),
    [1.5, 1.5],
  );
});

test("Spear Symbol of Luminance keeps all spear skills illuminated while active", () => {
  const spearConfig = { ...config, primaryWeapon: "Spear" };

  const symbolThenHelio = simulateGw2({
    profession: guardianProfession,
    rotation: ["Symbol of Luminance", "Helio Rush"],
    config: {
      ...spearConfig,
      boons: { quickness: true },
    },
  });

  assert.equal(symbolThenHelio.steps[0].end, 440);
  // The window empowers Helio Rush even though nothing armed it beforehand.
  assert.ok(symbolThenHelio.endState.profession.spearLuminanceUntil > 0);
  assert.equal(
    symbolThenHelio.procSteps.some(
      step => step.skill === "Illuminated" && step.sourceSkill === "Helio Rush",
    ),
    true,
  );
  assert.deepEqual(
    symbolThenHelio.resolvedEvents
      .filter(event =>
        event.type === "damage"
        && event.skillId === GUARDIAN_SKILL_IDS.HELIO_RUSH)
      .map(event => event.coefficient),
    [2.25],
  );
});

test("Guardian spear benchmark coefficients and repeated pulses stay per-hit", () => {
  const spearConfig = {
    ...config,
    boons: { quickness: true },
    primaryWeapon: "Spear",
  };
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Helio Rush",
      "Gleaming Disc",
      "Symbol of Luminance",
      "Solar Storm",
      { type: "wait", durationMs: 5000 },
    ],
    config: spearConfig,
  });
  const coefficients = name => result.resolvedEvents
    .filter(event => event.name === name)
    .map(event => event.coefficient);

  assert.deepEqual(coefficients("Helio Rush"), [1.5]);
  assert.deepEqual(coefficients("Gleaming Disc"), [1.5, 2.25]);
  assert.deepEqual(coefficients("Gleaming Disc (Illuminated)"), []);
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.type === "damage" && event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC
    ).length,
    2,
  );
  const gleamingAction = result.events.find(event =>
    event.type === "action"
    && event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter(event => event.skillId === GUARDIAN_SKILL_IDS.GLEAMING_DISC)
      .map(event => Math.round((event.at - gleamingAction.at) * 1000)),
    [0, 680],
  );
  assert.deepEqual(coefficients("Symbol of Luminance — Initial"), [1.5]);
  assert.deepEqual(
    coefficients("Symbol of Luminance"),
    [0.5, 0.5, 0.5, 0.5, 0.5],
  );
  assert.deepEqual(coefficients("Solar Storm — 1st Strike"), [1.5]);
  assert.deepEqual(coefficients("Solar Storm — 2nd Strike"), [1.2]);
  assert.deepEqual(coefficients("Solar Storm — 3rd Strike"), [0.9]);
  assert.deepEqual(coefficients("Solar Storm — 4th Strike"), [0.6]);
  assert.deepEqual(coefficients("Solar Storm — 5th Strike"), [0.3]);
  assert.deepEqual(coefficients("Solar Storm (Illuminated)"), []);
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.type === "damage" && event.skillId === GUARDIAN_SKILL_IDS.SOLAR_STORM
    ).length,
    5,
  );
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

test("Guardian palettes keep inactive tome and forge skills visible", () => {
  const inactiveFirebrand = {
    specialization: "Firebrand",
    professionState: {
      activeTome: "",
      tomePages: 5,
      radiantForge: false,
    },
  };
  const activeFirebrand = {
    ...inactiveFirebrand,
    professionState: {
      ...inactiveFirebrand.professionState,
      activeTome: "justice",
    },
  };
  const inactiveFirebrandGroups =
    guardianProfession.ui.paletteGroups(inactiveFirebrand);
  const activeFirebrandGroups =
    guardianProfession.ui.paletteGroups(activeFirebrand);
  const groupIds = groups => groups.map(group => group.id);

  assert.deepEqual(
    groupIds(inactiveFirebrandGroups),
    [
      "profession",
      "tome-justice",
      "tome-resolve",
      "tome-courage",
    ],
  );
  assert.deepEqual(
    activeFirebrandGroups.map(group => group.skillIds),
    inactiveFirebrandGroups.map(group => group.skillIds),
  );
  assert.equal(
    inactiveFirebrandGroups
      .find(group => group.id === "tome-justice")
      .skillIds.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL),
    true,
  );
  assert.equal(
    inactiveFirebrandGroups
      .find(group => group.id === "tome-resolve")
      .skillIds.includes(GUARDIAN_SKILL_IDS.DESERT_BLOOM),
    true,
  );
  assert.equal(
    inactiveFirebrandGroups
      .find(group => group.id === "tome-courage")
      .skillIds.includes(GUARDIAN_SKILL_IDS.UNFLINCHING_CHARGE),
    true,
  );

  const inactiveForgeGroups = guardianProfession.ui.paletteGroups({
    specialization: "Luminary",
    professionState: { radiantForge: false },
  });
  const activeForgeGroups = guardianProfession.ui.paletteGroups({
    specialization: "Luminary",
    professionState: { radiantForge: true },
  });
  assert.deepEqual(
    activeForgeGroups.map(group => group.skillIds),
    inactiveForgeGroups.map(group => group.skillIds),
  );
  assert.equal(
    inactiveForgeGroups
      .find(group => group.id === "radiant-forge")
      .skillIds.includes(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER),
    true,
  );
});

test("Guardian palette availability follows the active tome or forge", () => {
  const isAvailable = guardianProfession.ui.isPaletteSkillAvailable;
  const trueStrike = guardianCatalog.skillsByName.get("True Strike");
  const searingSpell =
    guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.SEARING_SPELL);
  const desertBloom =
    guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.DESERT_BLOOM);
  const dazzlingHammer =
    guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER);

  assert.equal(isAvailable({
    professionState: { activeTome: "", tomePages: 5 },
  }, trueStrike), true);
  assert.equal(isAvailable({
    professionState: { activeTome: "", tomePages: 5 },
  }, searingSpell), false);
  assert.equal(isAvailable({
    professionState: { activeTome: "justice", tomePages: 5 },
  }, trueStrike), false);
  assert.equal(isAvailable({
    professionState: { activeTome: "justice", tomePages: 5 },
  }, searingSpell), true);
  assert.equal(isAvailable({
    professionState: { activeTome: "justice", tomePages: 5 },
  }, desertBloom), false);
  assert.equal(isAvailable({
    professionState: { radiantForge: false },
  }, dazzlingHammer), false);
  assert.equal(isAvailable({
    professionState: { radiantForge: true },
  }, trueStrike), false);
  assert.equal(isAvailable({
    professionState: { radiantForge: true },
  }, dazzlingHammer), true);
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

test("Guardian cannot cast weapon skills while a tome or forge is active", () => {
  const firebrand = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Tome of Justice",
      "True Strike",
      "Stow Tome",
      "True Strike",
    ],
    config: {
      ...config,
      specialization: "Firebrand",
      primaryWeapon: "Mace",
    },
  });
  const luminary = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Enter Radiant Forge",
      "True Strike",
      "Exit Radiant Forge",
      "True Strike",
    ],
    config: {
      ...config,
      specialization: "Luminary",
      primaryWeapon: "Mace",
    },
  });

  assert.equal(firebrand.steps[1].invalid, true);
  assert.equal(Boolean(firebrand.steps[3].invalid), false);
  assert.equal(luminary.steps[1].invalid, true);
  assert.equal(Boolean(luminary.steps[3].invalid), false);
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
    config: {
      ...config,
      primaryWeapon: "Sword",
      secondaryWeapon: "Pistol",
    },
  });

  assert.equal(quick.endState.time, 360);
  assert.equal(
    alacrity.endState.cooldowns["Virtue of Justice"].readyAt,
    16000,
  );
  assert.equal(
    virtuous.endState.cooldowns["Virtue of Justice"].readyAt,
    17000,
  );
  assert.equal(ammo.endState.ammo["Hail of Justice"].charges, 0);
  assert.equal(ammo.steps[2].start, 10250);
  assert.deepEqual(ammo.warnings, []);
});

test("Guardian measured Quickness cast times remain exact", () => {
  const quicknessConfig = {
    ...config,
    boons: { quickness: true },
    specialization: "Luminary",
    primaryWeapon: "Spear",
  };
  const castDuration = (rotation, skillName) => {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation,
      config: quicknessConfig,
    });
    const action = result.events.find(event =>
      event.type === "action" && event.skillName === skillName);
    return Math.round((action.endsAt - action.at) * 1000);
  };

  assert.equal(castDuration(["Helio Rush"], "Helio Rush"), 320);
  assert.equal(castDuration(["Gleaming Disc"], "Gleaming Disc"), 560);
  assert.equal(castDuration(["Solar Storm"], "Solar Storm"), 560);
  assert.equal(
    castDuration(
      ["Enter Radiant Forge", "Dazzling Hammer"],
      "Dazzling Hammer",
    ),
    480,
  );

  const chain = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Daybreaking Slash",
      "Daybreaking Slash",
      "Helio Rush",
      "Daybreaking Slash",
    ],
    config: quicknessConfig,
  });
  assert.deepEqual(
    chain.events
      .filter(event =>
        event.type === "action"
        && event.skillName === "Daybreaking Slash")
      .map(event => Math.round((event.endsAt - event.at) * 1000)),
    [520, 440, 520],
  );
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

test("Guardian results advance to cooldown expiry before recasting", () => {
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
        start: 22000,
        end: 22000,
        invalid: false,
      },
    ],
  );
  assert.equal(
    result.endState.cooldowns["Virtue of Justice"].readyAt,
    42000,
  );
  assert.deepEqual(result.warnings, []);
});

test("Firebrand tomes consume shared pages and execute tome damage", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Tome of Justice",
      "Chapter 1: Searing Spell",
      "Chapter 4: Scorched Aftermath",
      "Epilogue: Ashes of the Just",
      "Stow Tome",
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

test("Ashes of the Just cannot trigger before its application event", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "True Strike",
      "Tome of Justice",
      "Epilogue: Ashes of the Just",
      "Stow Tome",
      "Symbol of Faith",
      { type: "wait", durationMs: 2000 },
    ],
    config: {
      ...config,
      specialization: "Firebrand",
      primaryWeapon: "Mace",
      initialTomePages: 5,
    },
  });
  const ashesAppliedAt = result.events.find(event =>
    event.type === "guardian.tome-page-used"
    && event.skillId === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST
  ).at;
  const ashes = result.resolvedEvents.filter(event =>
    event.type === "condition"
    && event.sourceId === "guardian.ashes-of-the-just"
  );
  assert.ok(ashes.length > 0);
  assert.ok(ashes.every(event => event.at >= ashesAppliedAt));
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

test("Firebrand tome page cost waits for a regenerating page", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Tome of Resolve",
      // Epilogue: Eternal Oasis costs two pages; starting at one page it must
      // wait for the next scheduled page rather than being discarded.
      "Epilogue: Eternal Oasis",
    ],
    config: {
      ...config,
      specialization: "Firebrand",
      initialTomePages: 1,
    },
  });

  const epilogue = result.steps.find(
    step => step.skill === "Epilogue: Eternal Oasis",
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(epilogue && !epilogue.invalid);
  // The first page lands at the 8s interval, so the cast is delayed to it.
  assert.ok(epilogue.start >= 8000);
  assert.equal(result.endState.profession.activeTome, "");
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
  const glaring = result.resolvedEvents.find(event =>
    event.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST
  );
  assert.equal(glaring.coefficient, 1);
  assert.equal(glaring.radiantWeapon, "hammer");
  assert.equal(
    Object.hasOwn(result.endState.cooldowns, "Enter Radiant Forge"),
    false,
  );
  assert.ok(result.totalDamage > 0);
});

test("Radiant Forge recharge starts on exit and uses equipped weapons", () => {
  const hammerOnly = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Enter Radiant Forge",
      "Dazzling Hammer",
      "Shining Spin",
      "Exit Radiant Forge",
      "Enter Radiant Forge",
    ],
    config: { ...config, specialization: "Luminary" },
  });
  const allWeapons = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Enter Radiant Forge",
      "Dazzling Hammer",
      "Luminous Staff",
      "Gleaming Blade",
      "Radiant Bulwark",
      "Exit Radiant Forge",
      "Enter Radiant Forge",
    ],
    config: { ...config, specialization: "Luminary" },
  });

  assert.equal(
    hammerOnly.steps
      .filter(step => step.skill === "Enter Radiant Forge")[1].start,
    6200,
  );
  assert.equal(
    allWeapons.steps
      .filter(step => step.skill === "Enter Radiant Forge")[1].start,
    14350,
  );
  assert.equal(allWeapons.endState.profession.radiantForgeEndsAt, 34.35);
});

test("Radiant Forge recharge starts when its automatic exit occurs", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Enter Radiant Forge",
      { type: "wait", durationMs: 21000 },
      "Enter Radiant Forge",
    ],
    config: { ...config, specialization: "Luminary" },
  });

  assert.equal(
    result.steps
      .filter(step => step.skill === "Enter Radiant Forge")[1].start,
    25000,
  );
});

test("Radiant Forge transitions emit the current set and trigger swap sigils", () => {
  const outOfCombat = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Enter Radiant Forge",
      { type: "wait", durationMs: 1000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      sigilSets: [
        {
          names: ["Hydromancy", "Geomancy"],
          strike: 1,
          condition: 1,
        },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  });
  assert.equal(outOfCombat.procSteps.some(step =>
    step.type === "sigil_proc"
  ), false);

  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Daring Advance",
      "Piercing Stance",
      "Enter Radiant Forge",
      "Exit Radiant Forge",
      "Enter Radiant Forge",
      "Exit Radiant Forge",
      "Enter Radiant Forge",
      { type: "wait", durationMs: 9000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      sigilSets: [
        {
          names: ["Hydromancy", "Geomancy"],
          strike: 1,
          condition: 1,
        },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  });
  const procTimes = name => result.procSteps
    .filter(step => step.skill === `Sigil of ${name}`)
    .map(step => step.start);
  const applications = condition => result.resolvedEvents.filter(event =>
    event.skillName === `Sigil of ${
      condition === "Chilled" ? "Hydromancy" : "Geomancy"
    }`
    && event.condition === condition
  );

  assert.deepEqual(procTimes("Hydromancy"), [1250, 11250]);
  assert.deepEqual(procTimes("Geomancy"), [1250, 11250]);
  assert.deepEqual(
    result.events
      .filter(event => event.type === "weapon_set")
      .map(event => [event.skillName, event.weaponSet]),
    [
      ["Enter Radiant Forge", 1],
      ["Exit Radiant Forge", 1],
      ["Enter Radiant Forge", 1],
      ["Exit Radiant Forge", 1],
      ["Enter Radiant Forge", 1],
    ],
  );
  assert.ok(result.procSteps
    .filter(step => ["Sigil of Hydromancy", "Sigil of Geomancy"]
      .includes(step.skill))
    .every(step =>
      step.sourceSkill === "Enter Radiant Forge"
      && step.icon.startsWith("https://render.guildwars2.com/file/")
    ));
  assert.equal(result.resolvedEvents.filter(event =>
    event.skillName === "Sigil of Hydromancy"
    && event.type === "damage"
  ).length, 2);
  assert.equal(applications("Chilled").length, 2);
  assert.equal(applications("Bleeding").length, 2);
  assert.ok(applications("Bleeding").every(application =>
    application.damage > 0
  ));

  const manualExit = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Daring Advance",
      "Piercing Stance",
      "Enter Radiant Forge",
      { type: "wait", durationMs: 10000 },
      "Exit Radiant Forge",
      { type: "wait", durationMs: 1000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      sigilSets: [
        {
          names: ["Hydromancy", "Geomancy"],
          strike: 1,
          condition: 1,
        },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  });
  assert.deepEqual(
    manualExit.procSteps
      .filter(step => step.skill === "Sigil of Hydromancy")
      .map(step => [step.start, step.sourceSkill]),
    [
      [1250, "Enter Radiant Forge"],
      [11250, "Exit Radiant Forge"],
    ],
  );

  const automaticExit = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Daring Advance",
      "Piercing Stance",
      "Enter Radiant Forge",
      { type: "wait", durationMs: 21000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      sigilSets: [
        {
          names: ["Hydromancy", "Geomancy"],
          strike: 1,
          condition: 1,
        },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  });
  assert.deepEqual(
    automaticExit.procSteps
      .filter(step => step.skill === "Sigil of Geomancy")
      .map(step => [step.start, step.sourceSkill]),
    [
      [1250, "Enter Radiant Forge"],
      [21250, "Exit Radiant Forge"],
    ],
  );
  assert.deepEqual(
    automaticExit.events
      .filter(event => event.type === "weapon_set")
      .map(event => [
        event.skillName,
        event.weaponSet,
        Boolean(event.automatic),
      ]),
    [
      ["Enter Radiant Forge", 1, false],
      ["Exit Radiant Forge", 1, true],
    ],
  );

  const radiantWeapon = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Daring Advance",
      "Piercing Stance",
      "Enter Radiant Forge",
      { type: "wait", durationMs: 10000 },
      "Dazzling Hammer",
      "Shining Spin",
      { type: "wait", durationMs: 1000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      sigilSets: [
        {
          names: ["Hydromancy", "Geomancy"],
          strike: 1,
          condition: 1,
        },
        { names: [], strike: 1, condition: 1 },
      ],
    },
  });
  assert.deepEqual(
    radiantWeapon.procSteps
      .filter(step => step.skill === "Sigil of Hydromancy")
      .map(step => [step.start, step.sourceSkill]),
    [
      [1250, "Enter Radiant Forge"],
      [11850, "Dazzling Hammer"],
    ],
  );
  assert.equal(
    radiantWeapon.procSteps.some(step =>
      step.skill === "Sigil of Hydromancy"
      && step.sourceSkill === "Shining Spin"
    ),
    false,
  );
});

test("Luminary weapon coefficients, disables, and armament buffs resolve", () => {
  const rotation = [
    "Enter Radiant Forge",
    "Dazzling Hammer",
    "Shining Spin",
    "Luminous Staff",
    { type: "wait", durationMs: 3500 },
  ];
  const empowered = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: {
      ...config,
      specialization: "Luminary",
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS],
    },
  });
  const armaments = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: {
      ...config,
      specialization: "Luminary",
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS,
        GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS,
      ],
    },
  });
  const damage = (result, name) =>
    result.resolvedEvents.find(event => event.name === name);
  const dazzling = damage(armaments, "Dazzling Hammer");
  const shining = damage(armaments, "Shining Spin");
  const defiantAfterDaze = simulateGw2({
    profession: guardianProfession,
    rotation: ["Enter Radiant Forge", "Dazzling Hammer", "Shining Spin"],
    config: {
      ...config,
      specialization: "Luminary",
      target: { ...config.target, defiant: true },
    },
  });
  const ordinaryAfterDaze = simulateGw2({
    profession: guardianProfession,
    rotation: ["Enter Radiant Forge", "Dazzling Hammer", "Shining Spin"],
    config: {
      ...config,
      specialization: "Luminary",
    },
  });

  assert.equal(dazzling.coefficient, 1.2);
  assert.equal(shining.coefficient, 1.25);
  assert.ok(shining.damage > dazzling.damage);
  assert.ok(
    Math.abs(
      damage(defiantAfterDaze, "Shining Spin").damage
      / damage(ordinaryAfterDaze, "Shining Spin").damage
      - 1,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      dazzling.damage / damage(empowered, "Dazzling Hammer").damage - 1,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      shining.damage / damage(empowered, "Shining Spin").damage
      - 1.17 / 1.1,
    ) < 1e-9,
  );
  const armamentStaff = armaments.resolvedEvents
    .filter(event => event.name === "Luminous Staff — Symbol Damage");
  const empoweredStaff = empowered.resolvedEvents
    .filter(event => event.name === "Luminous Staff — Symbol Damage");
  assert.ok(
    Math.abs(
      armamentStaff[0].damage / empoweredStaff[0].damage
      - 1.17 / 1.1,
    ) < 1e-9,
  );
  assert.equal(
    armamentStaff.slice(1).every((event, index) =>
      Math.abs(event.damage / empoweredStaff[index + 1].damage - 1)
        < 1e-9),
    true,
  );
  assert.equal(
    armaments.resolvedEvents
      .filter(event => event.name === "Luminous Staff — Symbol Damage")
      .length,
    4,
  );
  assert.deepEqual(
    armaments.procSteps
      .filter(step => step.skill === "Empowered Armaments")
      .map(step => step.detail),
    ["triggered", "refreshed"],
  );
  assert.equal(
    armaments.procSteps
      .filter(step => step.skill === "Radiant Armaments")[1].detail,
    "staff: hammer bonus removed",
  );

  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Radiant Justice",
      "Enter Radiant Forge",
      "Dazzling Hammer",
      { type: "wait", durationMs: 1000 },
    ],
    config: { ...config, specialization: "Luminary" },
  });
  const hammerPackets = justice.resolvedEvents
    .filter(event => event.skillId === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER);
  assert.deepEqual(
    hammerPackets.map(event => event.coefficient),
    [1.2, 1.5],
  );
  assert.ok(
    Math.abs(hammerPackets[1].at - hammerPackets[0].at - 0.75) < 1e-9,
  );

  const gleaming = selectedTraitIds => simulateGw2({
    profession: guardianProfession,
    rotation: [
      ...(selectedTraitIds ? ["Radiant Courage"] : []),
      "Enter Radiant Forge",
      "Gleaming Blade",
    ],
    config: { ...config, specialization: "Luminary" },
  });
  const normalBlade = damage(gleaming(false), "Gleaming Blade");
  const empoweredBlade = damage(gleaming(true), "Gleaming Blade");
  assert.ok(
    Math.abs(empoweredBlade.damage / normalBlade.damage - 1.5) < 1e-9,
  );
});

test("Guardian armaments share the additive sigil bucket", () => {
  const rotation = [
    "Enter Radiant Forge",
    "Dazzling Hammer",
    "Shining Spin",
  ];
  const run = ({
    selectedTraitIds = [],
    sigilSets = undefined,
    burning = false,
  } = {}) => simulateGw2({
    profession: guardianProfession,
    rotation,
    config: {
      ...config,
      specialization: "Luminary",
      selectedTraitIds,
      sigilSets,
      target: {
        ...config.target,
        conditions: burning ? { Burning: true } : {},
      },
    },
  });
  const shining = result => result.resolvedEvents
    .find(event => event.name === "Shining Spin").damage;
  const baseline = run();
  const sigils = run({
    sigilSets: [
      { names: ["Force", "Impact"], strikeAdd: 0.08, strike: 1.08 },
      {},
    ],
  });
  const armaments = run({
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS,
      GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS,
    ],
    sigilSets: [
      { names: ["Force", "Impact"], strikeAdd: 0.08, strike: 1.08 },
      {},
    ],
  });
  const conditional = run({
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS,
      GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS,
      GUARDIAN_TRAIT_IDS.FIERY_WRATH,
    ],
    sigilSets: [
      { names: ["Force", "Impact"], strikeAdd: 0.08, strike: 1.08 },
      {},
    ],
    burning: true,
  });

  assert.ok(Math.abs(shining(sigils) / shining(baseline) - 1.08) < 1e-9);
  assert.ok(
    Math.abs(shining(armaments) / shining(baseline) - 1.25) < 1e-9,
  );
  assert.ok(
    Math.abs(shining(conditional) / shining(armaments) - 1.05) < 1e-9,
  );
});

test("Radiant virtues grant one-use hammer and sword empowerments", () => {
  const armedHammer = simulateGw2({
    profession: guardianProfession,
    rotation: ["Radiant Justice"],
    config: { ...config, specialization: "Luminary" },
  });
  const hammer = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Radiant Justice",
      "Enter Radiant Forge",
      "Dazzling Hammer",
      "Dazzling Hammer",
    ],
    config: { ...config, specialization: "Luminary" },
  });
  const armedSword = simulateGw2({
    profession: guardianProfession,
    rotation: ["Radiant Courage"],
    config: { ...config, specialization: "Luminary" },
  });
  const sword = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Radiant Courage",
      "Enter Radiant Forge",
      "Gleaming Blade",
      "Gleaming Blade",
    ],
    config: { ...config, specialization: "Luminary" },
  });
  const bladeHits = sword.resolvedEvents
    .filter(event => event.name === "Gleaming Blade");

  assert.equal(armedHammer.endState.profession.radiantJusticeArmed, true);
  assert.equal(
    hammer.resolvedEvents
      .filter(event =>
        event.name === "Dazzling Hammer — Radiant Justice Impact").length,
    1,
  );
  assert.equal(hammer.endState.profession.radiantJusticeArmed, false);
  assert.ok(hammer.procSteps.some(step =>
    step.type === "skill_proc"
    && step.skill === "Empowered Hammer"
    && step.sourceSkill === "Radiant Justice"));

  assert.equal(armedSword.endState.profession.radiantCourageSwordArmed, true);
  assert.equal(bladeHits.length, 2);
  assert.ok(Math.abs(bladeHits[0].damage / bladeHits[1].damage - 1.5) < 1e-9);
  assert.equal(sword.endState.profession.radiantCourageSwordArmed, false);
  assert.ok(sword.procSteps.some(step =>
    step.type === "skill_proc"
    && step.skill === "Empowered Sword"
    && step.sourceSkill === "Radiant Courage"));
});

test("Guardian strike modifiers use their tested additive and mult buckets", () => {
  const run = selectedTraitIds => simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Symbol of Resolution",
      { type: "wait", durationMs: 1500 },
    ],
    config: {
      ...config,
      boons: { fury: true },
      primaryWeapon: "Greatsword",
      selectedTraitIds,
      sigilSets: [
        { names: ["Force"], strikeAdd: 0.05, strike: 1.05 },
        {},
      ],
      target: {
        ...config.target,
        conditions: {
          Burning: true,
          Vulnerability: 25,
        },
      },
    },
  });
  const pulse = result => result.resolvedEvents
    .filter(event => event.name === "Symbol of Resolution")[0].damage;
  const baseline = run([]);
  const conditional = run([
    GUARDIAN_TRAIT_IDS.FIERY_WRATH,
    GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
    GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
    GUARDIAN_TRAIT_IDS.RETRIBUTION,
  ]);

  assert.ok(
    Math.abs(
      pulse(conditional) / pulse(baseline)
      - (1.25 / 1.05) * 1.05 * 1.05,
    ) < 1e-9,
  );
});

test("Luminary stances apply modifiers, combos, delayed damage, and control", () => {
  const piercing = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Piercing Stance",
      "Piercing Stance",
      { type: "wait", durationMs: 1000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      relic: "Claw",
    },
  });
  const daring = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Daring Advance",
      { type: "wait", durationMs: 1000 },
    ],
    config: { ...config, specialization: "Luminary" },
  });
  const effulgent = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Effulgent Stance",
      "Whirling Wrath",
      { type: "wait", durationMs: 4000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      primaryWeapon: "Greatsword",
      relic: "Claw",
    },
  });
  const effulgentWithGuardianProcs = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Effulgent Stance",
      "Enter Radiant Forge",
      "Dazzling Hammer",
      { type: "wait", durationMs: 4000 },
    ],
    config: {
      ...config,
      specialization: "Luminary",
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT],
    },
  });
  const effulgentDamage = effulgent.resolvedEvents
    .find(event => event.name === "Effulgent Stance");
  const procChargedEffulgent = effulgentWithGuardianProcs.resolvedEvents
    .find(event => event.name === "Effulgent Stance");
  const piercingBuffs = piercing.events
    .filter(event => event.kind === "guardian-piercing-stance");

  assert.equal(
    piercing.events.find(event =>
      event.type === "control"
      && event.skillName === "Piercing Stance").controlKind,
    "daze",
  );
  assert.equal(piercingBuffs[0].duration, 8);
  assert.equal(piercingBuffs[1].at + piercingBuffs[1].duration, 16);
  assert.ok(
    piercing.procSteps.some(step => step.skill === "Relic of the Claw"),
  );
  assert.equal(
    daring.events.some(event =>
      event.type === "control"
      && event.skillName === "Daring Advance"),
    false,
  );
  assert.equal(
    daring.events.find(event =>
      event.kind === "guardian-daring-advance").duration,
    8,
  );
  assert.equal(effulgentDamage.at, 4);
  assert.equal(effulgentDamage.stackCount, 10);
  assert.equal(effulgentDamage.coefficient, 4);
  assert.equal(effulgentDamage.weaponStrength, 690.5);
  assert.equal(procChargedEffulgent.stackCount, 3);
  assert.ok(Math.abs(procChargedEffulgent.coefficient - 1.55) < 1e-9);
  assert.deepEqual(
    effulgent.procSteps
      .filter(step =>
        step.type === "skill_proc"
        && step.skill === "Effulgent Stance")
      .map(step => [step.start, step.sourceSkill, step.detail]),
    [[4000, "Effulgent Stance", "10/10 stacks"]],
  );
  assert.ok(
    effulgent.procSteps.some(step =>
      step.skill === "Relic of the Claw"
      && step.start === 4000),
  );
});

test("Sovereign of Light consumes combo and trait-granted light auras", () => {
  const combo = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Symbol of Resolution",
      "Leap of Faith",
      "Enter Radiant Forge",
      "Dazzling Hammer",
    ],
    config: {
      ...config,
      specialization: "Luminary",
      primaryWeapon: "Greatsword",
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT],
    },
  });
  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: ["Radiant Justice", "Piercing Stance"],
    config: {
      ...config,
      specialization: "Luminary",
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
        GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT,
      ],
    },
  });
  const sovereignHits = combo.resolvedEvents
    .filter(event => event.name === "Sovereign of Light");
  const sovereignProcs = combo.procSteps
    .filter(step => step.skill === "Sovereign of Light");

  assert.equal(sovereignHits.length, 2);
  assert.equal(
    sovereignHits.every(event => event.coefficient === 1.5),
    true,
  );
  assert.equal(
    sovereignHits.every(event => event.skillWeapon === "Unequipped"),
    true,
  );
  assert.equal(sovereignProcs.length, 2);
  assert.equal(sovereignProcs.every(step => Boolean(step.icon)), true);
  assert.ok(justice.events.some(event =>
    event.type === "blind"
    && event.skillName === "Justice is Blind"));
  assert.equal(
    justice.resolvedEvents
      .filter(event => event.name === "Sovereign of Light").length,
    1,
  );
});

test("Luminary recharge traits alter the intended cooldown families", () => {
  const masterRotation = [
    "Enter Radiant Forge",
    "Dazzling Hammer",
    "Exit Radiant Forge",
    "Radiant Justice",
    "Enter Radiant Forge",
    "Dazzling Hammer",
  ];
  const withMaster = simulateGw2({
    profession: guardianProfession,
    rotation: masterRotation,
    config: {
      ...config,
      specialization: "Luminary",
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS],
    },
  });
  const withoutMaster = simulateGw2({
    profession: guardianProfession,
    rotation: masterRotation,
    config: { ...config, specialization: "Luminary" },
  });
  const inspirationRotation = [
    "Radiant Justice",
    "Enter Radiant Forge",
    "Dazzling Hammer",
    "Exit Radiant Forge",
    "Radiant Justice",
  ];
  const withInspiration = simulateGw2({
    profession: guardianProfession,
    rotation: inspirationRotation,
    config: {
      ...config,
      specialization: "Luminary",
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION,
      ],
    },
  });
  const withoutInspiration = simulateGw2({
    profession: guardianProfession,
    rotation: inspirationRotation,
    config: { ...config, specialization: "Luminary" },
  });

  assert.equal(
    withMaster.steps.filter(step => step.skill === "Dazzling Hammer")[1].start,
    5600,
  );
  assert.equal(
    withoutMaster.steps
      .filter(step => step.skill === "Dazzling Hammer")[1].start,
    7600,
  );
  assert.equal(
    withInspiration.steps
      .filter(step => step.skill === "Radiant Justice")[1].start,
    16000,
  );
  assert.equal(
    withoutInspiration.steps
      .filter(step => step.skill === "Radiant Justice")[1].start,
    20000,
  );
});

test("Zeal symbol traits emit their full profiles and stack damage", () => {
  const symbols = simulateGw2({
    profession: guardianProfession,
    rotation: ["Virtue of Justice", { type: "wait", durationMs: 5000 }],
    config: {
      ...config,
      boons: { fury: true },
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
        GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
        GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
      ],
    },
  });
  const zealotsResolution = simulateGw2({
    profession: guardianProfession,
    rotation: ["True Strike", { type: "wait", durationMs: 5000 }],
    config: {
      ...config,
      target: { ...config.target, health: 2500 },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION],
    },
  });
  const blades = symbols.resolvedEvents
    .filter(event => event.name === "Lesser Symbol of Blades");
  const resolution = zealotsResolution.resolvedEvents
    .filter(event => event.name === "Lesser Symbol of Resolution");

  assert.equal(blades.length, 5);
  assert.equal(blades.every(event => event.coefficient === 0.65), true);
  assert.equal(
    blades.every(event => event.skillWeapon === "Unequipped"),
    true,
  );
  assert.equal(symbols.endState.profession.symbolicAvengerStacks, 5);
  assert.equal(
    symbols.events.filter(event =>
      event.kind === "target-vulnerability"
      && event.skillName === "Symbolic Exposure").length,
    5,
  );
  assert.equal(resolution.length, 5);
  assert.equal(resolution.every(event => event.coefficient === 0.5), true);
  assert.equal(
    resolution.every(event => event.skillWeapon === "Unequipped"),
    true,
  );
  assert.equal(
    zealotsResolution.endState.profession.zealotsResolutionReadyAt,
    resolution[0].at + 30,
  );
});

test("resolution traits affect strike damage, critical chance, and might", () => {
  const run = selectedTraitIds => simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Symbol of Resolution",
      { type: "wait", durationMs: 6000 },
    ],
    config: {
      ...config,
      primaryWeapon: "Greatsword",
      selectedTraitIds,
    },
  });
  const righteous = run([GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS]);
  const retribution = run([
    GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    GUARDIAN_TRAIT_IDS.RETRIBUTION,
  ]);
  const first = result => result.resolvedEvents
    .find(event => event.name === "Symbol of Resolution — Initial");
  const pulses = retribution.resolvedEvents
    .filter(event => event.name === "Symbol of Resolution");

  assert.ok(
    Math.abs(
      first(retribution).damage / first(righteous).damage - 1.1,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      first(retribution).criticalChance - 0.25
      - (
        config.stats.precision > 895
          ? (config.stats.precision - 895) / 2100
          : 0
      ),
    ) < 1e-9,
  );
  assert.equal(
    pulses.every((event, index) =>
      index === 0 || event.damage > pulses[index - 1].damage),
    true,
  );
  assert.deepEqual(
    retribution.procSteps
      .filter(step => step.skill === "Righteous Instincts")
      .map(step => step.start),
    [280, 1280, 2280, 3280, 4280, 5280],
  );
});

test("Guardian build attributes expose static Zeal and Radiance bonuses", () => {
  const build = createGuardianBuildDefaults();
  build.weapons = ["Greatsword", ""];
  build.specializations = [
    { name: "Zeal", traits: "2-2-3" },
    { name: "Radiance", traits: "2-3-3" },
    { name: "Luminary", traits: "3-3-2" },
  ];
  const all = calculateGuardianAttributes(build, []).attributes;
  const withoutBlade = calculateGuardianAttributes(
    build,
    [],
    1,
    "Zealous Blade",
  ).attributes;
  const withoutPower = calculateGuardianAttributes(
    build,
    [],
    1,
    "Radiant Power",
  ).attributes;
  const withoutRightHand = calculateGuardianAttributes(
    build,
    [],
    1,
    "Right-Hand Strength",
  ).attributes;

  assert.equal(all.Power.final - withoutBlade.Power.final, 240);
  assert.equal(all.Ferocity.final - withoutPower.Ferocity.final, 150);
  assert.equal(all.Precision.final - withoutRightHand.Precision.final, 80);
  assert.equal(all.Power.final - withoutRightHand.Power.final, 0);

  build.weapons = ["Sword", "Focus"];
  const oneHanded = calculateGuardianAttributes(build, []).attributes;
  const oneHandedWithout = calculateGuardianAttributes(
    build,
    [],
    1,
    "Right-Hand Strength",
  ).attributes;
  assert.equal(oneHanded.Power.final - oneHandedWithout.Power.final, 80);
});

test("Luminary UI excludes virtue aliases and lists the forge exit once", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Radiant Justice",
      "Enter Radiant Forge",
    ],
    config: { ...config, specialization: "Luminary" },
  });
  const professionSkillIds = guardianProfession.ui.paletteGroups({
    specialization: "Luminary",
    professionState: result.endState.profession,
  })[0].skillIds;
  const professionSkillNames = professionSkillIds.map(id =>
    guardianCatalog.skillsById.get(id)?.name);

  assert.equal(
    result.endState.profession.availableFlips[
      GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE
    ],
    undefined,
  );
  assert.equal(professionSkillNames.includes("Spear of Justice"), false);
  assert.equal(
    professionSkillNames.filter(name => name === "Exit Radiant Forge").length,
    1,
  );
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
  }).flatMap(group => group.skillIds);
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
  assert.equal(await loadProfession("guardian"), guardianProfession);
});
