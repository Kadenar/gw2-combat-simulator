import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";
import { runSimulation } from "../../../js/professions/elementalist/app/app-definition.js";

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
  return { app, build, result: runSimulation(app) };
}

test("every Weaver benchmark fixture runs with only reference-mirrored errors", async () => {
  const expectedWarnings = {
    "condi-weaver-pistol": [],
    "condi-weaver-pistol-dagger": [
      "Earth Attunement is unavailable — already attuned to Earth.",
    ],
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

test("Elements of Rage carries from setup and follows reference duration scaling", async () => {
  const { result } = await loadWeaverFixture("condi-weaver-pistol-dagger");
  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  ).start;
  const firstElementsOfRage = result.events.find(
    (event) => event.type === "buff" && event.kind === "elements of rage",
  );

  assert.ok(firstElementsOfRage.at * 1000 < combatStart);
  assert.ok(Math.abs(firstElementsOfRage.duration - 12.805333333333333) < 1e-9);
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
