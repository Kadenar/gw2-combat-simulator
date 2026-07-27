import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionOptions,
} from "../js/app/profession-registry.js";
import { professionRoute } from "../js/app/profession-selector.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import { skillBreakdownRows } from "../js/platform/ui/result-tables.js";
import {
  buildChartSeries,
  formatResourceValue,
  weaponSkills,
} from "../js/app/rotation-ui.js";
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
} from "../js/professions/necromancer/data/necromancer-api-metadata.js";
import {
  necromancerProfession,
} from "../js/professions/necromancer/definition.js";
import {
  NECROMANCER_QUICKNESS_CAST_TIMES_MS,
} from "../js/professions/necromancer/mechanics/skill-mechanics.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../js/professions/necromancer/data/ids.js";
import {
  modifierCandidates,
  recalculate,
} from "../js/professions/necromancer/app/app-runtime.js";

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

test("measured Quickness cast times remain exact", () => {
  const expected = new Map([
    [ID.LIFE_SIPHON, 1520],
    [ID.DARK_PACT, 680],
    [ID.NECROTIC_STAB, 400],
    [ID.NECROTIC_BITE, 640],
    [ID.NECROTIC_SLASH, 360],
    [ID.LIFE_BLAST, 920],
    [ID.DARK_PATH, 880],
    [ID.LIFE_TRANSFER, 2920],
    [ID.DHUUMFIRE_BLAST, 920],
    [ID.DOOM, 600],
    [ID.CORROSIVE_POISON_CLOUD, 600],
    [ID.DEVOURING_DARKNESS, 600],
    [ID.GRASPING_DEAD, 880],
    [ID.BLOOD_CURSE, 440],
    [ID.RENDING_CURSE, 600],
    [ID.BLOOD_IS_POWER, 880],
    [ID.PLAGUELANDS, 920],
    [ID.PUTRID_CURSE, 920],
    [ID.DEATHLY_SWARM, 480],
    [ID.ENFEEBLING_BLOOD, 840],
    [ID.ELIXIR_OF_PROMISE, 680],
    [ID.ELIXIR_OF_ANGUISH, 680],
    [ID.WEEPING_SHOTS, 840],
    [ID.VICIOUS_SHOT, 560],
    [ID.DARK_BARRAGE, 920],
    [ID.VORACIOUS_ARC, 840],
    [ID.DEVOURING_CUT, 480],
    [ID.TAINTED_BOLTS, 600],
    [ID.VILE_BLAST, 600],
    [ID.ELIXIR_OF_RISK, 680],
    [ID.LOCUST_SWARM, 440],
    [ID.VITAL_DRAW, 800],
    [ID.WAIL_OF_DOOM, 1000],
    [ID.ELIXIR_OF_AMBITION, 680],
    [ID.WELL_OF_DARKNESS, 480],
    [ID.WELL_OF_SUFFERING, 480],
    [ID.NIGHTFALL, 480],
    [ID.GRASPING_DARKNESS, 520],
    [ID.LIFE_REND, 400],
    [ID.SOUL_SPIRAL, 2160],
    [ID.LIFE_SLASH, 600],
    [ID.LIFE_REAP, 560],
    [ID.GRAVEDIGGER, 1080],
    [ID.DUSK_STRIKE, 480],
    [ID.FADING_TWILIGHT, 640],
    [ID.CHILLING_SCYTHE, 920],
    [ID.DEATHS_CHARGE, 1200],
    [ID.GHASTLY_CLAWS, 1440],
    [ID.RENDING_CLAWS, 620],
    [ID.REAPERS_MARK, 520],
    [ID.CHILLBLAINS, 480],
    [ID.MARK_OF_BLOOD, 480],
    [ID.EXECUTIONERS_SCYTHE, 1320],
    [ID.NECROTIC_GRASP, 880],
    [ID.PUTRID_MARK, 480],
    [ID.TERRIFY, 320],
    [ID.SUFFER, 0],
    [ID.SIGNET_OF_SPITE, 880],
    [ID.SPINAL_SHIVERS, 800],
    [ID.MANIFEST_SAND_SHADE, 480],
    [ID.HARROWING_WAVE, 440],
    [ID.OPPRESSIVE_COLLAPSE, 600],
    [ID.SOUL_GRASP, 520],
    [ID.SIGNET_OF_VAMPIRISM, 880],
    [ID.SPECTRAL_GRASP, 600],
    [ID.FEAST_OF_CORRUPTION, 600],
  ]);

  assert.deepEqual(
    new Map(
      Object.entries(NECROMANCER_QUICKNESS_CAST_TIMES_MS)
        .map(([skillId, duration]) => [Number(skillId), duration]),
    ),
    expected,
  );
  for (const [skillId, quicknessCastTimeMs] of expected) {
    const skill = necromancerCatalog.skillsById.get(skillId);
    assert.equal(skill.quicknessCastTimeMs, quicknessCastTimeMs, skill.name);
    assert.equal(skill.castTimeMs, quicknessCastTimeMs * 1.5, skill.name);
  }
});

