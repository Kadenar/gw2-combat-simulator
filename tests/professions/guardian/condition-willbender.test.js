import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  recalculate,
  runSimulation,
} from "../../../js/professions/guardian/app/app-definition.js";
import { buildChartSeries } from "../../../js/app/rotation/result-model.js";
import { migrateGuardianBuild } from "../../../js/professions/guardian/build.js";
import { guardianCatalog } from "../../../js/professions/guardian/catalog.js";

const buildUrl = new URL(
  "../../../Builds/guardian/b-condi-willbender-pistol-torch.json",
  import.meta.url,
);
const rotationUrl = new URL(
  "../../../Rotations/guardian/r-condi-willbender-pistol-torch-bench.json",
  import.meta.url,
);

test("condition Willbender preset reproduces the supplied benchmark", async () => {
  const [savedBuild, savedRotation] = await Promise.all([
    readFile(buildUrl, "utf8").then(JSON.parse),
    readFile(rotationUrl, "utf8").then(JSON.parse),
  ]);
  const build = migrateGuardianBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: guardianCatalog.skillsByName,
    skillById: guardianCatalog.skillsById,
    attributeWeaponSet: 1,
  };

  recalculate(app);
  const result = runSimulation(app);
  const chartSeries = buildChartSeries(result);
  const actions = result.events.filter((event) => event.type === "action");
  const actionCount = (name) =>
    actions.filter((event) => event.skillName === name).length;
  const burningStacks = (name) =>
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" &&
          event.condition === "Burning" &&
          event.name === name,
      )
      .reduce((total, event) => total + Number(event.stacks || 1), 0);
  const justiceBurns = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.name === "Justice — Active Burning",
  );
  const rushingJusticeActions = actions.filter(
    (event) => event.skillName === "Rushing Justice",
  );
  const eligibleVirtueHits = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      Number(event.coefficient || 0) > 0 &&
      (event.actorType === "player" || event.sourceId === "sigil.air"),
  );
  const justiceSegments = rushingJusticeActions.map((action, index) => {
    const start = action.at + 0.04;
    const end =
      (rushingJusticeActions[index + 1]?.at == null
        ? null
        : rushingJusticeActions[index + 1].at + 0.04) ??
      result.deathTime ??
      result.duration;
    return {
      hits: eligibleVirtueHits.filter(
        (event) => event.at >= start - 1e-9 && event.at < end - 1e-9,
      ).length,
      burns: justiceBurns.filter(
        (event) => event.at >= start - 1e-9 && event.at < end - 1e-9,
      ).length,
    };
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round(result.dps), 42343);
  assert.equal(actionCount("Flowing Resolve"), 8);
  assert.equal(actionCount("Rushing Justice"), 11);
  assert.equal(actionCount("Zealot's Fire"), 12);
  assert.equal(burningStacks("Justice — Active Burning"), 161);
  assert.equal(
    justiceBurns.every((event) => event.effectiveDuration === 4.8),
    true,
  );
  assert.equal(burningStacks("Peacekeeper — Burning"), 95);
  assert.equal(burningStacks("Whirling Light — Burning Bolt"), 16);
  assert.equal(
    justiceBurns.filter((event) => event.triggeredBy === "Sigil of Air").length,
    4,
  );
  assert.equal(
    justiceSegments.some(({ hits, burns }) => burns * 3 > hits),
    true,
    "Justice's hit counter should carry across active Rushing Justice refreshes",
  );
  assert.equal(savedBuild.rune, "Balthazar");
  assert.equal(savedBuild.relic, "Fractal");
  assert.equal(savedBuild.food, "Cilantro and Cured Meat Flatbread");
  assert.equal(savedBuild.utility, "Toxic Tuning Crystal");
  assert.deepEqual(savedBuild.specializations, [
    { name: "Radiance", traits: "2-2-1" },
    { name: "Virtues", traits: "3-1-1" },
    { name: "Willbender", traits: "1-1-2" },
  ]);
  assert.equal(
    savedBuild.infusions.find(
      (infusion) => infusion.stat === "Condition Damage",
    )?.count,
    18,
  );
  assert.equal(savedBuild.startingWeaponSet, 2);
  assert.deepEqual(savedBuild.weapons, ["Pistol", "Torch"]);
  assert.deepEqual(savedBuild.alternateWeapons, ["Pistol", "Pistol"]);
  assert.deepEqual(savedBuild.weaponSigils, [
    ["Bursting", "Air"],
    ["Bursting", "Torment"],
  ]);
  assert.equal(savedRotation.rotation[0], "Flowing Resolve");
  assert.equal(
    Math.max(...chartSeries.effects["Lethal Tempo"].map((point) => point.v)),
    5,
  );
  assert.equal(
    Math.max(
      ...chartSeries.effects["Inspiring Virtue"].map((point) => point.v),
    ),
    1,
  );
});
