import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getProfession,
  getProfessionAppAdapter,
  professionOptions,
} from "../js/app/composition.js";
import { professionRoute } from "../js/app/profession-selector.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild,
  validateNecromancerBuild,
} from "../js/professions/necromancer/build.js";
import {
  necromancerCatalog,
  NECROMANCER_NON_DPS_SKILL_NAMES,
} from "../js/professions/necromancer/catalog.js";
import {
  DATA_SNAPSHOT,
} from "../js/professions/necromancer/data/necromancer-catalog.js";
import {
  necromancerProfession,
} from "../js/professions/necromancer/definition.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../js/professions/necromancer/data/ids.js";

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 2000,
    ferocity: 500,
    conditionDamage: 1200,
    expertise: 0,
    vitality: 1000,
  },
  target: {
    armor: 2597,
    conditions: {
      Chilled: true,
      Vulnerability: 25,
    },
  },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: necromancerProfession,
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

test("Necromancer uses the current API catalog and all nine trait lines", () => {
  assert.equal(DATA_SNAPSHOT, "2026-07-25");
  assert.equal(necromancerCatalog.specializations.length, 9);
  assert.equal(necromancerCatalog.traits.length, 108);
  assert.ok(necromancerCatalog.skills.length >= 160);
  assert.equal(
    necromancerCatalog.skillsById.get(ID.LIFE_BLAST).name,
    "Life Blast",
  );
  assert.deepEqual(
    necromancerCatalog.specializations
      .filter(specialization => specialization.elite)
      .map(specialization => specialization.name),
    ["Reaper", "Scourge", "Harbinger", "Ritualist"],
  );
});

test("every catalog skill has mechanics and API aliases are excluded", () => {
  assert.equal(
    necromancerCatalog.skills.every(skill => skill.implemented),
    true,
  );
  assert.equal(
    necromancerCatalog.skills
      .filter(skill => skill.simulatorAliasOfId != null)
      .every(skill => skill.simulatorExcluded),
    true,
  );
  for (const name of NECROMANCER_NON_DPS_SKILL_NAMES) {
    assert.equal(
      necromancerCatalog.skillsByName.get(name)?.simulatorExcluded,
      true,
      name,
    );
  }
  for (const skill of necromancerCatalog.skills) {
    if (skill.simulatorExcluded) continue;
    assert.equal(
      Boolean(
        skill.handlerId
        || skill.effects.length
        || skill.lifeForceGain
        || skill.flipParentId != null
        || skill.type === "Action",
      ),
      true,
      `${skill.id} ${skill.name}`,
    );
  }
});