test("interrupt-safe Necromancer attacks retain their committed packets", () => {
  const soulSpiral = simulate("Reaper", [
    "Reaper's Shroud",
    { name: "Soul Spiral", interruptAfterMs: 120 },
  ], {
    boons: { quickness: true },
  });
  const graspingDarkness = simulate("Reaper", [
    { name: "Grasping Darkness", interruptAfterMs: 120 },
  ], {
    boons: { quickness: true },
    primaryWeapon: "Greatsword",
  });
  const fullDarkBarrage = simulate("Harbinger", [
    "Harbinger Shroud",
    "Dark Barrage",
  ], {
    boons: { quickness: true },
  });
  const interruptedDarkBarrage = simulate("Harbinger", [
    "Harbinger Shroud",
    { name: "Dark Barrage", interruptAfterMs: 800 },
  ], {
    boons: { quickness: true },
  });
  const ghastlyClaws = simulate("Core", ["Ghastly Claws"], {
    boons: { quickness: true },
    primaryWeapon: "Axe",
  });

  assert.equal(soulSpiral.steps[1].fullCastMs, 2160);
  assert.equal(
    soulSpiral.events.filter(event =>
      event.type === "damage" && event.skillId === ID.SOUL_SPIRAL).length,
    12,
  );
  assert.equal(
    soulSpiral.resolvedEvents.filter(event =>
      event.type === "condition" &&
      event.skillId === ID.SOUL_SPIRAL &&
      event.condition === "Poisoned").length,
    12,
  );
  assert.equal(graspingDarkness.steps[0].fullCastMs, 520);
  assert.equal(
    graspingDarkness.events.filter(event =>
      event.type === "damage" &&
      event.skillId === ID.GRASPING_DARKNESS).length,
    1,
  );
  assert.equal(fullDarkBarrage.steps[1].end, 920);
  assert.equal(fullDarkBarrage.steps[1].interrupted, false);
  assert.equal(interruptedDarkBarrage.steps[1].end, 800);
  assert.equal(interruptedDarkBarrage.steps[1].fullCastMs, 920);
  assert.equal(interruptedDarkBarrage.steps[1].interrupted, true);
  assert.equal(
    interruptedDarkBarrage.events.filter(event =>
      event.type === "damage" &&
      event.skillId === ID.DARK_BARRAGE).length,
    6,
  );
  assert.equal(
    interruptedDarkBarrage.breakdown.find(entry =>
      entry.name === "Dark Barrage")?.total,
    fullDarkBarrage.breakdown.find(entry =>
      entry.name === "Dark Barrage")?.total,
  );
  const ghastlyPackets = ghastlyClaws.events.filter(event =>
    event.type === "damage" && event.skillId === ID.GHASTLY_CLAWS);
  assert.equal(ghastlyClaws.steps[0].fullCastMs, 1440);
  assert.equal(ghastlyPackets.length, 8);
  assert.equal(new Set(ghastlyPackets.map(event => event.at)).size, 8);
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

test("Reaper and Harbinger shroud transitions emit the current weapon set", () => {
  for (const [specialization, enter, exit] of [
    ["Reaper", "Reaper's Shroud", "Exit Reaper's Shroud"],
    ["Harbinger", "Harbinger Shroud", "Exit Harbinger Shroud"],
  ]) {
    const result = simulate(specialization, [enter, exit], {
      initialResource: 100,
      weaponSet2Primary: "Scepter",
      startingWeaponSet: 2,
    });

    assert.deepEqual(
      result.events
        .filter(event => event.type === "weapon_set")
        .map(event => event.weaponSet),
      [2, 2],
      specialization,
    );
  }
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

  assert.equal(ammo.endState.profession.shades.length, 2);
  assert.equal(ammo.endState.profession.lifeForce, 100);
  assert.equal(ammo.steps[3].start, 15720);
  assert.deepEqual(ammo.warnings, []);
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
  const lateExit = simulate("Harbinger", [
    "Harbinger Shroud",
    { type: "wait", durationMs: 11_000 },
    "Exit Harbinger Shroud",
  ], { initialResource: 100 });

  assert.equal(generated.endState.profession.blight, 6);
  assert.equal(consumed.endState.profession.blight, 0);
  assert.ok(
    consumed.resolvedEvents.some(event =>
      event.condition === "Torment" && event.stacks === 5),
  );
  assert.equal(expired.endState.profession.blight, 0);
  assert.deepEqual(lateExit.warnings, []);
  assert.equal(lateExit.endState.profession.activeShroud, "");
});

test("shroud strikes use their fixed or equipped weapon strengths", () => {
  const core = simulate("Core", ["Death Shroud", "Life Blast"], {
    initialResource: 100,
    primaryWeapon: "Pistol",
  });
  const reaper = simulate("Reaper", ["Reaper's Shroud", "Life Rend"], {
    initialResource: 100,
    primaryWeapon: "Pistol",
  });
  const harbinger = simulate("Harbinger", [
    "Harbinger Shroud",
    "Devouring Cut",
  ], {
    initialResource: 100,
    primaryWeapon: "Pistol",
  });
  const scourge = simulate("Scourge", ["Manifest Sand Shade"], {
    initialResource: 100,
    primaryWeapon: "Pistol",
  });
  const ritualist = simulate("Ritualist", [
    "Ritualist's Shroud",
    "Essence Blast",
    "Anguish",
    "Summon Spirits",
  ], {
    initialResource: 100,
    primaryWeapon: "Pistol",
    weaponSet2Primary: "Scepter",
    startingWeaponSet: 2,
  });
  const damage = (result, name) => result.resolvedEvents.find(event =>
    event.type === "damage" && event.name === name);

  assert.equal(damage(core, "Life Blast").skillWeapon, "Hammer");
  assert.equal(damage(reaper, "Life Rend").skillWeapon, "Hammer");
  assert.equal(damage(harbinger, "Devouring Cut").skillWeapon, "Hammer");
  assert.equal(
    scourge.resolvedEvents.find(event =>
      event.type === "damage"
      && event.skillId === ID.MANIFEST_SAND_SHADE)?.skillWeapon,
    "Unequipped",
  );
  assert.equal(damage(ritualist, "Essence Blast").skillWeapon, "Scepter");
  assert.equal(damage(ritualist, "Anguish").skillWeapon, "Unequipped");
  assert.equal(damage(ritualist, "Summon Spirits").skillWeapon, "Hammer");
});

test("Harbinger shroud attacks use their Blight thresholds and coefficients", () => {
  const run = (skill, initialBlight) => simulate("Harbinger", [
    "Harbinger Shroud",
    skill,
    "Exit Harbinger Shroud",
    { type: "wait", durationMs: 7100 },
  ], {
    initialResource: 100,
    initialBlight,
  });
  const baseCut = run("Devouring Cut", 0);
  const empoweredCut = run("Devouring Cut", 5);
  const baseArc = run("Voracious Arc", 0);
  const empoweredArc = run("Voracious Arc", 5);
  const vitalDraw = run("Vital Draw", 0);
  const darkBarrage = run("Dark Barrage", 0);
  const strikeCoefficients = (result, skillId) => result.resolvedEvents
    .filter(event => event.type === "damage" && event.skillId === skillId)
    .map(event => event.coefficient);

  assert.deepEqual(strikeCoefficients(baseCut, ID.DEVOURING_CUT), [1]);
  assert.deepEqual(strikeCoefficients(empoweredCut, ID.DEVOURING_CUT), [2]);
  assert.deepEqual(strikeCoefficients(baseArc, ID.VORACIOUS_ARC), [1.4]);
  assert.deepEqual(strikeCoefficients(empoweredArc, ID.VORACIOUS_ARC), [2.8]);
  const vitalDrawCoefficients = strikeCoefficients(vitalDraw, ID.VITAL_DRAW);
  const darkBarrageCoefficients =
    strikeCoefficients(darkBarrage, ID.DARK_BARRAGE);
  assert.equal(vitalDrawCoefficients.length, 3);
  assert.ok(
    Math.abs(vitalDrawCoefficients.reduce((sum, value) => sum + value, 0) - 1.2)
      < 1e-12,
  );
  assert.equal(darkBarrageCoefficients.length, 6);
  assert.ok(
    Math.abs(darkBarrageCoefficients
      .reduce((sum, value) => sum + value, 0) - 3.6) < 1e-12,
  );
  assert.equal(empoweredCut.endState.profession.blight, 0);
  assert.equal(
    empoweredArc.events.some(event =>
      event.type === "necromancer.state"
      && event.reason === "blight-skill"
      && event.state.blight === 0),
    true,
  );
  // The 1.26-second Arc cast generates two new Blight before shroud exit.
  assert.equal(empoweredArc.endState.profession.blight, 2);
  assert.equal(
    empoweredCut.resolvedEvents.some(event =>
      event.condition === "Torment"
      && event.stacks === 5
      && event.duration === 5),
    true,
  );
  assert.equal(
    empoweredArc.resolvedEvents.some(event =>
      event.condition === "Torment"
      && event.stacks === 5
      && event.duration === 7),
    true,
  );
  assert.equal(
    empoweredArc.events.some(event =>
      event.type === "control"
      && event.controlKind === "daze"
      && event.duration === 0.5),
    true,
  );
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

test("Blood Is Power and Plague Signet preserve transferred conditions", () => {
  const result = simulate("Harbinger", [
    "Blood Is Power",
    "Plague Signet",
    { type: "wait", durationMs: 10_100 },
  ], {
    selectedSkills: ["Blood Is Power", "Plague Signet"],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION],
  });
  const transferred = result.resolvedEvents.filter(event =>
    event.transferredCondition);

  assert.deepEqual(result.warnings, []);
  assert.equal(
    transferred.some(event =>
      event.condition === "Bleeding" && event.stacks === 2),
    true,
  );
  assert.equal(
    transferred.some(event =>
      event.condition === "Torment" && event.stacks === 2),
    true,
  );
  assert.deepEqual(result.endState.profession.selfConditions, []);
  assert.equal(
    transferred.every(event =>
      Math.abs(event.effectiveDuration - 10) < 0.0001),
    true,
  );
});

test("Dhuumfire uses the specialization duration split and Scourge ICD", () => {
  const core = simulate("Core", [
    "Death Shroud",
    "Life Blast",
    "End Death Shroud",
  ], { selectedTraitIds: [TRAIT.DHUUMFIRE] });
  const harbinger = simulate("Harbinger", [
    "Harbinger Shroud",
    "Tainted Bolts",
    "Exit Harbinger Shroud",
  ], { selectedTraitIds: [TRAIT.DHUUMFIRE] });
  const scourge = simulate("Scourge", [
    "Manifest Sand Shade",
    "Garish Pillar",
    { type: "wait", durationMs: 1100 },
    "Sand Cascade",
  ], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DHUUMFIRE],
  });
  const applications = result => result.resolvedEvents
    .filter(event =>
      event.sourceId === TRAIT.DHUUMFIRE
      && event.condition === "Burning");

  assert.deepEqual(applications(core).map(event => event.duration), [3]);
  assert.deepEqual(
    applications(harbinger).map(event => event.duration),
    [1, 1],
  );
  assert.deepEqual(
    applications(scourge).map(event => event.duration),
    [2, 2],
  );
  assert.ok(applications(scourge)[1].at - applications(scourge)[0].at >= 1);
});

test("requested Harbinger damage traits apply at their per-hit triggers", () => {
  const result = simulate("Harbinger", [
    "Harbinger Shroud",
    "Tainted Bolts",
    "Dark Barrage",
    "Vital Draw",
    "Exit Harbinger Shroud",
    { type: "wait", durationMs: 3100 },
  ], {
    initialResource: 100,
    initialBlight: 10,
    selectedTraitIds: [
      TRAIT.DHUUMFIRE,
      TRAIT.UNYIELDING_BLAST,
      TRAIT.SEPTIC_CORRUPTION,
      TRAIT.INSIDIOUS_DISRUPTION,
    ],
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.sourceId === TRAIT.DHUUMFIRE &&
      event.condition === "Burning").length,
    2,
  );
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.skillId === ID.TAINTED_BOLTS &&
      event.condition === "Torment").length,
    2,
  );
  assert.equal(
    result.procSteps.filter(step =>
      step.skill === "Unyielding Blast").length,
    1,
  );
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.sourceId === TRAIT.SEPTIC_CORRUPTION &&
      event.condition === "Poisoned").length,
    6,
  );
  assert.equal(
    result.resolvedEvents.some(event =>
      event.sourceId === TRAIT.INSIDIOUS_DISRUPTION &&
      event.condition === "Torment"),
    true,
  );
});

