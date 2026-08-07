import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import {
  THIEF_ELITE_SPECIALIZATIONS,
  thiefCatalog,
  thiefSkillRuntimeOwner,
} from "../../../js/professions/thief/catalog.js";
import { thiefCoreModule } from "../../../js/professions/thief/core/module.js";
import {
  THIEF_CORE_SKILL_MECHANICS,
} from "../../../js/professions/thief/core/skills.js";
import { thiefProfession } from "../../../js/professions/thief/definition.js";
import {
  THIEF_SKILL_MECHANICS,
} from "../../../js/professions/thief/mechanics/skill-mechanics.js";

function nativeModifierRules(module) {
  const modifiers = module.mechanics?.modifiers;
  return Array.isArray(modifiers) ? modifiers : modifiers?.modifierRules || [];
}
import {
  THIEF_SKILL_IDS as ID,
} from "../../../js/professions/thief/data/ids.js";
import { antiquaryModule } from "../../../js/professions/thief/specializations/antiquary/module.js";
import {
  ANTIQUARY_SKILL_MECHANICS,
} from "../../../js/professions/thief/specializations/antiquary/skills.js";
import { daredevilModule } from "../../../js/professions/thief/specializations/daredevil/module.js";
import {
  DAREDEVIL_SKILL_MECHANICS,
} from "../../../js/professions/thief/specializations/daredevil/skills.js";
import { deadeyeModule } from "../../../js/professions/thief/specializations/deadeye/module.js";
import {
  DEADEYE_SKILL_MECHANICS,
} from "../../../js/professions/thief/specializations/deadeye/skills.js";
import { specterModule } from "../../../js/professions/thief/specializations/specter/module.js";
import {
  SPECTER_SKILL_MECHANICS,
} from "../../../js/professions/thief/specializations/specter/skills.js";

const slices = Object.freeze([
  ["core", thiefCoreModule],
  ["specializations/daredevil", daredevilModule],
  ["specializations/deadeye", deadeyeModule],
  ["specializations/specter", specterModule],
  ["specializations/antiquary", antiquaryModule],
]);

const specializationStateKeys = Object.freeze({
  Daredevil: ["selectedDodge", "boundingDamageUntil"],
  Deadeye: [
    "markedTargetId",
    "malice",
    "maximumMalice",
    "maleficentSevenTriggered",
  ],
  Specter: [
    "shadowForce",
    "maximumShadowForce",
    "shadowForcePoolCapacity",
    "shadowShroudActive",
  ],
  Antiquary: [
    "artifactSlots",
    "artifactUsesRemaining",
    "activeAntiquarySummons",
    "mistburnCharges",
    "holoUtilityCooldownReductionExpirations",
  ],
});