test("Core Death Shroud drains life force and gates transformed skills", () => {
  const result = simulate("Core", [
    "Death Shroud",
    "Life Blast",
    { type: "wait", durationMs: 1000 },
    "End Death Shroud",
  ], { initialResource: 100 });
  const invalid = simulate("Core", [
    "Life Blast",
    "Death Shroud",
    "Rending Claws",
  ], {
    initialResource: 100,
    primaryWeapon: "Axe",
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeShroud, "");
  assert.ok(result.endState.profession.lifeForce < 97);
  assert.ok(result.strikeDamage > 0);
  assert.equal(invalid.warnings.length, 2);
  assert.match(invalid.warnings.join(" "), /Life Blast is unavailable/);
  assert.match(invalid.warnings.join(" "), /Rending Claws is unavailable/);
});

test("Reaper Shroud enforces its chain and four-percent drain", () => {
  const result = simulate("Reaper", [
    "Reaper's Shroud",
    "Life Rend",
    "Life Slash",
    "Life Reap",
    { type: "wait", durationMs: 1000 },
    "Exit Reaper's Shroud",
  ], { initialResource: 100 });
  const skipped = simulate("Reaper", [
    "Reaper's Shroud",
    "Life Reap",
  ], { initialResource: 100 });

  assert.deepEqual(result.warnings, []);
  assert.ok(result.endState.profession.lifeForce < 93);
  assert.ok(
    result.breakdown.some(entry => entry.name === "Life Reap"),
  );
  assert.match(skipped.warnings.join(" "), /Life Reap is unavailable/);
});

test("Scourge shades use ammo and shade skills spend life force", () => {
  const ammo = simulate("Scourge", [
    "Manifest Sand Shade",
    "Manifest Sand Shade",
    "Manifest Sand Shade",
    "Manifest Sand Shade",
  ], { initialResource: 100 });
  const cost = simulate("Scourge", [
    "Manifest Sand Shade",
    "Nefarious Favor",
    { type: "wait", durationMs: 1000 },
  ], { initialResource: 30 });

  assert.equal(ammo.endState.profession.shades.length, 3);
  assert.equal(ammo.endState.profession.lifeForce, 100);
  assert.match(ammo.warnings.join(" "), /on cooldown/);
  assert.equal(cost.endState.profession.lifeForce, 9);
  assert.ok(cost.conditionDamage > 0);
});

test("Harbinger Shroud generates and consumes expiring blight", () => {
  const generated = simulate("Harbinger", [
    "Harbinger Shroud",
    { type: "wait", durationMs: 3100 },
    "Exit Harbinger Shroud",
  ], { initialResource: 100 });
  const consumed = simulate("Harbinger", [
    "Harbinger Shroud",
    "Devouring Cut",
    "Exit Harbinger Shroud",
    { type: "wait", durationMs: 1000 },
  ], {
    initialResource: 100,
    initialBlight: 5,
  });
  const expired = simulate("Harbinger", [
    { type: "wait", durationMs: 25_100 },
  ], { initialBlight: 10 });

  assert.equal(generated.endState.profession.blight, 6);
  assert.equal(consumed.endState.profession.blight, 2);
  assert.ok(
    consumed.resolvedEvents.some(event =>
      event.condition === "Torment" && event.stacks === 5),
  );
  assert.equal(expired.endState.profession.blight, 0);
});

test("Lich Form swaps its bar and grants life force on exit", () => {
  const result = simulate("Core", [
    "Lich Form",
    "Deathly Claws",
    "Exit Lich Form",
  ], { initialResource: 0 });
  const invalid = simulate("Core", [
    "Lich Form",
    "Rending Claws",
  ], {
    initialResource: 0,
    primaryWeapon: "Axe",
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeShroud, "");
  assert.ok(result.endState.profession.lifeForce >= 15);
  assert.ok(
    result.breakdown.some(entry => entry.name === "Deathly Claws"),
  );
  assert.match(invalid.warnings.join(" "), /Rending Claws is unavailable/);
});

test("minion summons persist, attack, and unlock their command", () => {
  const result = simulate("Core", [
    "Summon Bone Fiend",
    { type: "wait", durationMs: 4000 },
    "Rigor Mortis",
  ]);
  const invalid = simulate("Core", ["Rigor Mortis"]);
  const wurm = simulate("Core", [
    "Summon Flesh Wurm",
    "Necrotic Traversal",
    { type: "wait", durationMs: 1000 },
  ], { initialResource: 0 });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeMinions["bone-fiend"], 1);
  assert.ok(
    result.breakdown.some(entry =>
      entry.name === "Summon Bone Fiend — Minion Attack"),
  );
  assert.ok(result.breakdown.some(entry => entry.name === "Rigor Mortis"));
  assert.match(invalid.warnings.join(" "), /Rigor Mortis is unavailable/);
  assert.deepEqual(wurm.warnings, []);
  assert.equal(wurm.endState.profession.activeMinions["flesh-wurm"], undefined);
  assert.equal(wurm.endState.profession.lifeForce, 10);
  assert.ok(
    wurm.resolvedEvents.some(event =>
      event.condition === "Poisoned" && event.stacks === 2),
  );
});

test("Ritualist spirits attack, empower Essence Blast, and innervate", () => {
  const result = simulate("Ritualist", [
    "Ritualist's Shroud",
    "Anguish",
    "Essence Blast",
    "Innervate Anguish",
    "Exit Ritualist's Shroud",
  ], { initialResource: 50 });
  const lingering = simulate("Ritualist", [
    "Ritualist's Shroud",
    "Anguish",
    "Exit Ritualist's Shroud",
    { type: "wait", durationMs: 4000 },
  ], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.LINGERING_SPIRITS],
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.endState.profession.activeSpirits, {});
  assert.ok(result.endState.profession.lifeForce > 50);
  assert.ok(result.breakdown.some(entry => entry.name === "Essence Blast"));
  assert.equal(lingering.endState.profession.activeSpirits.anguish, true);
  assert.ok(lingering.endState.profession.lifeForce < 90);
  assert.ok(
    lingering.breakdown.some(entry =>
      entry.name === "Anguish — Spirit Attack"),
  );
});

test("Necromancer trait procs resolve from real event state", () => {
  const dhuumfire = simulate("Core", [
    "Death Shroud",
    "Life Blast",
    "End Death Shroud",
    { type: "wait", durationMs: 3100 },
  ], { selectedTraitIds: [TRAIT.DHUUMFIRE] });
  const demonicLore = simulate("Scourge", [
    "Manifest Sand Shade",
    { type: "wait", durationMs: 3100 },
  ], { selectedTraitIds: [TRAIT.DEMONIC_LORE] });
  const deathlyChill = simulate("Reaper", [
    "Reaper's Shroud",
    "Executioner's Scythe",
    "Exit Reaper's Shroud",
    { type: "wait", durationMs: 3100 },
  ], { selectedTraitIds: [TRAIT.DEATHLY_CHILL] });

  assert.ok(
    dhuumfire.resolvedEvents.some(event =>
      event.name === "Dhuumfire — Burning"),
  );
  assert.ok(
    demonicLore.resolvedEvents.some(event =>
      event.name === "Demonic Lore — Burning"),
  );
  assert.ok(
    deathlyChill.resolvedEvents.some(event =>
      event.name === "Deathly Chill — Bleeding"),
  );
});