test("Barbed Precision uses a three-second base bleed", () => {
  const result = simulate("Harbinger", [
    "Weeping Shots",
    { type: "wait", durationMs: 4100 },
  ], {
    primaryWeapon: "Pistol",
    stats: { precision: 4000 },
    selectedTraitIds: [TRAIT.BARBED_PRECISION],
  });
  const application = result.resolvedEvents.find(event =>
    event.sourceId === TRAIT.BARBED_PRECISION
    && event.condition === "Bleeding");

  assert.equal(application.duration, 3);
  assert.ok(Math.abs(application.effectiveDuration - 3.6) < 1e-12);
});

test("Devouring Darkness scales torment with distinct target conditions", () => {
  const result = simulate("Core", [
    "Devouring Darkness",
    { type: "wait", durationMs: 4100 },
  ], {
    primaryWeapon: "Scepter",
    selectedTraitIds: [TRAIT.LINGERING_CURSE],
    target: {
      conditions: {
        Bleeding: true,
        Burning: true,
        Chilled: true,
        Poisoned: true,
        Torment: true,
        Vulnerability: 25,
      },
    },
  });
  const application = result.resolvedEvents.find(event =>
    event.skillId === ID.DEVOURING_DARKNESS &&
    event.condition === "Torment");

  assert.deepEqual(result.warnings, []);
  assert.equal(application?.stacks, 5);
  assert.equal(application?.effectiveDuration, 6);
});

