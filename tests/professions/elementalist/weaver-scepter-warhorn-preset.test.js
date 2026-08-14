import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";
import { runSimulation } from "../../../js/professions/elementalist/app/app-definition.js";

const rotationUrl = new URL(
  "../../../Rotations/elementalist/r-condi-weaver-scepter.json",
  import.meta.url,
);
const buildUrl = new URL(
  "../../../Builds/elementalist/b-condi-weaver-scepter.json",
  import.meta.url,
);

const entryName = (entry) => (typeof entry === "string" ? entry : entry.name);

test("condition Weaver scepter/warhorn preserves the supplied benchmark log", async () => {
  const preset = JSON.parse(await readFile(rotationUrl, "utf8"));
  const names = preset.rotation.map(entryName);
  const counts = Object.fromEntries(
    [...new Set(names)].map((name) => [
      name,
      names.filter((candidate) => candidate === name).length,
    ]),
  );

  assert.deepEqual(preset.metadata, {
    report: "https://dps.report/qcqm-20260813-042826_golem",
    benchmarkDurationSeconds: 90.535,
    benchmarkDamage: 3977301,
    benchmarkDps: 43931.08742475286,
    timingSource: "Elite Insights activation timings",
    note: "Rock Barrier and Fire Attunement are precast to reproduce the opening Hurl and Fire/Earth state. Weave Self starts at -1.513s and completes at -0.713s, exactly one Alacrity-adjusted recharge before its next activation at 71.287s. Unravel activations occur at 17.965s, 47.921s, and 88.723s; Elite Insights' simultaneous Dual attunement records are the resulting fully attuned state changes, not duplicate rotation commands.",
  });
  assert.deepEqual(names.slice(0, 9), [
    "Rock Barrier",
    "Fire Attunement",
    "__wait",
    "Weave Self",
    "__wait",
    "Signet of Fire",
    "__combat_start",
    "Signet of Earth",
    "Fire Attunement",
  ]);
  assert.deepEqual(preset.rotation[4], { name: "__wait", waitMs: 275 });
  assert.deepEqual(preset.rotation[6], {
    name: "__combat_start",
    offset: 438,
  });
  assert.deepEqual(
    Object.fromEntries(
      [
        "Flamestrike",
        "Dragon's Tooth",
        "Phoenix",
        "Hurl",
        "Rock Barrier",
        "Stone Shards",
        "Signet of Fire",
        "Signet of Earth",
        "Fracturing Strike",
        "Dust Storm",
        "Wildfire",
        "Primordial Stance (Fire)",
        "Primordial Stance (Earth)",
        "Unravel",
        "Weave Self",
      ].map((name) => [name, counts[name]]),
    ),
    {
      Flamestrike: 52,
      "Dragon's Tooth": 16,
      Phoenix: 11,
      Hurl: 11,
      "Rock Barrier": 11,
      "Stone Shards": 19,
      "Signet of Fire": 9,
      "Signet of Earth": 7,
      "Fracturing Strike": 7,
      "Dust Storm": 5,
      Wildfire: 4,
      "Primordial Stance (Fire)": 3,
      "Primordial Stance (Earth)": 3,
      Unravel: 3,
      "Weave Self": 2,
    },
  );
  assert.deepEqual(
    preset.rotation
      .filter(
        (entry) =>
          entryName(entry) === "Stone Shards" && entry.interruptMs != null,
      )
      .map((entry) => entry.interruptMs),
    [40, 160, 38, 403, 121, 159, 201, 79],
  );
  assert.deepEqual(
    preset.rotation
      .filter(
        (entry) =>
          entryName(entry) === "Flamestrike" && entry.interruptMs != null,
      )
      .map((entry) => entry.interruptMs),
    [81, 37, 34, 82, 40],
  );

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
  assert.equal(Math.round(result.dps), 42157);
});
