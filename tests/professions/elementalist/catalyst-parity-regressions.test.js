import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";
import { elementalistCatalog } from "../../../js/professions/elementalist/catalog.js";
import {
  runSimulation,
  simulationConfig,
} from "../../../js/professions/elementalist/app/app-definition.js";
import { applyCatalystEmpowerment } from "../../../js/professions/elementalist/specializations/catalyst/resolver.js";
import { catalystAttributeRules } from "../../../js/professions/elementalist/specializations/catalyst/rules.js";
import { createCatalystState } from "../../../js/professions/elementalist/specializations/catalyst/state.js";

const repoUrl = (path) => new URL(`../../../${path}`, import.meta.url);

async function loadCatalystFixture(variant) {
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

test("Catalyst empowerment uses only eligible build-stat sources", async () => {
  const { app } = await loadCatalystFixture("condi-catalyst-pistol");
  const config = simulationConfig(app);
  const sources = ["base", "gear", "runes", "infusions", "food"];
  const attributes = {
    power: "Power",
    precision: "Precision",
    ferocity: "Ferocity",
    conditionDamage: "Condition Damage",
    expertise: "Expertise",
    concentration: "Concentration",
  };
  const expected = Object.fromEntries(
    Object.entries(attributes).map(([key, name]) => [
      key,
      sources.reduce(
        (total, source) =>
          total + Number(app.attributeData.attributes[name][source] || 0),
        0,
      ),
    ]),
  );

  assert.deepEqual(config.catalystEmpowermentPool, expected);
  assert.equal(config.catalystEmpowermentPool.conditionDamage, 1553);
  assert.equal(app.attributeData.attributes["Condition Damage"].final, 1947);
});

test("Elemental Empowerment keeps three base stacks and seven timed stacks", () => {
  const state = createCatalystState();
  const context = {
    profession: {
      specialization: { kind: "Catalyst", state },
    },
  };

  for (let index = 1; index <= 8; index += 1) {
    applyCatalystEmpowerment(context, {
      type: "buff",
      at: index,
      kind: "elemental empowerment",
      stacks: 1,
      duration: 20,
    });
  }

  assert.deepEqual(
    state.elementalEmpowermentExpiries,
    [22, 23, 24, 25, 26, 27, 28],
  );

  const attributes = catalystAttributeRules.modifyAttributes(
    {
      traits: new Set(["Elemental Empowerment", "Empowered Empowerment"]),
      config: {
        catalystEmpowermentPool: {
          power: 1000,
          precision: 1000,
          ferocity: 1000,
          conditionDamage: 1000,
          expertise: 1000,
          concentration: 1000,
        },
      },
      runtime: {
        combatStartTime: 0,
        profession: {
          specialization: { kind: "Catalyst", state },
        },
      },
      time: 10,
    },
    {
      power: 1500,
      precision: 1500,
      ferocity: 1500,
      conditionDamage: 1500,
      expertise: 1500,
      concentration: 1500,
    },
  );

  assert.deepEqual(attributes, {
    power: 1700,
    precision: 1700,
    ferocity: 1700,
    conditionDamage: 1700,
    expertise: 1700,
    concentration: 1700,
  });
});

test("Catalyst zero-damage finishers preserve combo metadata", () => {
  const zeroCoefficientFinisher = (name, finisherType) =>
    elementalistCatalog.skillsByName
      .get(name)
      .effects.flatMap((effect) => effect.ticks || [])
      .some(
        (tick) =>
          tick.coefficient === 0 &&
          tick.comboFinishers?.some(
            (finisher) => finisher.finisherType === finisherType,
          ),
      );

  assert.equal(zeroCoefficientFinisher("Churning Earth", "Blast"), true);
  assert.equal(zeroCoefficientFinisher("Aerial Agility", "Leap"), true);
  assert.equal(zeroCoefficientFinisher("Aerial Agility (dash)", "Leap"), true);
});

test("Steamshrieker remains selected and resolves every water combo", async () => {
  const { build, result } = await loadCatalystFixture("condi-catalyst-pistol");
  const waterCombos = result.resolvedEvents.filter(
    (event) =>
      event.type === "combo" &&
      event.actorType === "player" &&
      event.fieldType === "Water" &&
      ["Blast", "Leap"].includes(event.finisherType),
  );
  const applications = result.resolvedEvents.filter(
    (event) => event.skillName === "Relic of Steamshrieker",
  );

  assert.equal(build.relic, "Steamshrieker");
  assert.ok(waterCombos.length > 0);
  assert.equal(applications.length, waterCombos.length);
  assert.deepEqual(
    applications.map((event) => event.triggeredBy).sort(),
    waterCombos.map((event) => event.skillName).sort(),
  );
  assert.equal(
    result.procSteps.filter((step) => step.skill === "Relic of Steamshrieker")
      .length,
    waterCombos.length,
  );
});

test("Vicious Empowerment follows resolved control and Immobilize events", async () => {
  const { result } = await loadCatalystFixture(
    "condi-quick-catalyst-pistol-warhorn",
  );
  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  ).start;
  const procs = result.procSteps.filter(
    (step) => step.skill === "Vicious Empowerment",
  );

  assert.equal(procs.length, 30);
  assert.equal(
    procs.every((step) => step.start >= combatStart),
    true,
  );
  assert.deepEqual([...new Set(procs.map((step) => step.sourceSkill))].sort(), [
    "Boulder Blast",
    "Cyclone",
    "Dazing Discharge",
    "Signet of Earth",
    "Tidal Surge",
  ]);
});

test("Catalyst hit energy is credited in event chronology", async () => {
  const expectedWarnings = new Map([
    [
      "condi-quick-catalyst-pistol-dagger",
      [
        "Elemental Explosion is unavailable — requires all four elemental bullets.",
        "Flame Barrage cannot start before the current simulation clock.",
      ],
    ],
  ]);

  for (const variant of [
    "condi-quick-catalyst-pistol-dagger",
    "inferno-catalyst",
    "power-catalyst-spear",
  ]) {
    const { result } = await loadCatalystFixture(variant);
    assert.deepEqual(
      result.warnings,
      expectedWarnings.get(variant) || [],
      variant,
    );
  }
});

test("Catalyst aura modifiers precede the same-time Sunspot strike", async () => {
  const { result } = await loadCatalystFixture("inferno-catalyst");
  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  ).start;
  const firstEmpoweringAura = result.procSteps.find(
    (step) => step.skill === "Empowering Auras",
  );
  const firstSunspotEvents = result.events.filter(
    (event) => event.skillName === "Sunspot",
  );
  const aura = firstSunspotEvents.find(
    (event) => event.type === "elementalist.aura",
  );
  const strike = firstSunspotEvents.find((event) => event.type === "damage");

  assert.equal(firstEmpoweringAura.start < combatStart, true);
  assert.equal(aura.at, strike.at);
  assert.equal(aura.__order < strike.__order, true);
});

test("Shattering Ice procs from delayed hits already in the resolver queue", async () => {
  const { result } = await loadCatalystFixture("power-catalyst-spear");
  const hits = result.breakdown
    .filter((entry) => entry.name === "Shattering Ice Proc")
    .reduce((total, entry) => total + entry.hits, 0);

  assert.equal(hits, 36);
});