test("current Harbinger grandmaster traits use their live PvE mechanics", () => {
  const cascading = simulate("Harbinger", [
    "Elixir of Promise",
    "Elixir of Risk",
    "Elixir of Ambition",
    { type: "wait", durationMs: 6100 },
  ], {
    initialBlight: 25,
    selectedSkills: [
      "Elixir of Promise",
      "Elixir of Risk",
      "Elixir of Ambition",
    ],
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION],
  });
  const precombat = simulate("Harbinger", [
    "Elixir of Promise",
    { name: "__combat_start" },
    "Elixir of Risk",
    "Elixir of Ambition",
    { type: "wait", durationMs: 6100 },
  ], {
    initialBlight: 25,
    selectedSkills: [
      "Elixir of Promise",
      "Elixir of Risk",
      "Elixir of Ambition",
    ],
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION],
  });
  const deathlyHaste = simulate("Harbinger", [
    "Harbinger Shroud",
    "Dark Barrage",
    "Exit Harbinger Shroud",
  ], {
    selectedTraitIds: [TRAIT.DEATHLY_HASTE],
  });
  const doom = simulate("Harbinger", [
    "Harbinger Shroud",
    "Tainted Bolts",
    "Dark Barrage",
    "Exit Harbinger Shroud",
    { type: "wait", durationMs: 3100 },
  ], {
    selectedTraitIds: [TRAIT.DOOM_APPROACHES],
  });

  assert.deepEqual(cascading.warnings, []);
  const cascadingStrike = cascading.resolvedEvents.find(event =>
    event.type === "damage" &&
    event.sourceId === TRAIT.CASCADING_CORRUPTION);
  const cascadingTorment = cascading.resolvedEvents.find(event =>
    event.type === "condition" &&
    event.sourceId === TRAIT.CASCADING_CORRUPTION);
  assert.deepEqual(
    {
      skillId: cascadingStrike?.skillId,
      skillName: cascadingStrike?.skillName,
      parentSkillName: cascadingStrike?.parentSkillName,
    },
    {
      skillId: ID.CASCADING_CORRUPTION,
      skillName: "Cascading Corruption",
      parentSkillName: "Elixir of Ambition",
    },
  );
  assert.deepEqual(
    {
      name: cascadingTorment?.name,
      skillId: cascadingTorment?.skillId,
      skillName: cascadingTorment?.skillName,
      parentSkillName: cascadingTorment?.parentSkillName,
      condition: cascadingTorment?.condition,
      stacks: cascadingTorment?.stacks,
      effectiveDuration: cascadingTorment?.effectiveDuration,
    },
    {
      name: "Cascading Corruption — Torment",
      skillId: ID.CASCADING_CORRUPTION,
      skillName: "Cascading Corruption",
      parentSkillName: "Elixir of Ambition",
      condition: "Torment",
      stacks: 6,
      effectiveDuration: 6,
    },
  );
  const cascadingRow = skillBreakdownRows(cascading)
    .find(row => row.name === "Cascading Corruption");
  assert.ok(cascadingRow?.strike > 0);
  assert.ok(cascadingRow?.condition > 0);
  assert.equal(cascadingRow?.hits, 1);
  assert.equal(cascadingRow?.casts, 0);
  assert.equal(cascadingRow?.parentSkill, "Elixir of Ambition");
  const meltdown = cascading.procSteps.find(step => step.skill === "Meltdown");
  assert.equal(
    meltdown?.icon,
    "https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png",
  );
  assert.equal(
    precombat.breakdown.some(entry =>
      entry.name === "Cascading Corruption"),
    false,
  );
  assert.equal(
    deathlyHaste.events.filter(event =>
      event.kind === "quickness" &&
      event.sourceId !== TRAIT.SOUL_BARBS).length,
    2,
  );
  assert.equal(
    doom.events.filter(event =>
      event.type === "damage" &&
      event.skillId === ID.DARK_BARRAGE).length,
    8,
  );
  assert.equal(
    doom.procSteps.some(step => step.skill === "Doom Approaches"),
    true,
  );
});

