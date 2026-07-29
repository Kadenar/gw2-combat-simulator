import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  loadProfession,
  professionOptions,
  professionRegistry,
} from "../js/app/profession-registry.js";
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
import {
  checkRelicOnHit,
} from "../js/professions/elementalist/sim/mechanics/sim-relic-helpers.js";
import {
  getRelicState,
} from "../js/professions/elementalist/sim/state/sim-relic-state.js";
import {
  RELIC_PROCS,
} from "../js/professions/elementalist/simulation.js";

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
  assert.deepEqual(
    PROFESSION_ROUTES,
    Object.fromEntries(
      professionRegistry.map(({ id, route }) => [id, route]),
    ),
  );
  assert.equal(professionRoute("elementalist"), "elementalist.html");
  assert.equal(professionRoute("unknown"), "index.html");
  assert.deepEqual(
    professionOptions,
    professionRegistry.map(({ id, name }) => ({ id, name })),
  );
});

test("Elementalist is registered through the generic profession contract", async () => {
  const profession = await loadProfession("elementalist");
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

test("Elementalist Aristocracy uses a strict one-second ICD", () => {
  const procSteps = [];
  const state = {
    activeRelic: "Aristocracy",
    relicProc: RELIC_PROCS.Aristocracy,
    att: "Air",
  };
  const context = {
    S: state,
    log() {},
    addStep(step) {
      procSteps.push(step);
    },
  };
  const trigger = (skill, time) => checkRelicOnHit(context, {
    skill,
    time,
    conds: {
      Vulnerability: { stacks: 1, duration: 5 },
    },
  });

  trigger("First", 100);
  assert.equal(state.relicProc.icd, 1000);
  trigger("Exact boundary", 1100);
  assert.equal(getRelicState(state).aristocracyStacks, 1);

  trigger("After boundary", 1101);
  assert.equal(getRelicState(state).aristocracyStacks, 2);
  assert.equal(state.relicICD.Aristocracy, 2101);
  assert.deepEqual(
    procSteps.map(({ skill, detail }) => ({ skill, detail })),
    [
      { skill: "Relic of Aristocracy", detail: "1/5 stacks" },
      { skill: "Relic of Aristocracy", detail: "2/5 stacks" },
    ],
  );
});

test("Elementalist Shackles queues its expiry strike and observes its ICD", () => {
  const queuedHits = [];
  const procSteps = [];
  const state = {
    activeRelic: "Shackles",
    relicProc: RELIC_PROCS.Shackles,
    att: "Earth",
  };
  const context = {
    S: state,
    log() {},
    addStep(step) {
      procSteps.push(step);
    },
    queueHitEvent(event) {
      queuedHits.push(event);
    },
  };
  const trigger = (skill, time) => checkRelicOnHit(context, {
    skill,
    time,
    conds: {
      Immobilize: { stacks: 1, duration: 2 },
    },
  });

  trigger("First Immobilize", 100);
  trigger("Exact ICD Boundary", 10100);
  trigger("After ICD Boundary", 10101);

  assert.equal(state.relicICD.Shackles, 20101);
  assert.deepEqual(
    queuedHits.map(event => ({
      time: event.time,
      skill: event.skill,
      coefficient: event.dmg,
      weaponStrength: event.ws,
      isRelicProc: event.isRelicProc,
    })),
    [
      {
        time: 5100,
        skill: "Relic of the Shackles",
        coefficient: 3,
        weaponStrength: 690.5,
        isRelicProc: true,
      },
      {
        time: 15101,
        skill: "Relic of the Shackles",
        coefficient: 3,
        weaponStrength: 690.5,
        isRelicProc: true,
      },
    ],
  );
  assert.deepEqual(
    procSteps.map(({ skill, start, detail, icon }) => ({
      skill,
      start,
      detail,
      icon,
    })),
    [
      {
        skill: "Relic of the Shackles",
        start: 100,
        detail: "tethered by First Immobilize",
        icon: "https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png",
      },
      {
        skill: "Relic of the Shackles",
        start: 10101,
        detail: "tethered by After ICD Boundary",
        icon: "https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png",
      },
    ],
  );
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
