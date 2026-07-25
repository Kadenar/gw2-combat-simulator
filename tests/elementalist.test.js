import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getProfession, professionOptions } from "../js/app/composition.js";
import {
  PROFESSION_ROUTES,
  professionRoute,
} from "../js/app/profession-selector.js";
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  validateElementalistBuild,
} from "../js/professions/elementalist/build.js";
import {
  createDefaultPermaBoons,
} from "../js/professions/elementalist/app/app-state.js";
import {
  loadSkillHits,
  loadSkills,
} from "../js/professions/elementalist/data/csv-loader.js";
import {
  calcBuildAttributes,
  createSimulationEngine,
  runSimulationContributions,
} from "../js/professions/elementalist/sim/run/sim-runner.js";

const skillsCsv = new URL(
  "../csv input/Tool_Elementalist - Skills_data.csv",
  import.meta.url,
);
const hitsCsv = new URL(
  "../csv input/Tool_Elementalist - Skill_hits_data.csv",
  import.meta.url,
);
const professionRoot = new URL(
  "../js/professions/elementalist/",
  import.meta.url,
);

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const target = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) return javascriptFiles(target);
    return entry.name.endsWith(".js") ? [target] : [];
  }));
  return nested.flat();
}

test("profession selector exposes every ready application route", () => {
  assert.deepEqual(PROFESSION_ROUTES, {
    mesmer: "index.html",
    elementalist: "elementalist.html",
    guardian: "guardian.html",
  });
  assert.equal(professionRoute("elementalist"), "elementalist.html");
  assert.equal(professionRoute("unknown"), "index.html");
  assert.deepEqual(
    professionOptions.map(({ id }) => id),
    ["mesmer", "elementalist", "guardian"],
  );
});

test("Elementalist is registered through the generic profession contract", async () => {
  const profession = await getProfession("elementalist");
  assert.equal(profession.id, "elementalist");
  assert.equal(profession.name, "Elementalist");
  assert.ok(profession.catalog.specializations.length >= 9);
  assert.ok(profession.catalog.traits.length > 0);
  assert.equal(typeof profession.simulation.Engine, "function");
});

test("Elementalist build defaults and legacy builds migrate explicitly", () => {
  const defaults = createElementalistBuildDefaults();
  assert.equal(defaults.profession, "elementalist");
  assert.equal(defaults.weapons[0], "Sword");
  assert.equal(validateElementalistBuild(defaults).valid, true);

  const migrated = migrateElementalistBuild({
    weapons: ["Scepter", "Warhorn"],
    specializations: defaults.specializations,
  });
  assert.equal(migrated.profession, "elementalist");
  assert.deepEqual(migrated.weapons, ["Scepter", "Warhorn"]);
  assert.equal(validateElementalistBuild(migrated).valid, true);
});

test("ported Elementalist data runs through the reference simulation engine", async () => {
  const [skillsText, hitsText] = await Promise.all([
    readFile(skillsCsv, "utf8"),
    readFile(hitsCsv, "utf8"),
  ]);
  const data = {
    skills: loadSkills(skillsText),
    skillHits: loadSkillHits(hitsText),
  };
  assert.ok(data.skills.length > 100);
  assert.ok(Object.keys(data.skillHits).length > 100);

  const build = createElementalistBuildDefaults();
  const attributes = calcBuildAttributes(build, {});
  const simulation = createSimulationEngine(data, attributes);
  simulation.rotation = ["Flame Uprising"];

  const result = runSimulationContributions({
    sim: simulation,
    activeAttunement: "Fire",
    secondaryAttunement: "Air",
    evokerElement: null,
    permaBoons: createDefaultPermaBoons(),
  });

  assert.ok(result.totalDamage > 0);
  assert.ok(result.dps > 0);
});

test("Elementalist Relic of the Claw displays activation and refresh procs", async () => {
  const [skillsText, hitsText] = await Promise.all([
    readFile(skillsCsv, "utf8"),
    readFile(hitsCsv, "utf8"),
  ]);
  const data = {
    skills: loadSkills(skillsText),
    skillHits: loadSkillHits(hitsText),
  };
  const build = createElementalistBuildDefaults();
  build.relic = "Claw";
  const simulation = createSimulationEngine(
    data,
    calcBuildAttributes(build, {}),
  );
  simulation.rotation = ["Polaric Leap", "Updraft"];

  const result = simulation.run("Air", null, null, {});
  const clawProcs = result.steps
    .filter(step => step.type === "relic_proc")
    .map(({ skill, detail, icon }) => ({ skill, detail, icon }));

  assert.deepEqual(clawProcs, [
    {
      skill: "Relic of the Claw",
      detail: "activated",
      icon: "https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png",
    },
    {
      skill: "Relic of the Claw",
      detail: "refreshed",
      icon: "https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png",
    },
  ]);
});

test("every relative import in the Elementalist package resolves", async () => {
  const files = await javascriptFiles(professionRoot);
  assert.ok(files.length > 50);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = source.matchAll(
      /(?:from\s+|import\s*)["'](\.[^"']+)["']/g,
    );
    for (const match of imports) {
      const specifier = match[1].split("?")[0];
      const target = new URL(specifier, file);
      await assert.doesNotReject(
        access(target),
        `${path.relative(process.cwd(), file.pathname)} -> ${specifier}`,
      );
    }
  }
});