test("Soul Barbs and Dark Gunslinger change their documented outputs", () => {
  const soulBarbs = simulate("Harbinger", [
    "Harbinger Shroud",
    "Tainted Bolts",
    "Exit Harbinger Shroud",
  ], {
    selectedTraitIds: [TRAIT.SOUL_BARBS],
  });
  const basePistol = simulate("Harbinger", [
    "Vile Blast",
    "Vile Blast",
  ], {
    primaryWeapon: "Pistol",
  });
  const gunslinger = simulate("Harbinger", [
    "Vile Blast",
    "Vile Blast",
  ], {
    primaryWeapon: "Pistol",
    selectedTraitIds: [TRAIT.DARK_GUNSLINGER],
  });

  assert.equal(
    soulBarbs.events.filter(event =>
      event.kind === "necromancer-soul-barbs").length,
    2,
  );
  assert.deepEqual(
    soulBarbs.events
      .filter(event => event.kind === "necromancer-soul-barbs")
      .map(event => event.duration),
    [15, 15],
  );
  const soulBarbsSeries = buildChartSeries(soulBarbs, 100)
    .effects["Soul Barbs"];
  assert.ok(soulBarbsSeries.some(point => point.v === 1));
  assert.ok(soulBarbsSeries.every(point => point.v === 0 || point.v === 1));
  assert.ok(gunslinger.steps[1].start < basePistol.steps[1].start);
  const gunslingerPoison = gunslinger.resolvedEvents.find(event =>
    event.skillId === ID.VILE_BLAST
    && event.condition === "Poisoned");
  assert.ok(Math.abs(gunslingerPoison.effectiveDuration - 6.496) < 1e-12);
});

