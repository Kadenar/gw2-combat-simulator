import assert from "node:assert/strict";
import test from "node:test";

import {
  elementalistAppAdapter,
  recalculate,
  runSimulation,
} from "../../../js/professions/elementalist/app/app-definition.js";
import { elementalistCatalog } from "../../../js/professions/elementalist/catalog.js";
import { elementalistProfession } from "../../../js/professions/elementalist/definition.js";

const benchmarks = [
  {
    specialization: "Core",
    lines: ["Fire", "Air", "Arcane"],
    rotation: ["Flame Uprising"],
    benchmarkDps: 79136,
  },
  {
    specialization: "Tempest",
    lines: ["Fire", "Air", "Tempest"],
    rotation: [6000, "Overload Fire", 6000],
    benchmarkDps: 8396,
  },
  {
    specialization: "Weaver",
    lines: ["Fire", "Air", "Weaver"],
    rotation: ["Flame Uprising"],
    secondaryAttunement: "Air",
    benchmarkDps: 92556,
  },
  {
    specialization: "Catalyst",
    lines: ["Fire", "Air", "Catalyst"],
    rotation: ["Deploy Jade Sphere (Fire)", 6000],
    benchmarkDps: 1563,
  },
  {
    specialization: "Evoker",
    lines: ["Fire", "Air", "Evoker"],
    rotation: ["Lightning Blitz", 4000],
    evokerElement: "Air",
    initialEvokerEmpowered: 3,
    benchmarkDps: 5238,
  },
];

function rotation(entries) {
  return entries.map((entry) =>
    typeof entry === "number"
      ? { type: "wait", durationMs: entry }
      : {
          type: "cast",
          skillId: elementalistCatalog.skillsByName.get(entry).id,
        },
  );
}

for (const benchmark of benchmarks) {
  test(`Elementalist ${benchmark.specialization} native benchmark`, () => {
    const build = elementalistAppAdapter.toApplicationBuild({
      ...elementalistProfession.createBuildDefaults(),
      specializations: benchmark.lines.map((name) => ({
        name,
        traits: "1-1-1",
      })),
      secondaryAttunement: benchmark.secondaryAttunement || "Fire",
      evokerElement: benchmark.evokerElement || "Fire",
      initialEvokerEmpowered: benchmark.initialEvokerEmpowered || 0,
      rotation: rotation(benchmark.rotation),
    });
    const app = {
      build,
      adapter: elementalistAppAdapter,
      profession: elementalistProfession,
      skillByName: elementalistCatalog.skillsByName,
      skillById: elementalistCatalog.skillsById,
      attributeWeaponSet: 1,
    };
    recalculate(app);
    const result = runSimulation(app);
    assert.equal(Math.round(result.dps), benchmark.benchmarkDps);
  });
}
