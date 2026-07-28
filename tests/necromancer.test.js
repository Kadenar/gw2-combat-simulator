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
  runSimulation,
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
  for (const name of [
    "Corrupt Boon",
    "Spectral Ring",
    "Epidemic",
    "Summon Flesh Wurm",
    "Necrotic Traversal",
  ]) {
    assert.equal(necromancerCatalog.skillsByName.has(name), false, name);
  }
  assert.deepEqual(
    necromancerCatalog.specializations
      .filter(specialization => specialization.elite)
      .map(specialization => specialization.name),
    ["Reaper", "Scourge", "Harbinger", "Ritualist"],
  );
});

test("measured Quickness cast times remain exact", () => {
  const expected = new Map([
    [ID.LIFE_SIPHON, 560],
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
    [ID.DEATH_SPIRAL, 720],
    [ID.ELIXIR_OF_PROMISE, 680],
    [ID.ELIXIR_OF_ANGUISH, 680],
    [ID.WEEPING_SHOTS, 840],
    [ID.VICIOUS_SHOT, 560],
    [ID.DARK_BARRAGE, 920],
    [ID.VORACIOUS_ARC, 840],
    [ID.DEVOURING_CUT, 480],
    [ID.TAINTED_BOLTS, 600],
    [ID.VILE_BLAST, 600],
    [ID.ADDLE, 360],
    [ID.EXTIRPATE, 840],
    [ID.DARK_SLASH, 600],
    [ID.ISOLATE, 480],
    [ID.PERFORATE, 840],
    [ID.HUNGERING_MAELSTROM, 640],
    [ID.GORMANDIZE, 440],
    [ID.DEVOURING_VISAGE, 680],
    [ID.CONSUME, 520],
    [ID.DEADLY_SLICE, 520],
    [ID.SINISTER_STAB, 560],
    [ID.ELIXIR_OF_RISK, 540],
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
    { type: "wait", durationMs: 2000 },
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
  const executionersScythe = simulate("Reaper", [
    "Reaper's Shroud",
    { name: "Executioner's Scythe", interruptAfterMs: 920 },
  ], {
    boons: { quickness: true },
  });
  const lifeReap = simulate("Reaper", [
    "Reaper's Shroud",
    "Life Rend",
    "Life Slash",
    { name: "Life Reap", interruptAfterMs: 360 },
  ], {
    boons: { quickness: true },
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
  const graspingDarknessHit = graspingDarkness.events.find(event =>
    event.type === "damage"
    && event.skillId === ID.GRASPING_DARKNESS);
  assert.equal(
    Math.round(
      graspingDarknessHit.at * 1000
      - graspingDarkness.steps[0].start,
    ),
    1440,
  );
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
  assert.equal(
    executionersScythe.events.filter(event =>
      event.type === "damage" &&
      event.skillId === ID.EXECUTIONERS_SCYTHE).length,
    1,
  );
  assert.equal(
    lifeReap.events.filter(event =>
      event.type === "damage" && event.skillId === ID.LIFE_REAP).length,
    1,
  );
});

test("Grasping Darkness commits at 120 ms and lands after combat starts", () => {
  const beforeCommit = simulate("Reaper", [
    { name: "Grasping Darkness", interruptAfterMs: 119 },
    { type: "wait", durationMs: 2000 },
  ], {
    boons: { quickness: true },
    initialResource: 0,
    primaryWeapon: "Greatsword",
  });
  const committed = simulate("Reaper", [
    { name: "Grasping Darkness", interruptAfterMs: 120 },
    { type: "wait", durationMs: 2000 },
  ], {
    boons: { quickness: true },
    initialResource: 0,
    primaryWeapon: "Greatsword",
  });
  const opener = simulate("Reaper", [
    { name: "Grasping Darkness", interruptAfterMs: 120 },
    "Nightfall",
    { name: "__combat_start", offset: 400 },
    { type: "wait", durationMs: 2000 },
  ], {
    boons: { quickness: true },
    initialResource: 0,
    primaryWeapon: "Greatsword",
  });
  const graspingEvents = result => result.events.filter(event =>
    event.skillId === ID.GRASPING_DARKNESS
    && ["damage", "necromancer.chill", "control"].includes(event.type));
  const openerHit = opener.resolvedEvents.find(event =>
    event.type === "damage"
    && event.skillId === ID.GRASPING_DARKNESS);
  const combatStart = opener.events.find(event =>
    event.type === "combat_start");

  assert.deepEqual(graspingEvents(beforeCommit), []);
  assert.deepEqual(
    graspingEvents(committed).map(event => Math.round(event.at * 1000)),
    [1440, 1440, 1440],
  );
  assert.equal(committed.endState.profession.lifeForce, 10);
  assert.equal(Math.round(combatStart.at * 1000), 520);
  assert.equal(Math.round(openerHit.at * 1000), 1440);
  assert.ok(openerHit.at > combatStart.at);
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

test("Death and Reaper shrouds drain a percentage of the maximum life-force pool", () => {
  const drainAfterOneSecond = (specialization, enter, exit) =>
    simulate(specialization, [
      enter,
      { type: "wait", durationMs: 1000 },
      exit,
    ], {
      initialResource: 100,
      selectedTraitIds: [TRAIT.SOUL_BATTERY],
    }).endState.profession.lifeForce;

  assert.equal(
    drainAfterOneSecond("Core", "Death Shroud", "End Death Shroud"),
    116.4,
  );
  assert.equal(
    drainAfterOneSecond(
      "Reaper",
      "Reaper's Shroud",
      "Exit Reaper's Shroud",
    ),
    115.2,
  );
});

test("life-force capacity is 69% of health and Soul Battery increases it by 20%", () => {
  const base = simulate("Core", [], {
    initialResource: 100,
    stats: { vitality: 1000 },
  }).endState.profession;
  const battery = simulate("Core", [], {
    initialResource: 100,
    stats: { vitality: 1000 },
    selectedTraitIds: [TRAIT.SOUL_BATTERY],
  }).endState.profession;

  assert.equal(base.maximumHealth, 19212);
  assert.equal(base.lifeForcePoolCapacity, 19212 * 0.69);
  assert.equal(
    battery.lifeForcePoolCapacity,
    base.lifeForcePoolCapacity * 1.2,
  );
});

test("Reaper greatsword chain is ordered and Chilling Scythe recharges Gravedigger", async () => {
  const adapter = await loadProfessionAppAdapter("necromancer");
  const skills = weaponSkills({
    adapter,
    skills: necromancerCatalog.skills,
    build: {
      specialization: "Reaper",
      weapons: ["Greatsword", ""],
      alternateWeapons: ["Axe", "Focus"],
      specializations: [{ name: "Reaper", traits: "1-1-1" }],
    },
    weaponData: {
      Greatsword: { wielding: "2h" },
      Axe: { wielding: "1h" },
      Focus: { wielding: "1h" },
    },
  });
  const result = simulate("Reaper", [
    "Gravedigger",
    "Dusk Strike",
    "Fading Twilight",
    "Chilling Scythe",
    "Gravedigger",
  ], {
    primaryWeapon: "Greatsword",
    target: { conditions: {} },
  });

  assert.deepEqual(
    skills
      .filter(skill => skill.chainRoot === ID.DUSK_STRIKE)
      .map(skill => skill.name),
    ["Dusk Strike", "Fading Twilight", "Chilling Scythe"],
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.steps.filter(step => step.skill === "Gravedigger").length,
    2,
  );
  assert.equal(
    result.events.some(event =>
      event.type === "necromancer.chill"
      && event.skillName === "Chilling Scythe"
      && event.duration === 2
    ),
    true,
  );
});

test("Gravedigger fully recharges when it hits below 50% target health", () => {
  const setup = simulate("Reaper", ["Dusk Strike"], {
    primaryWeapon: "Greatsword",
    target: { health: 0, conditions: {} },
  });
  const result = simulate("Reaper", [
    "Dusk Strike",
    "Gravedigger",
    "Gravedigger",
  ], {
    primaryWeapon: "Greatsword",
    target: {
      health: setup.totalDamage * 1.5,
      conditions: {},
    },
  });
  const gravediggers = result.steps.filter(
    step => step.skill === "Gravedigger",
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(gravediggers.length, 2);
  assert.equal(gravediggers[1].start, gravediggers[0].end);
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

test("Blight skills pay their cost before Wicked Corruption and elixirs", () => {
  const run = (skill, selectedTraitIds = []) => simulate("Harbinger", [
    "Harbinger Shroud",
    skill,
    "Exit Harbinger Shroud",
    "Elixir of Risk",
  ], {
    initialBlight: 25,
    selectedSkills: ["Elixir of Risk"],
    selectedTraitIds,
    stats: { precision: 4000 },
    target: {
      ...baseConfig.target,
      health: 1_000_000_000,
      conditions: { Vulnerability: 25 },
    },
  });
  for (const [skill, skillId, elixirConsumption] of [
    ["Devouring Cut", ID.DEVOURING_CUT, 15],
    ["Voracious Arc", ID.VORACIOUS_ARC, 17],
  ]) {
    const baseline = run(skill);
    const wicked = run(skill, [TRAIT.WICKED_CORRUPTION]);
    const skillDamage = result => result.resolvedEvents.find(event =>
      event.type === "damage" && event.skillId === skillId);
    const wickedStrike = skillDamage(wicked);

    assert.equal(wickedStrike.necromancerBlight, 20, skill);
    assert.ok(
      Math.abs(
        wickedStrike.damage / skillDamage(baseline).damage - 1.2,
      ) < 1e-12,
      skill,
    );
    assert.equal(
      wicked.events.find(event =>
        event.type === "necromancer.state"
        && event.reason === "blight-skill")?.state.blight,
      20,
      skill,
    );
    assert.equal(
      wicked.events.find(event =>
        event.type === "necromancer.state"
        && event.reason === "blight-consumed")?.state.blight,
      elixirConsumption,
      skill,
    );
    assert.equal(wicked.endState.profession.blight, 25, skill);
  }
});

test("Spear skills generate, refresh, consume, and damage with Soul Shards", () => {
  const chain = simulate("Harbinger", [
    "Dark Slash",
    "Deadly Slice",
    "Sinister Stab",
  ], {
    initialResource: 0,
    primaryWeapon: "Spear",
  });
  const utility = simulate("Harbinger", [
    "Extirpate",
    "Addle",
    "Perforate",
  ], {
    initialResource: 0,
    primaryWeapon: "Spear",
    target: {
      ...baseConfig.target,
      health: 1_000_000_000,
    },
  });
  const belowHalf = simulate("Harbinger", [
    "Extirpate",
    "Addle",
    "Perforate",
  ], {
    initialResource: 0,
    primaryWeapon: "Spear",
    target: {
      ...baseConfig.target,
      health: 20_000,
    },
  });
  const expired = simulate("Harbinger", [
    "Dark Slash",
    "Deadly Slice",
    { type: "wait", durationMs: 10_100 },
  ], {
    primaryWeapon: "Spear",
  });
  const damageEvents = (result, skillId) => result.events.filter(event =>
    event.type === "damage" && event.skillId === skillId);

  assert.deepEqual(
    damageEvents(chain, ID.DARK_SLASH).map(event => event.coefficient),
    [1.2],
  );
  assert.deepEqual(
    damageEvents(chain, ID.DEADLY_SLICE).map(event => event.coefficient),
    [1.4],
  );
  assert.deepEqual(
    damageEvents(chain, ID.SINISTER_STAB).map(event => event.coefficient),
    [1.8],
  );
  assert.equal(chain.endState.profession.soulShards, 2);
  assert.equal(chain.endState.profession.lifeForce, 5);
  assert.equal(
    chain.events.some(event =>
      event.type === "necromancer.chill"
      && event.skillId === ID.SINISTER_STAB),
    true,
  );
  assert.equal(expired.endState.profession.soulShards, 0);

  assert.equal(utility.endState.profession.lifeForce, 22);
  assert.equal(utility.endState.profession.soulShards, 0);
  assert.equal(
    utility.events.some(event =>
      event.type === "buff"
      && event.skillId === ID.EXTIRPATE
      && event.kind === "might"
      && event.stacks === 5),
    true,
  );
  assert.equal(
    utility.events.some(event =>
      event.type === "condition"
      && event.skillId === ID.EXTIRPATE
      && event.condition === "Weakness"),
    true,
  );
  assert.equal(
    utility.events.some(event =>
      event.type === "control"
      && event.skillId === ID.ADDLE
      && event.controlKind === "daze"),
    true,
  );
  assert.equal(
    utility.events.some(event =>
      event.type === "condition"
      && event.skillId === ID.ADDLE
      && event.condition === "Immobilized"),
    false,
  );

  const perforate = damageEvents(utility, ID.PERFORATE)
    .filter(event => event.name === "Perforate");
  const shards = damageEvents(utility, ID.SOUL_SHARDS)
    .filter(event => event.name === "Soul Shards");
  const lowShards = damageEvents(belowHalf, ID.SOUL_SHARDS)
    .filter(event => event.name === "Soul Shards");
  assert.equal(perforate.length, 7);
  assert.deepEqual(
    perforate.map(event => event.coefficient),
    Array(7).fill(0.5),
  );
  assert.deepEqual(
    perforate.map(event => event.coefficientModifiers),
    Array(7).fill(null).map(() => [{
      kind: "target-health-below",
      threshold: 0.5,
      multiplier: 1.2,
    }]),
  );
  assert.equal(shards.length, 4);
  assert.equal(shards.every(event =>
    event.parentSkillName === "Perforate"), true);
  assert.equal(shards.every(event =>
    event.flatStrikePowerCoeff === 0.1), true);
  const normalShardDamage = utility.resolvedEvents.find(event =>
    event.type === "damage" && event.name === "Soul Shards")?.damage;
  const lowShardDamage = Math.max(
    ...belowHalf.resolvedEvents
      .filter(event =>
        event.type === "damage" && event.name === "Soul Shards")
      .map(event => event.damage),
  );
  assert.ok(Math.abs(lowShardDamage / normalShardDamage - 1.5) < 1e-12);
  const normalPerforateDamage = utility.resolvedEvents.find(event =>
    event.type === "damage" && event.name === "Perforate")?.damage;
  const lowPerforateDamage = Math.max(
    ...belowHalf.resolvedEvents
      .filter(event =>
        event.type === "damage" && event.name === "Perforate")
      .map(event => event.damage),
  );
  assert.ok(
    Math.abs(lowPerforateDamage / normalPerforateDamage - 1.2) < 1e-12,
  );
});

test("Isolate and Distress expose the follow-up and reset Perforate", () => {
  const result = simulate("Harbinger", [
    "Perforate",
    "Isolate",
    "Distress",
    "Perforate",
  ], {
    initialResource: 0,
    primaryWeapon: "Spear",
  });
  const expiredFollowUp = simulate("Harbinger", [
    "Isolate",
    { type: "wait", durationMs: 3100 },
    "Distress",
  ], {
    primaryWeapon: "Spear",
  });
  const delayedHitWindow = simulate("Harbinger", [
    "Isolate",
    { type: "wait", durationMs: 3200 },
    "Distress",
  ], {
    boons: { quickness: true },
    primaryWeapon: "Spear",
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(delayedHitWindow.warnings, []);
  assert.equal(
    Math.round(
      delayedHitWindow.events.find(event =>
        event.type === "damage" && event.skillId === ID.ISOLATE
      ).at * 1000,
    ),
    720,
  );
  assert.equal(
    delayedHitWindow.events.find(event =>
      event.type === "action" && event.skillId === ID.ISOLATE
    ).rechargeReadyAt,
    18.72,
  );
  assert.equal(result.steps[3].start < 8000, true);
  assert.equal(
    result.events.filter(event =>
      event.type === "damage"
      && event.skillId === ID.PERFORATE
      && event.name === "Perforate").length,
    14,
  );
  assert.equal(
    result.events.filter(event =>
      event.type === "damage"
      && event.name === "Soul Shards").length,
    6,
  );
  assert.equal(
    result.events.some(event =>
      event.type === "necromancer.state"
      && event.reason === "distress"
      && event.state.soulShards === 6),
    true,
  );
  const rows = skillBreakdownRows(result);
  assert.equal(
    rows.find(row => row.name === "Perforate")?.hits,
    14,
  );
  assert.equal(
    rows.find(row => row.name === "Soul Shards")?.hits,
    6,
  );
  assert.equal(
    rows.find(row => row.name === "Soul Shards")?.icon,
    "https://wiki.guildwars2.com/wiki/Special:FilePath/Soul_Shards.png",
  );
  assert.equal(
    result.events.some(event =>
      event.type === "necromancer.chill"
      && event.skillId === ID.ISOLATE),
    true,
  );
  assert.equal(
    result.events.some(event =>
      event.type === "buff"
      && event.skillId === ID.ISOLATE
      && event.kind === "target-vulnerability"
      && event.stacks === 8),
    true,
  );
  assert.match(
    expiredFollowUp.warnings.join(" "),
    /Distress is unavailable/,
  );
});

test("Addle grants four shards to defiant foes and checks activation shards", () => {
  const normal = simulate("Harbinger", ["Addle"], {
    initialResource: 0,
    primaryWeapon: "Spear",
  });
  const defiant = simulate("Harbinger", ["Addle"], {
    initialResource: 0,
    primaryWeapon: "Spear",
    target: {
      ...baseConfig.target,
      defiant: true,
      activatingSkills: false,
    },
  });
  const threshold = simulate("Harbinger", [
    "Dark Slash",
    "Deadly Slice",
    "Extirpate",
    "Addle",
  ], {
    initialResource: 0,
    primaryWeapon: "Spear",
  });
  const immobilizes = result => result.events.filter(event =>
    event.type === "condition"
    && event.skillId === ID.ADDLE
    && event.condition === "Immobilized");

  assert.equal(normal.endState.profession.soulShards, 2);
  assert.equal(normal.endState.profession.lifeForce, 10);
  assert.equal(immobilizes(normal).length, 0);
  assert.equal(
    normal.events.find(event =>
      event.type === "control"
      && event.skillId === ID.ADDLE)?.duration,
    0.25,
  );
  assert.equal(defiant.endState.profession.soulShards, 4);
  assert.equal(defiant.endState.profession.lifeForce, 20);
  assert.equal(immobilizes(defiant).length, 0);
  assert.equal(
    defiant.events.find(event =>
      event.type === "control"
      && event.skillId === ID.ADDLE)?.duration,
    1.5,
  );
  assert.equal(threshold.endState.profession.soulShards, 5);
  assert.equal(immobilizes(threshold).length, 1);
});

test("necromancer wells finish their pulses after the final rotation action", () => {
  for (const skill of ["Well of Darkness", "Well of Suffering"]) {
    const result = simulate("Harbinger", [skill], {
      target: {
        ...baseConfig.target,
        health: 1_000_000_000,
      },
    });
    assert.equal(
      result.resolvedEvents.filter(event =>
        event.type === "damage" && event.name === skill).length,
      6,
      skill,
    );
  }
});

test("dagger skills use their current PvE strike and bleeding mechanics", () => {
  const darkPact = simulate("Core", ["Dark Pact"], {
    initialResource: 0,
    primaryWeapon: "Dagger",
  });
  const lifeSiphon = targetBleeding => simulate("Core", ["Life Siphon"], {
    primaryWeapon: "Dagger",
    target: {
      ...baseConfig.target,
      conditions: {
        ...baseConfig.target.conditions,
        Bleeding: targetBleeding,
      },
    },
  });
  const plain = lifeSiphon(false);
  const bleeding = lifeSiphon(true);
  const siphonDamage = result => result.resolvedEvents
    .filter(event =>
      event.type === "damage" && event.skillId === ID.LIFE_SIPHON)
    .reduce((sum, event) => sum + event.damage, 0);

  assert.equal(
    darkPact.events.find(event =>
      event.type === "damage" && event.skillId === ID.DARK_PACT)?.coefficient,
    2.4,
  );
  assert.equal(
    darkPact.events.find(event =>
      event.type === "condition"
      && event.skillId === ID.DARK_PACT
      && event.condition === "Bleeding")?.stacks,
    2,
  );
  assert.equal(
    darkPact.events.find(event =>
      event.type === "condition"
      && event.skillId === ID.DARK_PACT
      && event.condition === "Immobilized")?.duration,
    6,
  );
  assert.deepEqual(
    darkPact.events
      .filter(event => event.type === "self_condition")
      .map(event => [event.condition, event.stacks, event.duration]),
    [["Bleeding", 2, 10]],
  );
  assert.equal(
    plain.events.filter(event =>
      event.type === "damage" && event.skillId === ID.LIFE_SIPHON).length,
    9,
  );
  assert.ok(Math.abs(siphonDamage(bleeding) / siphonDamage(plain) - 1.5) < 1e-12);
});

test("off-hand sword follow-ups use their complete PvE effects", () => {
  const result = simulate("Core", [
    "Hungering Maelstrom",
    "Devouring Visage",
    "Gormandize",
    "Consume",
  ], {
    boons: { quickness: true },
    primaryWeapon: "Dagger",
    secondaryWeapon: "Sword",
    target: {
      ...baseConfig.target,
      health: 1_000_000_000,
    },
  });
  const damage = skillId => result.events.filter(event =>
    event.type === "damage" && event.skillId === skillId);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    damage(ID.HUNGERING_MAELSTROM).map(event => event.coefficient),
    [2.75],
  );
  assert.deepEqual(
    damage(ID.DEVOURING_VISAGE).map(event => event.coefficient),
    [1.5],
  );
  assert.deepEqual(
    damage(ID.GORMANDIZE).map(event => event.coefficient),
    [2.5],
  );
  assert.deepEqual(
    damage(ID.CONSUME).map(event => event.coefficient),
    Array(5).fill(0.5),
  );
  assert.equal(
    result.events.some(event =>
      event.type === "control"
      && event.skillId === ID.DEVOURING_VISAGE
      && event.controlKind === "fear"
      && event.duration === 1.5),
    true,
  );
  assert.equal(
    result.events.some(event =>
      event.type === "condition"
      && event.skillId === ID.CONSUME
      && event.condition === "Weakness"
      && event.duration === 4),
    true,
  );
  assert.equal(
    result.events.some(event =>
      event.type === "buff"
      && event.skillId === ID.CONSUME
      && event.kind === "might"
      && event.stacks === 5
      && event.duration === 8),
    true,
  );
});

test("Plaguelands, chill fields, and the benchmark reset retain live behavior", () => {
  const plague = simulate("Reaper", [
    "Plaguelands",
    "__cooldown_reset",
    "Plaguelands",
  ], {
    stats: { expertise: 1500 },
    selectedSkills: ["Plaguelands"],
    selectedTraitIds: [TRAIT.MASTER_OF_CORRUPTION],
    target: {
      ...baseConfig.target,
      health: 1_000_000_000,
    },
  });
  const field = simulate("Reaper", [
    "Reaper's Shroud",
    "Executioner's Scythe",
    "Soul Spiral",
  ], {
    initialResource: 100,
    selectedTraitIds: [TRAIT.DEATHLY_CHILL],
    target: {
      ...baseConfig.target,
      health: 1_000_000_000,
    },
  });
  const plagueEvents = (type, condition) => plague.events.filter(event =>
    event.type === type
    && event.skillId === ID.PLAGUELANDS
    && (condition == null || event.condition === condition));

  assert.deepEqual(plague.warnings, []);
  assert.equal(plague.steps.filter(step => step.skill === "Plaguelands").length, 2);
  assert.equal(plagueEvents("damage").length, 18);
  assert.equal(plagueEvents("condition", "Bleeding").length, 18);
  assert.equal(plagueEvents("condition", "Poisoned").length, 16);
  assert.equal(plagueEvents("condition", "Torment").length, 14);
  assert.deepEqual(
    plague.events
      .filter(event => event.type === "self_condition")
      .slice(0, 2)
      .map(event => [event.condition, event.duration]),
    [["Bleeding", 10], ["Poisoned", 4]],
  );
  assert.equal(
    plague.events.some(event =>
      event.type === "marker" && event.action === "cooldown-reset"),
    true,
  );
  assert.equal(
    field.resolvedEvents.filter(event =>
      event.type === "condition"
      && event.sourceId === TRAIT.DEATHLY_CHILL).length,
    12,
  );
});

test("Death Spiral includes its life-siphon damage packet", () => {
  const result = simulate("Reaper", ["Death Spiral"], {
    primaryWeapon: "Greatsword",
  });
  const packets = result.events.filter(event =>
    event.type === "damage" && event.skillId === ID.DEATH_SPIRAL);
  const siphon = packets.find(event => event.damageKind === "life-steal");
  const resolvedSiphon = result.resolvedEvents.find(event =>
    event.type === "damage"
    && event.skillId === ID.DEATH_SPIRAL
    && event.damageKind === "life-steal");

  assert.deepEqual(
    packets.map(event => event.name),
    ["Death Spiral", "Death Spiral — Life Siphon"],
  );
  assert.equal(siphon?.flatStrikeBase, 3517);
  assert.equal(siphon?.flatStrikePowerCoeff, 0.01);
  assert.equal(siphon?.noCrit, true);
  assert.equal(resolvedSiphon?.criticalChance, 0);
  assert.equal(resolvedSiphon?.damage, 3537);
});

test("Greatsword control and Nightfall pulses use their live mechanics", () => {
  const nightfallSkill = necromancerCatalog.skillsById.get(ID.NIGHTFALL);
  const grasp = simulate("Harbinger", [
    "Grasping Darkness",
    { type: "wait", durationMs: 2000 },
  ], {
    initialResource: 0,
    primaryWeapon: "Greatsword",
    relic: "Claw",
  });
  const nightfall = simulate("Harbinger", [
    "Nightfall",
    { type: "wait", durationMs: 4000 },
  ], {
    initialResource: 0,
    primaryWeapon: "Greatsword",
  });
  const nightfallHits = nightfall.events.filter(event =>
    event.type === "damage" && event.skillId === ID.NIGHTFALL);

  assert.deepEqual(
    nightfallSkill.effects.map(effect => effect.type),
    ["strike", "blind", "condition"],
  );
  assert.deepEqual(
    nightfallSkill.effects.map(effect => effect.applications ?? effect.hits),
    [4, 4, 4],
  );
  assert.deepEqual(
    grasp.events
      .filter(event =>
        event.type === "damage"
        && event.skillId === ID.GRASPING_DARKNESS)
      .map(event => event.coefficient),
    [1.3],
  );
  assert.equal(grasp.endState.profession.lifeForce, 10);
  assert.equal(
    grasp.events.some(event =>
      event.type === "necromancer.chill"
      && event.skillId === ID.GRASPING_DARKNESS),
    true,
  );
  assert.equal(
    grasp.events.some(event =>
      event.type === "control"
      && event.controlKind === "pull"),
    true,
  );
  assert.equal(
    grasp.procSteps.some(step => step.skill === "Relic of the Claw"),
    true,
  );

  assert.equal(nightfallHits.length, 4);
  assert.deepEqual(
    nightfallHits.map(event => event.coefficient),
    [1.15, 1.15, 1.15, 1.15],
  );
  assert.deepEqual(
    nightfallHits.map((event, index) =>
      Math.round((event.at - nightfallHits[0].at) * 1000)
        - index * 1000),
    [0, 0, 0, 0],
  );
  assert.equal(
    nightfall.events.filter(event =>
      event.type === "blind"
      && event.skillId === ID.NIGHTFALL).length,
    4,
  );
  assert.equal(
    nightfall.events.filter(event =>
      event.type === "condition"
      && event.skillId === ID.NIGHTFALL
      && event.condition === "Crippled").length,
    4,
  );
  assert.equal(nightfall.endState.profession.lifeForce, 28);
});

test("Nightfall commits its declarative field at the first pulse", () => {
  const beforeCommit = simulate("Harbinger", [{
    name: "Nightfall",
    interruptAfterMs: 560,
  }, {
    type: "wait",
    durationMs: 4000,
  }], {
    initialResource: 0,
    primaryWeapon: "Greatsword",
  });
  const afterCommit = simulate("Harbinger", [{
    name: "Nightfall",
    interruptAfterMs: 640,
  }, {
    type: "wait",
    durationMs: 4000,
  }], {
    initialResource: 0,
    primaryWeapon: "Greatsword",
  });
  const quickness = simulate("Harbinger", [
    "Nightfall",
    { type: "wait", durationMs: 4000 },
  ], {
    boons: { quickness: true },
    initialResource: 0,
    primaryWeapon: "Greatsword",
  });
  const nightfallHits = result => result.events.filter(event =>
    event.type === "damage" && event.skillId === ID.NIGHTFALL);

  assert.equal(nightfallHits(beforeCommit).length, 0);
  assert.equal(beforeCommit.endState.profession.lifeForce, 0);
  assert.equal(nightfallHits(afterCommit).length, 4);
  assert.equal(afterCommit.endState.profession.lifeForce, 28);
  assert.equal(quickness.steps[0].fullCastMs, 480);
  assert.deepEqual(
    nightfallHits(quickness).map((event, index) =>
      Math.round(event.at * 1000 - quickness.steps[0].start)
        - index * 1000),
    [400, 400, 400, 400],
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

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.activeMinions["bone-fiend"], 1);
  assert.ok(
    result.breakdown.some(entry =>
      entry.name === "Summon Bone Fiend — Minion Attack"),
  );
  assert.ok(result.breakdown.some(entry => entry.name === "Rigor Mortis"));
  assert.match(invalid.warnings.join(" "), /Rigor Mortis is unavailable/);
});

test("Reaper traits reduce shroud cooldowns and ignore minion critical hits", () => {
  const rotation = [
    "Reaper's Shroud",
    "Death's Charge",
    "Life Rend",
    "Life Slash",
    "Life Reap",
    "Death's Charge",
  ];
  const base = simulate("Reaper", rotation, {
    boons: { quickness: true, alacrity: true },
  });
  const onslaught = simulate("Reaper", rotation, {
    boons: { quickness: true, alacrity: true },
    selectedTraitIds: [TRAIT.REAPERS_ONSLAUGHT],
  });
  const secondChargeStart = result =>
    result.steps.filter(step => step.skill === "Death's Charge")[1].start;

  assert.equal(secondChargeStart(base) - secondChargeStart(onslaught), 1000);

  const nova = simulate("Reaper", [
    "Summon Flesh Golem",
    "Reaper's Shroud",
    "Soul Spiral",
    { type: "wait", durationMs: 20_000 },
  ], {
    boons: { quickness: true },
    selectedSkills: ["Summon Flesh Golem"],
    selectedTraitIds: [TRAIT.CHILLING_NOVA],
  });
  const novaProcs = nova.procSteps.filter(step =>
    step.skill === "Chilling Nova");

  assert.ok(novaProcs.length > 0);
  assert.equal(
    novaProcs.some(step =>
      step.sourceSkill === "Summon Flesh Golem â€” Minion Attack"),
    false,
  );
});

test("Reaper shouts apply their PvE melee damage bonus", () => {
  const melee = simulate("Reaper", ["\"You Are All Weaklings!\""], {
    selectedSkills: ["\"You Are All Weaklings!\""],
  });
  const ranged = simulate("Reaper", ["\"You Are All Weaklings!\""], {
    selectedSkills: ["\"You Are All Weaklings!\""],
    target: {
      ...baseConfig.target,
      nearby: false,
    },
  });

  assert.ok(
    Math.abs(melee.strikeDamage - ranged.strikeDamage * 2) < 1e-9,
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

test("Barbed Precision uses centered deterministic expected procs", () => {
  const result = simulate("Harbinger", [
    "Weeping Shots",
    { type: "wait", durationMs: 4100 },
  ], {
    primaryWeapon: "Pistol",
    stats: { precision: 4000 },
    selectedTraitIds: [TRAIT.BARBED_PRECISION],
  });
  const applications = result.resolvedEvents.filter(event =>
    event.sourceId === TRAIT.BARBED_PRECISION
    && event.condition === "Bleeding");

  // Six guaranteed critical hits have 1.98 expected procs. Centered cumulative
  // rounding materializes two whole applications instead of flooring to one.
  assert.equal(applications.length, 2);
  assert.ok(applications.every(application => application.duration === 3));
  assert.ok(applications.every(application =>
    Math.abs(application.effectiveDuration - 3.6) < 1e-12));
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
  assert.ok(Math.abs(lifeBlast.criticalDamage - 1.8333333333333333) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalChance - 0.6761904761904762) < 1e-12);
  assert.ok(Math.abs(bloodCurse.criticalDamage - 1.8333333333333333) < 1e-12);
});

test("the Power Harbinger trait set uses current critical and resource rules", () => {
  const runShroudStrike = (selectedTraitIds) => simulate("Harbinger", [
    "Harbinger Shroud",
    "Tainted Bolts",
  ], {
    stats: { precision: 4000 },
    selectedTraitIds,
    target: {
      ...baseConfig.target,
      health: 1_000_000_000,
      conditions: {
        ...baseConfig.target.conditions,
        Torment: true,
      },
    },
  });
  const base = runShroudStrike([]);
  const deathPerception = runShroudStrike([TRAIT.DEATH_PERCEPTION]);
  const wickedCorruption = runShroudStrike([TRAIT.WICKED_CORRUPTION]);
  const both = runShroudStrike([
    TRAIT.DEATH_PERCEPTION,
    TRAIT.WICKED_CORRUPTION,
  ]);
  const strikeDamage = result => result.resolvedEvents
    .filter(event =>
      event.type === "damage"
      && event.skillId === ID.TAINTED_BOLTS)
    .reduce((sum, event) => sum + event.damage, 0);
  assert.ok(
    Math.abs(strikeDamage(deathPerception) / strikeDamage(base) - 1.1)
      < 1e-12,
  );
  assert.ok(
    Math.abs(strikeDamage(wickedCorruption) / strikeDamage(base) - 1.1)
      < 1e-12,
  );
  assert.ok(
    Math.abs(strikeDamage(both) / strikeDamage(base) - 1.21)
      < 1e-12,
  );

  const implacable = simulate("Harbinger", ["Harbinger Shroud"], {
    selectedTraitIds: [TRAIT.IMPLACABLE_FOE],
  });
  assert.equal(
    implacable.events.some(event =>
      event.type === "buff"
      && event.kind === "stability"
      && event.stacks === 3
      && event.duration === 5),
    true,
  );

  const fortitude = simulate("Harbinger", ["Perforate"], {
    initialResource: 0,
    primaryWeapon: "Spear",
    selectedTraitIds: [
      TRAIT.SPITEFUL_FORTITUDE,
      TRAIT.GLUTTONY,
    ],
    target: {
      ...baseConfig.target,
      health: 8000,
    },
  });
  assert.equal(fortitude.endState.profession.lifeForce, 2.2);
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
      lifeForcePoolCapacity: 13256.28,
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
  assert.equal(harbingerResources[0].maximum, 13256);
  assert.equal(harbingerResources[0].value, 13256 * 0.8);
  assert.equal(harbingerResources[0].startMaximum, 100);
  assert.deepEqual(
    necromancerProfession.ui.resourceViews({
      specialization: "Harbinger",
      build: {
        weapons: ["Greatsword", ""],
        alternateWeapons: ["Spear", ""],
      },
      professionState: {
        lifeForce: 80,
        maximumLifeForce: 100,
        blight: 12,
        soulShards: 4,
      },
    }).map(resource => resource.id),
    ["life-force", "blight", "soul-shards"],
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
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      specialization: "Core",
      build: { weapons: ["Axe", "Focus"], specializations: [] },
    }),
    [],
  );
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      specialization: "Reaper",
      build: { weapons: ["Greatsword", ""], specializations: [] },
    }),
    [0.5],
  );
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
  assert.equal(migrated.initialResource, 100);
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

test("Condition Reaper benchmark preset stays aligned with the supplied EVTC", async () => {
  const savedBuild = JSON.parse(await readFile(
    new URL("../Builds/b-condi-reaper.json", import.meta.url),
    "utf8",
  ));
  const savedRotation = JSON.parse(await readFile(
    new URL("../Rotations/r-condi-reaper-bench.json", import.meta.url),
    "utf8",
  ));
  const build = migrateNecromancerBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: necromancerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const eventCount = (type, name) => result.resolvedEvents.filter(event =>
    event.type === type && event.name === name).length;
  const conditionStacks = condition => result.resolvedEvents
    .filter(event => event.type === "condition" && event.condition === condition)
    .reduce((sum, event) => sum + Number(event.stacks || 0), 0);
  const activeTraits = app.attributeData.activeTraits
    .map(trait => trait.name)
    .sort();

  assert.deepEqual(result.warnings, []);
  assert.equal(savedBuild.gear.Weapon2, "Grieving");
  assert.deepEqual(activeTraits, [
    "Barbed Precision",
    "Chilling Darkness",
    "Chilling Nova",
    "Cold Shoulder",
    "Death Perception",
    "Deathly Chill",
    "Furious Demise",
    "Gluttony",
    "Lingering Curse",
    "Master of Corruption",
    "Shivers of Dread",
    "Shroud Knight",
    "Sinister Shroud",
    "Soul Barbs",
    "Soul Battery",
    "Soul Eater",
    "Target the Weak",
    "Unyielding Blast",
  ].sort());
  assert.equal(eventCount("damage", "Perforate"), 105);
  assert.equal(eventCount("damage", "Soul Shards"), 90);
  assert.equal(eventCount("damage", "Soul Spiral"), 48);
  assert.equal(eventCount("damage", "\"Suffer!\""), 7);
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.type === "condition"
      && event.sourceId === TRAIT.DEATHLY_CHILL).length,
    159,
  );
  assert.equal(
    result.procSteps.filter(step => step.skill === "Sigil of Geomancy").length,
    7,
  );
  assert.equal(conditionStacks("Torment"), 43);
  assert.equal(conditionStacks("Burning"), 12);
  const bleedingDamage = result.conditionBreakdown.find(
    entry => entry.name === "Bleeding",
  )?.damage || 0;
  assert.ok(Math.abs(bleedingDamage - 2_105_095) / 2_105_095 < 0.02);
  assert.ok(Math.abs(result.dps - 44_355.31) / 44_355.31 < 0.02);
  assert.ok(Math.abs(result.totalDamage - 3_984_571) / 3_984_571 < 0.02);
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