test("cross-specialization Necromancer trait triggers remain executable", () => {
  const spite = simulate("Core", [
    "Death Shroud",
    "Life Blast",
    "End Death Shroud",
  ], {
    selectedTraitIds: [
      TRAIT.REAPERS_MIGHT,
      TRAIT.WEAKENING_SHROUD,
    ],
  });
  const reaper = simulate("Reaper", [
    "Reaper's Shroud",
    "Soul Spiral",
    "Exit Reaper's Shroud",
    { type: "wait", durationMs: 8100 },
  ], {
    selectedTraitIds: [TRAIT.TRANSFUSION],
  });
  const fear = simulate("Reaper", [
    "Reaper's Mark",
    { type: "wait", durationMs: 2100 },
  ], {
    primaryWeapon: "Staff",
    selectedTraitIds: [
      TRAIT.SHIVERS_OF_DREAD,
      TRAIT.BITTER_CHILL,
      TRAIT.TERROR,
    ],
  });
  const malicious = simulate("Core", [
    "Summon Blood Fiend",
  ], {
    selectedSkills: ["Summon Blood Fiend"],
    selectedTraitIds: [TRAIT.MALICIOUS_SWARM],
  });
  const ashes = simulate("Harbinger", [
    "Harrowing Wave",
  ], {
    initialResource: 0,
    primaryWeapon: "Pistol",
    secondaryWeapon: "Torch",
    selectedTraitIds: [TRAIT.NOURISHING_ASHES],
  });

  assert.equal(
    spite.procSteps.some(step => step.skill === "Reaper's Might"),
    true,
  );
  assert.equal(
    spite.breakdown.some(entry => entry.name === "Weakening Shroud"),
    true,
  );
  assert.equal(
    reaper.breakdown.some(entry => entry.name === "Lesser Chilblains"),
    true,
  );
  assert.equal(
    fear.procSteps.some(step => step.skill === "Bitter Chill"),
    true,
  );
  assert.equal(
    fear.resolvedEvents.some(event =>
      event.sourceId === TRAIT.TERROR && event.condition === "Fear"),
    true,
  );
  assert.ok(fear.conditionDamage > 0);
  assert.equal(
    malicious.breakdown.some(entry =>
      entry.name === "Lesser Signet of the Locust"),
    true,
  );
  assert.equal(ashes.endState.profession.lifeForce, 10);
});

