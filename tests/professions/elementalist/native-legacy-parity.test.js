import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import {
  elementalistAppAdapter,
  recalculate,
  simulationConfig,
} from "../../../js/professions/elementalist/app/app-definition.js";
import { createDefaultPermaBoons } from "../../../js/professions/elementalist/legacy/app/app-state.js";
import { elementalistCatalog } from "../../../js/professions/elementalist/catalog.js";
import {
  loadSkillHits,
  loadSkills,
} from "../../../js/professions/elementalist/legacy/data/csv-loader.js";
import { elementalistProfession } from "../../../js/professions/elementalist/definition.js";
import {
  calcBuildAttributes,
  createSimulationEngine,
} from "../../../js/professions/elementalist/legacy/sim/run/sim-runner.js";

const PARITY_TOLERANCE = 0.05;
const MILESTONE_TOLERANCE_SECONDS = 0.04;

const [skillsText, hitsText] = await Promise.all([
  readFile(
    new URL(
      "../../../js/professions/elementalist/legacy/data/csv/Tool_Elementalist - Skills_data.csv",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../../../js/professions/elementalist/legacy/data/csv/Tool_Elementalist - Skill_hits_data.csv",
      import.meta.url,
    ),
    "utf8",
  ),
]);
const legacyData = {
  skills: loadSkills(skillsText),
  skillHits: loadSkillHits(hitsText),
};

const cases = [
  {
    specialization: "Core",
    lines: ["Fire", "Air", "Arcane"],
    rotation: ["Flame Uprising"],
  },
  {
    specialization: "Tempest",
    lines: ["Fire", "Air", "Tempest"],
    rotation: [
      { name: "__wait", waitMs: 6000 },
      "Overload Fire",
      { name: "__wait", waitMs: 6000 },
    ],
  },
  {
    specialization: "Weaver",
    lines: ["Fire", "Air", "Weaver"],
    rotation: ["Flame Uprising"],
    secondaryAttunement: "Air",
  },
  {
    specialization: "Catalyst",
    lines: ["Fire", "Air", "Catalyst"],
    rotation: ["Deploy Jade Sphere (Fire)", { name: "__wait", waitMs: 6000 }],
  },
  {
    specialization: "Evoker",
    lines: ["Fire", "Air", "Evoker"],
    rotation: ["Lightning Blitz", { name: "__wait", waitMs: 4000 }],
    evokerElement: "Air",
    initialEvokerEmpowered: 3,
  },
];

function canonicalRotation(rotation) {
  return rotation.map((entry) => {
    if (typeof entry === "string") {
      return {
        type: "cast",
        skillId: elementalistCatalog.skillsByName.get(entry).id,
      };
    }
    return { type: "wait", durationMs: entry.waitMs };
  });
}

function createBuild(fixture) {
  return {
    ...elementalistProfession.createBuildDefaults(),
    specializations: fixture.lines.map((name) => ({
      name,
      traits: "1-1-1",
    })),
    startAttunement: "Fire",
    secondaryAttunement: fixture.secondaryAttunement || "Fire",
    evokerElement: fixture.evokerElement || "Fire",
    initialEvokerEmpowered: fixture.initialEvokerEmpowered || 0,
    rotation: canonicalRotation(fixture.rotation),
  };
}

function runNative(fixture, build) {
  const applicationBuild = elementalistAppAdapter.toApplicationBuild(build);
  const app = {
    build: applicationBuild,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  return simulateGw2({
    profession: elementalistProfession,
    rotation: canonicalRotation(fixture.rotation),
    config: simulationConfig(app),
  });
}

function runLegacy(fixture, build) {
  const selectedSkills = Object.fromEntries(
    Object.entries(build.selectedSkills).map(([slot, name]) => [
      slot,
      legacyData.skills.find((skill) => skill.name === name),
    ]),
  );
  const engine = createSimulationEngine(
    legacyData,
    calcBuildAttributes(build, selectedSkills),
  );
  engine.rotation = fixture.rotation;
  return engine.run(
    build.startAttunement,
    fixture.secondaryAttunement || null,
    fixture.evokerElement || null,
    createDefaultPermaBoons(),
    null,
    build.targetHealth,
    null,
    null,
    build.initialEvokerCharges,
    build.initialEvokerEmpowered,
  );
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(1, Math.abs(right));
}

function nativeDamageMilestones(result) {
  return result.resolvedEvents
    .filter((event) => event.type === "damage" && Number(event.damage) > 0)
    .map((event) => event.at);
}

function legacyDamageMilestones(result) {
  return result.log
    .filter((entry) => entry.type === "hit" && Number(entry.strike) > 0)
    .map((entry) => entry.t / 1000);
}

function assertParity(fixture) {
  const build = createBuild(fixture);
  const native = runNative(fixture, build);
  const legacy = runLegacy(fixture, build);
  assert.ok(native.totalDamage > 0, "native rotation must deal damage");
  assert.ok(legacy.totalDamage > 0, "legacy rotation must deal damage");
  assert.ok(
    relativeDifference(native.totalDamage, legacy.totalDamage) <=
      PARITY_TOLERANCE,
    `${fixture.specialization} total damage: native ${native.totalDamage}, legacy ${legacy.totalDamage}`,
  );
  assert.ok(
    relativeDifference(native.dps, legacy.dps) <= PARITY_TOLERANCE,
    `${fixture.specialization} DPS: native ${native.dps}, legacy ${legacy.dps}`,
  );

  const nativeMilestones = nativeDamageMilestones(native);
  const legacyMilestones = legacyDamageMilestones(legacy);
  assert.equal(nativeMilestones.length, legacyMilestones.length);
  for (let index = 0; index < nativeMilestones.length; index += 1) {
    assert.ok(
      Math.abs(nativeMilestones[index] - legacyMilestones[index]) <=
        MILESTONE_TOLERANCE_SECONDS,
      `${fixture.specialization} milestone ${index + 1}`,
    );
  }
}

test("Core native and legacy rotations stay within 5%", () =>
  assertParity(cases[0]));
test("Tempest native and legacy rotations stay within 5%", () =>
  assertParity(cases[1]));
test("Weaver native and legacy rotations stay within 5%", () =>
  assertParity(cases[2]));
test("Catalyst native and legacy rotations stay within 5%", () =>
  assertParity(cases[3]));
test("Evoker native and legacy rotations stay within 5%", () =>
  assertParity(cases[4]));
