import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";
import { runSimulation } from "../../../js/professions/elementalist/app/app-definition.js";

const rotationUrl = new URL(
  "../../../Rotations/elementalist/r-condi-weaver-pistol.json",
  import.meta.url,
);
const buildUrl = new URL(
  "../../../Builds/elementalist/b-condi-weaver-pistol.json",
  import.meta.url,
);

const entryName = (entry) => (typeof entry === "string" ? entry : entry.name);

test("condition Weaver pistol/warhorn preserves the supplied benchmark log", async () => {
  const preset = JSON.parse(await readFile(rotationUrl, "utf8"));
  const names = preset.rotation.map(entryName);
  const counts = Object.fromEntries(
    [...new Set(names)].map((name) => [
      name,
      names.filter((candidate) => candidate === name).length,
    ]),
  );

  assert.deepEqual(preset.metadata, {
    report: "https://dps.report/Yt2F-20260805-122746_golem",
    benchmarkDurationSeconds: 87.052,
    benchmarkDamage: 3902408,
    benchmarkDps: 44828.47033956715,
    timingSource: "Elite Insights activation timings",
    note: "An Earth attunement and 3.2-second wait establish the Earth/Fire state in which Elite Insights begins. Weave Self is precast from -1.121s to -0.321s, immediately before the first recorded Signet of Fire; its buff is active at combat start, and its next activation occurs at 71.761s after the Alacrity-adjusted recharge. Every subsequent source activation is preserved. Weapon Stow bookkeeping and automatic attunement trait procs are omitted; cancelled weapon skills retain their Elite Insights activation durations.",
  });
  assert.deepEqual(names.slice(0, 6), [
    "Earth Attunement",
    "__wait",
    "Weave Self",
    "Signet of Fire",
    "__combat_start",
    "Earth Attunement",
  ]);
  assert.deepEqual(
    Object.fromEntries(
      [
        "Piercing Pebble",
        "Scorching Shot",
        "Shattering Stone",
        "Raging Ricochet",
        "Signet of Fire",
        "Boulder Blast",
        "Searing Salvo",
        "Molten Meteor",
        "Signet of Earth",
        "Primordial Stance (Earth)",
        "Primordial Stance (Fire)",
        "Wildfire",
        "Dust Storm",
        "Frozen Fusillade",
        "Frigid Flurry",
        "Unravel",
        "Echoing Erosion",
        "Weave Self",
      ].map((name) => [name, counts[name]]),
    ),
    {
      "Piercing Pebble": 46,
      "Scorching Shot": 34,
      "Shattering Stone": 14,
      "Raging Ricochet": 12,
      "Signet of Fire": 9,
      "Boulder Blast": 9,
      "Searing Salvo": 9,
      "Molten Meteor": 8,
      "Signet of Earth": 7,
      "Primordial Stance (Earth)": 4,
      "Primordial Stance (Fire)": 2,
      Wildfire: 4,
      "Dust Storm": 4,
      "Frozen Fusillade": 3,
      "Frigid Flurry": 3,
      Unravel: 3,
      "Echoing Erosion": 2,
      "Weave Self": 2,
    },
  );
  assert.deepEqual(
    preset.rotation
      .filter(
        (entry) =>
          entryName(entry) === "Piercing Pebble" && entry.interruptMs != null,
      )
      .map((entry) => entry.interruptMs),
    [158, 162, 200, 37, 158, 44, 84, 242],
  );
  assert.deepEqual(
    preset.rotation
      .filter(
        (entry) =>
          entryName(entry) === "Scorching Shot" && entry.interruptMs != null,
      )
      .map((entry) => entry.interruptMs),
    [38, 163, 37, 158],
  );
  assert.equal(names.includes("Weapon Stow"), false);

  const [savedBuild, adapter] = await Promise.all([
    readFile(buildUrl, "utf8").then(JSON.parse),
    loadProfessionAppAdapter("elementalist"),
  ]);
  const build = {
    ...adapter.toApplicationBuild({
      ...savedBuild,
      rotation: preset.rotation,
    }),
    targetHealth: Number.MAX_SAFE_INTEGER,
    rotation: preset.rotation,
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
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.ok(result.totalDamage > 0);
  assert.equal(Math.round(result.dps), 39563);
  const weaveSelfSteps = result.steps.filter(
    (step) => step.skill === "Weave Self",
  );
  const openingSignet = result.steps.find(
    (step) => step.skill === "Signet of Fire",
  );
  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  );

  assert.equal(weaveSelfSteps.length, 2);
  assert.equal(openingSignet.start - weaveSelfSteps[0].start, 800);
  assert.equal(combatStart.start - openingSignet.start, 321);
  assert.equal(combatStart.start - weaveSelfSteps[0].start, 1121);
});
