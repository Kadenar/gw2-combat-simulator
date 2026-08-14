import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";

const repoUrl = (path) => new URL(`../../../${path}`, import.meta.url);

async function loadWeaverFixture(variant) {
  const [savedBuild, savedRotation, adapter] = await Promise.all([
    readFile(repoUrl(`Builds/elementalist/b-${variant}.json`), "utf8").then(
      JSON.parse,
    ),
    readFile(repoUrl(`Rotations/elementalist/r-${variant}.json`), "utf8").then(
      JSON.parse,
    ),
    loadProfessionAppAdapter("elementalist"),
  ]);
  const build = {
    ...adapter.toApplicationBuild({
      ...savedBuild,
      rotation: savedRotation.rotation,
    }),
    targetHealth: Number.MAX_SAFE_INTEGER,
    rotation: savedRotation.rotation,
  };
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1,
  };

  adapter.recalculate(app);
  const result = adapter.simulateBuild(
    build.rotation,
    adapter.simulationConfig(app),
  );
  return { app, build, result, savedBuild, savedRotation };
}

test("every Weaver benchmark fixture runs with only reference-mirrored errors", async () => {
  const expectedWarnings = {
    "condi-weaver-pistol": [],
    "condi-weaver-pistol-dagger": [],
    "condi-weaver-scepter": [],
    "power-weaver-spear": [],
    "power-weaver-sword": [],
  };

  for (const [variant, warnings] of Object.entries(expectedWarnings)) {
    const { result } = await loadWeaverFixture(variant);
    assert.deepEqual(result.warnings, warnings, variant);
    assert.ok(result.totalDamage > 0, variant);
  }
});

test("condition Weaver pistol/dagger follows the replacement benchmark log", async () => {
  const { result, savedBuild, savedRotation } = await loadWeaverFixture(
    "condi-weaver-pistol-dagger",
  );

  assert.equal(
    savedRotation.metadata.report,
    "https://dps.report/yH46-20260729-145625_golem",
  );
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 89.573);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3950932);
  assert.equal(savedRotation.metadata.benchmarkDps, 44108.51484264232);
  assert.deepEqual(savedBuild.build.sigils, ["Malice", "Earth"]);
  assert.equal(savedBuild.build.food, "Salsa-Topped Veggie Flatbread");
  assert.deepEqual(savedBuild.build.infusions[0], {
    stat: "Expertise",
    count: 18,
  });
  assert.equal(Math.round(result.dps), 44171);
  assert.equal(savedBuild.build.gear.Back, "Viper's");
  assert.equal(savedBuild.build.utility, "Tuning Icicle");
  assert.equal(savedBuild.activeAttunement, "Earth");
  assert.equal(savedBuild.secondaryAttunement, "Earth");
  assert.deepEqual(savedBuild.pistolBullets, {
    Fire: true,
    Water: false,
    Air: false,
    Earth: true,
  });
  assert.deepEqual(
    savedRotation.rotation
      .slice(0, 4)
      .map((entry) => (typeof entry === "string" ? entry : entry.name)),
    [
      "Weave Self",
      "Primordial Stance (Earth)",
      "Signet of Fire",
      "__combat_start",
    ],
  );
  assert.equal(
    savedRotation.rotation.some(
      (entry) =>
        typeof entry === "object" &&
        ["Piercing Pebble", "Scorching Shot", "Soothing Splash"].includes(
          entry.name,
        ) &&
        entry.interruptMs != null,
    ),
    false,
  );
  const openingWeaveSelf = result.steps.find(
    (step) => step.skill === "Weave Self",
  );
  const openingPrimordialStance = result.steps.find(
    (step) => step.skill === "Primordial Stance (Earth)",
  );
  const openingSignetOfFire = result.steps.find(
    (step) => step.skill === "Signet of Fire",
  );
  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  );

  assert.equal(openingPrimordialStance.start - openingWeaveSelf.start, 200);
  assert.equal(openingSignetOfFire.start - openingWeaveSelf.start, 800);
  assert.equal(combatStart.start - openingSignetOfFire.start, 398);
  assert.equal(
    result.steps.filter((step) => step.skill === "Unravel").length,
    4,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Water Attunement").length,
    3,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Frozen Fusillade").length,
    3,
  );

  const damagePackets = result.resolvedEvents
    .flatMap((event) =>
      event.type === "damage"
        ? [{ at: event.at, damage: Number(event.damage || 0) }]
        : (event.damageTicks || []).map((tick) => ({
            at: tick.at,
            damage: tick.damage,
          })),
    )
    .sort((left, right) => left.at - right.at);
  const sourceCurve = [
    [10, 35327.1],
    [20, 43165.95],
    [36, 44424],
    [40, 43442.55],
    [60, 43345.1],
    [80, 43044.2625],
    [89.573, 44108.51484264232],
  ];
  for (const [at, sourceDps] of sourceCurve) {
    const damage = damagePackets
      .filter((packet) => packet.at <= combatStart.start / 1000 + at)
      .reduce((sum, packet) => sum + packet.damage, 0);
    assert.ok(Math.abs(damage / at / sourceDps - 1) < 0.05);
  }
});

test("a fully attuned Weaver starts with the eight-second Elements of Rage window", async () => {
  const { result } = await loadWeaverFixture("condi-weaver-pistol-dagger");
  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  ).start;
  const firstElementsOfRage = result.events.find(
    (event) => event.type === "buff" && event.kind === "elements of rage",
  );

  assert.ok(firstElementsOfRage.at * 1000 < combatStart);
  assert.equal(firstElementsOfRage.at, 0);
  assert.equal(firstElementsOfRage.duration, 8);
});

test("precombat Elements of Rage affects the reference opening packet", async () => {
  const { result } = await loadWeaverFixture("power-weaver-sword");
  const firstAirStormHit = result.resolvedEvents.find(
    (event) =>
      event.type === "damage" && event.skillName === "Glyph of Storms (Air)",
  );

  assert.ok(Math.abs(firstAirStormHit.damage - 4043.3900407355814) < 1e-6);
});

test("attunement casts advance Weaver spear etchings", async () => {
  const { result } = await loadWeaverFixture("power-weaver-spear");
  const volcano = result.breakdown.find((entry) => entry.name === "Volcano");

  assert.deepEqual(result.warnings, []);
  assert.equal(volcano.casts, 6);
  assert.equal(volcano.hits, 72);
});