test("Thief modules own vertical source slices", () => {
  for (const obsolete of [
    "mechanics/specific",
    "resolver/event-handlers.js",
    "resolver/event-reactions.js",
  ]) {
    assert.equal(
      existsSync(
        new URL(`../../../js/professions/thief/${obsolete}`, import.meta.url),
      ),
      false,
      obsolete,
    );
  }

  const modifierRuleOwners = new Map();
  for (const [directory, module] of slices) {
    const directoryUrl = new URL(
      `../../../js/professions/thief/${directory}/`,
      import.meta.url,
    );
    for (const entry of readdirSync(directoryUrl, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      const source = readFileSync(new URL(entry.name, directoryUrl), "utf8");
      if (directory === "core") {
        assert.doesNotMatch(source, /from\s+["'][^"']*specializations\//);
      } else {
        assert.doesNotMatch(
          source,
          /from\s+["']\.\.\/(?:daredevil|deadeye|specter|antiquary)(?:\/|["'])/,
          `${directory}/${entry.name} imports a sibling specialization`,
        );
      }
      const rootFacadeImport = directory === "core"
        ? /from\s+["']\.\.\/(?:assumptions|attribute-rules|definition|family|handlers|resolver|state|ui)\.js["']/
        : /from\s+["']\.\.\/\.\.\/(?:assumptions|attribute-rules|definition|family|handlers|resolver|state|ui)\.js["']/;
      assert.doesNotMatch(
        source,
        rootFacadeImport,
        `${directory}/${entry.name} imports an application facade`,
      );
      if (entry.name !== "module.js") {
        assert.doesNotMatch(
          source,
          directory === "core"
            ? /from\s+["']\.\.\/catalog\.js["']/
            : /from\s+["']\.\.\/\.\.\/catalog\.js["']/,
          `${directory}/${entry.name} imports the application catalog`,
        );
      }
    }
    for (const filename of ["module.js", "state.js", "skills.js"]) {
      const url = new URL(
        `../../../js/professions/thief/${directory}/${filename}`,
        import.meta.url,
      );
      assert.equal(existsSync(url), true, `${directory}/${filename}`);
      const source = readFileSync(url, "utf8");
      assert.doesNotMatch(
        source,
        /specializations\/(?:daredevil|deadeye|specter|antiquary)\//,
        `${directory}/${filename} imports a sibling specialization`,
      );
      if (filename === "skills.js") {
        assert.match(source, /_SKILL_MECHANICS\b/);
        assert.doesNotMatch(source, /from\s+["'][^"']*catalog\.js["']/);
      }
    }
    assert.equal(typeof module.state?.scheduler, "function");
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  assert.equal(modifierRuleOwners.get("thief.havoc-specialist"), "Daredevil");
  assert.equal(
    modifierRuleOwners.get("thief.malicious-stealth-attack"),
    "Deadeye",
  );
  assert.equal(
    modifierRuleOwners.get("thief.strength-of-shadows"),
    "Specter",
  );
  assert.equal(
    modifierRuleOwners.get("thief.meticulous-custodian-artifact-strike"),
    "Antiquary",
  );

  const coreSources = [
    "module.js",
    "state.js",
    "skills.js",
    "handlers.js",
    "rules.js",
    "ui.js",
  ].map(filename =>
    readFileSync(
      new URL(`../../../js/professions/thief/core/${filename}`, import.meta.url),
      "utf8",
    ),
  ).join("\n");
  assert.doesNotMatch(coreSources, /specializations\//);
  assert.doesNotMatch(
    readFileSync(
      new URL(
        "../../../js/professions/thief/mechanics/skill-mechanics.js",
        import.meta.url,
      ),
      "utf8",
    ),
    /\[ID\./,
  );
});

test("Thief raw skill mechanics retain a disjoint no-loss union", () => {
  const fragments = [
    ["Core", THIEF_CORE_SKILL_MECHANICS],
    ["Daredevil", DAREDEVIL_SKILL_MECHANICS],
    ["Deadeye", DEADEYE_SKILL_MECHANICS],
    ["Specter", SPECTER_SKILL_MECHANICS],
    ["Antiquary", ANTIQUARY_SKILL_MECHANICS],
  ];
  const catalogById = new Map(
    thiefCatalog.skills.map(skill => [String(skill.id), skill]),
  );
  const seen = new Set();
  const rawOwnerById = new Map();
  for (const [owner, fragment] of fragments) {
    for (const id of Object.keys(fragment)) {
      assert.equal(seen.has(id), false, id);
      seen.add(id);
      rawOwnerById.set(Number(id), owner);
      const skill = catalogById.get(id);
      if (skill) assert.equal(thiefSkillRuntimeOwner(skill), owner, id);
    }
  }
  assert.deepEqual(
    [...seen].sort((left, right) => Number(left) - Number(right)),
    Object.keys(THIEF_SKILL_MECHANICS)
      .sort((left, right) => Number(left) - Number(right)),
  );
  for (const id of [
    ID.FORGED_SURFER_DASH,
    ID.EXALTED_HAMMER,
    ID.HOLO_DANCER_DECOY_ID_76800,
    ID.SUMMON_KRYPTIS_TURRET,
    ID.MISTBURN_MORTAR_ID_77288,
  ]) {
    assert.equal(rawOwnerById.get(id), "Antiquary", id);
  }
});

test("Thief runtimes exclude inactive elite state, catalogs, and registries", () => {
  assert.equal(thiefProfession.catalog, thiefCatalog);
  for (const active of ["Core", ...THIEF_ELITE_SPECIALIZATIONS]) {
    const config = { specialization: active };
    const runtime = thiefProfession.resolveRuntime(config);
    const state = runtime.createProfessionState(config);
    const activeElite = active === "Core" ? null : active;

    assert.equal(runtime, thiefProfession.resolveRuntime(config), active);
    assert.equal(state.specialization.kind, active, active);
    assert.deepEqual(
      runtime.catalog.specializations
        .filter(specialization => specialization.elite)
        .map(specialization => specialization.name),
      activeElite ? [activeElite] : [],
      active,
    );
    assert.equal(
      runtime.catalog.skills.some(skill => {
        const owner = thiefSkillRuntimeOwner(skill);
        return owner !== "Core" && owner !== activeElite;
      }),
      false,
      `${active}:skills`,
    );
    assert.deepEqual(
      [...runtime.catalog.skillHandlers.keys()].sort(),
      [...new Set(
        runtime.catalog.skills
          .map(skill => String(skill.handlerId || ""))
          .filter(Boolean),
      )].sort(),
      `${active}:handlers`,
    );

    for (const [owner, keys] of Object.entries(specializationStateKeys)) {
      for (const key of keys) {
        assert.equal(
          Object.hasOwn(state.core, key),
          false,
          `${active}:core:${key}`,
        );
        assert.equal(
          Object.hasOwn(state.specialization.state, key),
          owner === active,
          `${active}:specialization:${key}`,
        );
      }
    }
    assert.equal(
      Object.hasOwn(runtime.taskHandlers, "thief.forged-surfer"),
      active === "Antiquary",
      `${active}:forged-surfer`,
    );
    assert.equal(
      Object.hasOwn(runtime.taskHandlers, "thief.skritt-scuffle"),
      active === "Antiquary",
      `${active}:skritt-scuffle`,
    );

    const resources = runtime.ui.resourceViews({
      config,
      state: { profession: state },
    }).map(resource => resource.id);
    assert.equal(resources.includes("malice"), active === "Deadeye", active);
    assert.equal(
      resources.includes("shadow-force"),
      active === "Specter",
      active,
    );
    assert.equal(
      resources.includes("artifact-uses"),
      active === "Antiquary",
      active,
    );
  }
  assert.throws(
    () => thiefProfession.resolveRuntime({ specialization: "Missing" }),
    /Unknown Thief elite specialization "Missing"/,
  );
});

test("Thief public projection keeps inactive compatibility fields", () => {
  const result = simulateGw2({
    profession: thiefProfession,
    rotation: [],
    config: { specialization: "Core" },
  });
  assert.equal(result.endState.profession.malice, 0);
  assert.equal(result.endState.profession.shadowForce, 0);
  assert.deepEqual(result.endState.profession.artifactSlots, []);
  assert.equal(result.endState.profession.artifactUsesRemaining, 0);
  assert.equal(
    result.endState.profession.artifactStealthAttacksRemaining,
    0,
  );
});
