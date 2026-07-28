import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionRoute,
} from "../js/app/profession-registry.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild,
} from "../js/professions/engineer/build.js";
import {
  engineerCatalog,
} from "../js/professions/engineer/catalog.js";
import {
  DATA_SNAPSHOT,
} from "../js/professions/engineer/data/engineer-api-metadata.js";
import {
  ENGINEER_TRAIT_COVERAGE,
} from "../js/professions/engineer/data/trait-coverage.js";
import {
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../js/professions/engineer/data/ids.js";
import {
  WIKI_SKILL_RESEARCH,
} from "../js/professions/engineer/data/engineer-wiki-skill-research.js";
import {
  engineerProfession,
} from "../js/professions/engineer/definition.js";

const baseConfig = Object.freeze({
  selectedSkills: [
    "Healing Turret",
    "Grenade Kit",
    "Throw Mine",
    "Rifle Turret",
    "Supply Crate",
  ],
  selectedMorphSkillIds: [77103, 77203, 76954],
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000,
  },
  target: {
    armor: 2597,
    conditions: { Vulnerability: 25 },
  },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
  });
}

test("Engineer catalog pins current API identity and Wiki mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-07-28");
  assert.equal(engineerCatalog.specializations.length, 9);
  assert.equal(engineerCatalog.traits.length, 108);
  assert.ok(engineerCatalog.skills.length >= 330);
  assert.equal(engineerCatalog.skillsById.get(5842).name, "Bomb");
  assert.equal(engineerCatalog.skillsByName.get("Bomb").effects[0].coefficient, 1.2);
  assert.ok(WIKI_SKILL_RESEARCH.length >= 300);
  assert.ok(WIKI_SKILL_RESEARCH.every(record =>
    record.sourceUrl && record.revisionId && record.revisionTimestamp));
});

test("Engineer defaults migrate and validate morph branch choices", () => {
  const defaults = createEngineerBuildDefaults();
  assert.deepEqual(validateEngineerBuild(defaults), {
    valid: true,
    errors: [],
  });
  const migrated = migrateEngineerBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  assert.deepEqual(migrated.selectedMorphSkillIds, [77103, 77203, 76954]);
  assert.equal(validateEngineerBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77203, 77285],
  }).valid, false);
});

test("kits replace the weapon bar and trigger swap procs", () => {
  const denied = simulate("Core", ["Grenade"]);
  assert.match(denied.warnings[0], /equip Grenade Kit first/);

  const result = simulate("Core", ["Grenade Kit", "Shrapnel Grenade"]);
  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.endState.profession.activeKit, "Grenade Kit");
  assert.ok(result.events.some(event => event.type === "sigil_swap"));
});

test("tool-belt skills derive from selected slot skills", () => {
  const available = simulate("Core", ["Grenade Barrage"]);
  assert.equal(available.warnings.length, 0);
  assert.ok(available.totalDamage > 0);

  const denied = simulate("Core", ["Grenade Barrage"], {
    selectedSkills: ["Healing Turret", "Throw Mine", "Rifle Turret", "Supply Crate"],
  });
  assert.match(denied.warnings[0], /Grenade Kit is not equipped/);
});

test("Photon Forge heat generation and cooling use current piecewise rates", () => {
  const hot = simulate("Holosmith", [
    "Engage Photon Forge",
    { type: "wait", durationMs: 5000 },
    "Deactivate Photon Forge",
    { type: "wait", durationMs: 3000 },
  ]);
  assert.equal(hot.endState.profession.heat, 10);
  assert.equal(hot.endState.profession.photonForgeActive, false);

  const cooled = simulate("Holosmith", [
    "Engage Photon Forge",
    { type: "wait", durationMs: 5000 },
    "Deactivate Photon Forge",
    { type: "wait", durationMs: 5000 },
  ]);
  assert.equal(cooled.endState.profession.heat, 0);
});

test("Photon Forge overheats at its trait-adjusted maximum", () => {
  const core = simulate("Holosmith", [
    "Engage Photon Forge",
    { type: "wait", durationMs: 50000 },
  ]);
  assert.equal(core.endState.profession.heat, 100);
  assert.equal(core.endState.profession.overheated, true);
  assert.equal(core.endState.profession.photonForgeActive, false);

  const enhanced = simulate("Holosmith", [], {
    initialHeat: 149,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
  });
  assert.equal(enhanced.endState.profession.maximumHeat, 150);
  assert.equal(enhanced.endState.profession.heat, 149);
});

test("Mechanist commands are selected by traits and mech attacks persist", () => {
  const result = simulate("Mechanist", [
    "Spark Revolver",
    { type: "wait", durationMs: 1500 },
  ], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
      TRAIT.MECH_CORE_BARRIER_ENGINE,
    ],
  });
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.profession.mech.commandSkillIds.map(id =>
      engineerCatalog.skillsById.get(id).name),
    ["Spark Revolver", "Crisis Zone", "Barrier Burst"],
  );
  assert.ok(result.resolvedEvents.some(event =>
    event.skillName === "Jade Energy Shot" && event.actorType === "summon"));
});

test("Amalgam exposes only persisted F2-F4 morph choices", () => {
  const selected = simulate("Amalgam", [77103], {
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  assert.equal(selected.warnings.length, 0);
  assert.ok(selected.totalDamage > 0);

  const denied = simulate("Amalgam", [76568], {
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  assert.match(denied.warnings[0], /another morph is selected/);
});

test("trait-coverage manifest covers all Engineer traits", () => {
  assert.equal(ENGINEER_TRAIT_COVERAGE.length, engineerCatalog.traits.length);
  assert.ok(ENGINEER_TRAIT_COVERAGE.every(entry => entry.effects.length > 0));
});

test("Engineer is a loadable native application", async () => {
  assert.equal(professionRoute("engineer"), "engineer.html");
  assert.equal((await loadProfession("engineer")).id, "engineer");
  assert.equal((await loadProfessionAppAdapter("engineer")).profession.id, "engineer");
  const html = await readFile(new URL("../engineer.html", import.meta.url), "utf8");
  assert.match(html, /data-profession="engineer"/);
  assert.match(html, /Engineer<\/span> Rotation Simulator/);
});