test("trait skill replacements expose only their active variant", () => {
  const scepterBase = simulate("Core", ["Feast of Corruption"], {
    primaryWeapon: "Scepter",
  });
  const scepterTrait = simulate("Core", [
    "Feast of Corruption",
    "Devouring Darkness",
  ], {
    primaryWeapon: "Scepter",
    selectedTraitIds: [TRAIT.LINGERING_CURSE],
  });
  const scourgeTrait = simulate("Scourge", [
    "Desert Shroud",
    "Sandstorm Shroud",
    { type: "wait", durationMs: 4100 },
  ], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.HERALD_OF_SORROW],
  });

  assert.deepEqual(scepterBase.warnings, []);
  assert.match(
    scepterTrait.warnings.join(" "),
    /Feast of Corruption is unavailable/,
  );
  assert.ok(
    scepterTrait.breakdown.some(entry =>
      entry.name === "Devouring Darkness"),
  );
  assert.match(
    scourgeTrait.warnings.join(" "),
    /Desert Shroud is unavailable/,
  );
  assert.ok(
    scourgeTrait.resolvedEvents.some(event =>
      event.name === "Sandstorm Shroud"),
  );
});

test("signet passives and Soul Battery are profession-owned resources", () => {
  const signets = simulate("Core", [
    { type: "wait", durationMs: 3100 },
  ], {
    initialResource: 0,
    selectedSkills: ["Signet of Undeath", "Signet of Vampirism"],
  });
  const battery = simulate("Core", [], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.SOUL_BATTERY],
  });

  assert.equal(signets.endState.profession.lifeForce, 4);
  assert.ok(
    signets.breakdown.some(entry =>
      entry.name === "Signet of Vampirism — Passive Life Siphon"),
  );
  assert.equal(battery.endState.profession.maximumLifeForce, 120);
  assert.equal(battery.endState.profession.lifeForce, 120);
});

test("Necromancer resources and palette change with specialization state", () => {
  const harbingerResources = necromancerProfession.ui.resourceViews({
    specialization: "Harbinger",
    professionState: {
      lifeForce: 80,
      maximumLifeForce: 100,
      blight: 12,
    },
  });
  const reaperEntry = necromancerProfession.ui.paletteGroups({
    specialization: "Reaper",
    professionState: {},
  })[0].skillIds;
  const reaperBar = necromancerProfession.ui.paletteGroups({
    specialization: "Reaper",
    professionState: {
      activeShroud: "reaper",
      availableFlips: { [ID.EXIT_REAPERS_SHROUD]: Infinity },
    },
  })[0].skillIds;

  assert.deepEqual(
    harbingerResources.map(resource => resource.id),
    ["life-force", "blight"],
  );
  assert.deepEqual(reaperEntry, [ID.REAPERS_SHROUD]);
  assert.equal(reaperBar.includes(ID.LIFE_REND), true);
  assert.equal(reaperBar.includes(ID.EXIT_REAPERS_SHROUD), true);
});

test("Necromancer builds migrate and validate against canonical metadata", () => {
  const defaults = createNecromancerBuildDefaults();
  assert.deepEqual(validateNecromancerBuild(defaults), {
    valid: true,
    errors: [],
  });
  const migrated = migrateNecromancerBuild({
    weapons: ["Greatsword", "Focus"],
    initialResource: 500,
    initialBlight: -4,
    selectedSkillIds: [
      ID.SUMMON_BLOOD_FIEND,
      ID.BLOOD_IS_POWER,
      ID.LICH_FORM,
    ],
  });
  assert.deepEqual(migrated.weapons, ["Greatsword", ""]);
  assert.equal(migrated.initialResource, 120);
  assert.equal(migrated.initialBlight, 0);
  assert.equal(migrated.selectedSkills.Heal, "Summon Blood Fiend");
  assert.equal(migrated.selectedSkills.Elite, "Lich Form");
  assert.deepEqual(validateNecromancerBuild(migrated), {
    valid: true,
    errors: [],
  });
  assert.throws(
    () => migrateNecromancerBuild({ profession: "guardian" }),
    /Cannot load guardian build as Necromancer/,
  );
});

test("Necromancer is wired through the selector and application adapter", async () => {
  const page = await readFile(
    new URL("../necromancer.html", import.meta.url),
    "utf8",
  );
  assert.equal(
    professionOptions.some(option => option.id === "necromancer"),
    true,
  );
  assert.equal(professionRoute("necromancer"), "necromancer.html");
  assert.equal((await getProfession("necromancer"))?.id, "necromancer");
  assert.equal(
    (await getProfessionAppAdapter("necromancer"))?.id,
    "necromancer",
  );
  assert.match(page, /data-profession="necromancer"/);
  assert.match(page, /data-active-profession="necromancer"/);
});