test("remaining outgoing Necromancer trait families affect combat state", () => {
  const carapaceBase = simulate("Core", [
    "Blood Curse",
    "Rending Curse",
  ], {
    primaryWeapon: "Scepter",
  });
  const carapace = simulate("Core", [
    "Blood Curse",
    "Rending Curse",
  ], {
    primaryWeapon: "Scepter",
    selectedTraitIds: [
      TRAIT.CORRUPTERS_FERVOR,
      TRAIT.DEADLY_STRENGTH,
    ],
  });
  const armored = simulate("Core", [
    "Death Shroud",
    "Life Blast",
  ], {
    selectedTraitIds: [
      TRAIT.ARMORED_SHROUD,
      TRAIT.DEADLY_STRENGTH,
    ],
  });
  const augury = simulate("Reaper", ["\"Suffer!\""], {
    selectedSkills: ["\"Suffer!\""],
    selectedTraitIds: [TRAIT.AUGURY_OF_DEATH],
  });
  const signet = simulate("Core", ["Signet of Spite"], {
    selectedSkills: ["Signet of Spite"],
    selectedTraitIds: [TRAIT.SIGNETS_OF_SUFFERING],
  });
  const thirst = simulate("Core", [
    "Necrotic Slash",
    "Necrotic Stab",
  ], {
    primaryWeapon: "Dagger",
    selectedTraitIds: [TRAIT.OVERFLOWING_THIRST],
  });
  const brew = simulate("Harbinger", ["Elixir of Risk"], {
    selectedSkills: ["Elixir of Risk"],
    selectedTraitIds: [TRAIT.BOLSTERING_BREW],
  });
  const empowerment = simulate("Scourge", ["Manifest Sand Shade"], {
    selectedTraitIds: [TRAIT.DESERT_EMPOWERMENT],
  });

  assert.ok(carapace.strikeDamage > carapaceBase.strikeDamage);
  assert.ok(
    armored.endState.profession.carapaceExpiries.length >= 5,
  );
  assert.equal(
    augury.breakdown.some(entry => entry.name === "Augury of Death"),
    true,
  );
  assert.equal(
    signet.breakdown.some(entry => entry.name === "Signets of Suffering"),
    true,
  );
  assert.equal(
    thirst.breakdown.some(entry => entry.name === "Taste for Blood"),
    true,
  );
  assert.equal(
    brew.events.some(event =>
      event.kind === "protection" &&
      event.skillId === ID.ELIXIR_OF_RISK),
    true,
  );
  assert.equal(
    empowerment.events.some(event =>
      event.kind === "alacrity" &&
      event.skillId === ID.MANIFEST_SAND_SHADE),
    true,
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

test("Corrupted Talent owns the Harbinger shroud-entry life-force gain", () => {
  const withoutTrait = simulate("Harbinger", [
    "Harbinger Shroud",
  ], {
    initialResource: 0,
  });
  const withTrait = simulate("Harbinger", [
    "Harbinger Shroud",
  ], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.CORRUPTED_TALENT],
  });

  assert.equal(withoutTrait.endState.profession.lifeForce, 0);
  assert.equal(withTrait.endState.profession.lifeForce, 15);
});

test("modifier candidates exclude structural traits", () => {
  const build = createNecromancerBuildDefaults();
  const app = {
    build,
    skillByName: necromancerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);

  const activeTraitNames = new Set(
    app.attributeData.activeTraits.map(trait => trait.name),
  );
  const candidateNames = new Set(
    modifierCandidates(app).map(candidate => candidate.name),
  );

  assert.equal(activeTraitNames.has("Dark Disciple"), true);
  assert.equal(activeTraitNames.has("Corrupted Talent"), true);
  assert.equal(candidateNames.has("Dark Disciple"), false);
  assert.equal(candidateNames.has("Corrupted Talent"), true);
  assert.equal(candidateNames.has("Gluttony"), true);
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
  const eternal = simulate("Core", [
    { type: "wait", durationMs: 4100 },
  ], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE],
  });
  const eternalCap = simulate("Core", [
    { type: "wait", durationMs: 70_100 },
  ], {
    initialResource: 0,
    selectedTraitIds: [TRAIT.ETERNAL_LIFE],
  });
  const perception = simulate("Core", [
    "Death Shroud",
    "Life Blast",
    "End Death Shroud",
    "Blood Curse",
  ], {
    initialResource: 100,
    primaryWeapon: "Scepter",
    selectedTraitIds: [TRAIT.DEATH_PERCEPTION],
  });

  assert.equal(signets.endState.profession.lifeForce, 4);
  assert.ok(
    signets.breakdown.some(entry =>
      entry.name === "Signet of Vampirism — Passive Life Siphon"),
  );
  assert.equal(battery.endState.profession.maximumLifeForce, 120);
  assert.equal(battery.endState.profession.lifeForce, 120);
  assert.equal(eternal.endState.profession.lifeForce, 12);
  assert.equal(eternalCap.endState.profession.lifeForce, 66);
  const lifeBlast = perception.resolvedEvents.find(event =>
    event.type === "damage" && event.skillId === ID.LIFE_BLAST);
  const bloodCurse = perception.resolvedEvents.find(event =>
    event.type === "damage" && event.skillId === ID.BLOOD_CURSE);
  assert.ok(Math.abs(lifeBlast.criticalChance - 0.6761904761904762) < 1e-12);
  assert.ok(Math.abs(lifeBlast.criticalDamage - 1.9333333333333333) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalChance - 0.5261904761904762) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalDamage - 1.8333333333333333) < 1e-12);
});

test("critical sigils follow the active weapon set", () => {
  const result = simulate("Harbinger", [
    "Vile Blast",
    "Swap Weapons",
    "Grasping Dead",
    { type: "wait", durationMs: 2100 },
  ], {
    primaryWeapon: "Pistol",
    secondaryWeapon: "Torch",
    weaponSet2Primary: "Scepter",
    weaponSet2Secondary: "Dagger",
    stats: { precision: 4000 },
    sigilSets: [
      { names: ["Torment"], strike: 1, condition: 1 },
      { names: ["Earth"], strike: 1, condition: 1 },
    ],
  });

  assert.equal(
    result.procSteps.some(step => step.skill === "Sigil of Torment"),
    true,
  );
  assert.equal(
    result.procSteps.some(step => step.skill === "Sigil of Earth"),
    true,
  );
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
  });

  assert.deepEqual(
    harbingerResources.map(resource => resource.id),
    ["life-force", "blight"],
  );
  assert.deepEqual(reaperEntry, [ID.REAPERS_SHROUD]);
  assert.equal(reaperBar[0].skillIds.includes(ID.EXIT_REAPERS_SHROUD), true);
  assert.equal(reaperBar[1].skillIds.includes(ID.LIFE_REND), true);
  assert.equal(
    necromancerProfession.ui.isPaletteSkillAvailable(
      {
        specialization: "Reaper",
        professionState: {},
      },
      necromancerCatalog.skillsById.get(ID.LIFE_REND),
    ),
    false,
  );
  assert.equal(formatResourceValue(113.89999999999999), "113.9");
});

test("slot skills are inaccessible in transformed shrouds", () => {
  const slotSkill = necromancerCatalog.skillsById.get(ID.BLOOD_IS_POWER);
  for (const [specialization, shroud, entry] of [
    ["Core", "death", "Death Shroud"],
    ["Reaper", "reaper", "Reaper's Shroud"],
    ["Harbinger", "harbinger", "Harbinger Shroud"],
    ["Ritualist", "ritualist", "Ritualist's Shroud"],
  ]) {
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(
        {
          specialization,
          professionState: { activeShroud: shroud },
        },
        slotSkill,
      ),
      false,
      specialization,
    );
    const result = simulate(specialization, [entry, "Blood Is Power"], {
      initialResource: 100,
      selectedSkills: ["Blood Is Power"],
    });
    assert.match(
      result.warnings.join(" "),
      /Blood Is Power is unavailable/,
      specialization,
    );
  }
  assert.equal(
    necromancerProfession.ui.isPaletteSkillAvailable(
      {
        specialization: "Scourge",
        professionState: { activeShroud: "" },
      },
      slotSkill,
    ),
    true,
  );
});

test("Harbinger can equip torch skills through Weaponmaster Training", async () => {
  const adapter = await loadProfessionAppAdapter("necromancer");
  const skills = weaponSkills({
    adapter,
    skills: necromancerCatalog.skills,
    build: {
      specialization: "Harbinger",
      weapons: ["Pistol", "Torch"],
      alternateWeapons: ["Scepter", "Dagger"],
      specializations: [
        { name: "Curses", traits: "1-1-3" },
        { name: "Harbinger", traits: "3-3-1" },
      ],
    },
    weaponData: {
      Pistol: { wielding: "1h" },
      Torch: { wielding: "1h" },
      Scepter: { wielding: "1h" },
      Dagger: { wielding: "1h" },
    },
  });

  assert.equal(skills.some(skill => skill.name === "Harrowing Wave"), true);
  assert.equal(
    skills.some(skill => skill.name === "Oppressive Collapse"),
    true,
  );
  const scepterSkills = weaponSkills({
    adapter,
    skills: necromancerCatalog.skills,
    build: {
      specialization: "Harbinger",
      weapons: ["Pistol", "Torch"],
      alternateWeapons: ["Scepter", "Dagger"],
      specializations: [{ name: "Curses", traits: "1-1-3" }],
    },
    weaponData: {
      Pistol: { wielding: "1h" },
      Torch: { wielding: "1h" },
      Scepter: { wielding: "1h" },
      Dagger: { wielding: "1h" },
    },
  }, 2);
  assert.equal(
    scepterSkills.some(skill => skill.name === "Devouring Darkness"),
    true,
  );
  assert.equal(
    scepterSkills.some(skill => skill.name === "Feast of Corruption"),
    false,
  );
  assert.equal(
    adapter.isSkillAvailable(
      necromancerCatalog.skillsById.get(ID.FEAST_OF_CORRUPTION),
      { specialization: "Harbinger", build: { specializations: [] } },
    ),
    true,
  );
  assert.equal(
    adapter.isSkillAvailable(
      necromancerCatalog.skillsById.get(ID.DEVOURING_DARKNESS),
      { specialization: "Harbinger", build: { specializations: [] } },
    ),
    false,
  );
  const torchRotation = simulate("Harbinger", [
    "Harrowing Wave",
    "Oppressive Collapse",
    { type: "wait", durationMs: 4100 },
  ], {
    primaryWeapon: "Pistol",
    secondaryWeapon: "Torch",
  });
  assert.deepEqual(torchRotation.warnings, []);
  assert.equal(
    torchRotation.breakdown.some(entry => entry.name === "Harrowing Wave"),
    true,
  );
  assert.equal(
    torchRotation.breakdown.some(entry =>
      entry.name === "Oppressive Collapse"),
    true,
  );
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
  assert.equal((await loadProfession("necromancer"))?.id, "necromancer");
  assert.equal(
    (await loadProfessionAppAdapter("necromancer"))?.id,
    "necromancer",
  );
  assert.match(page, /data-profession="necromancer"/);
  assert.match(page, /data-active-profession="necromancer"/);
});
