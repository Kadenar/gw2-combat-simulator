import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  migrateWarriorBuild,
  validateWarriorBuild,
} from "../../../js/professions/warrior/build.js";
import { warriorCatalog } from "../../../js/professions/warrior/catalog.js";
import {
  recalculate,
  runSimulation,
} from "../../../js/professions/warrior/app/app-definition.js";
import { WARRIOR_SKILL_IDS as ID } from "../../../js/professions/warrior/data/ids.js";

test("Power Berserker Hammer/Axe-Mace preset follows the supplied report", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/warrior/b-power-berserker-hammer-axe-mace.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/warrior/r-power-berserker-hammer-axe-mace-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/warrior/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(validateWarriorBuild(raw), { valid: true, errors: [] });
  assert.deepEqual(raw.weapons, ["Hammer", ""]);
  assert.deepEqual(raw.alternateWeapons, ["Axe", "Mace"]);
  assert.equal(raw.startingWeaponSet, 2);
  assert.deepEqual(raw.weaponSigils, [
    ["Force", "Impact"],
    ["Force", "Air"],
  ]);
  assert.deepEqual(
    raw.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Strength", "3-3-1"],
      ["Defense", "3-3-3"],
      ["Berserker", "1-1-1"],
    ],
  );

  const preset = manifest
    .find((section) => section.section === "Berserker")
    .presets.find(({ label }) => label === "Power (Hammer + Axe/Mace)");
  assert.equal(preset.benchmarkDps, 42765);
  assert.equal(
    preset.dpsReportUrl,
    "https://dps.report/HQq4-20260716-224707_golem",
  );
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 94.55);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3966807);
  assert.equal(savedRotation.metadata.benchmarkDps, 41954.59545214172);
  assert.equal(savedRotation.rotation.length, 168);
  assert.deepEqual(savedRotation.rotation.slice(0, 2), [
    { name: "Head Butt" },
    { name: "__combat_start", offset: 700 },
  ]);
  assert.equal(
    savedRotation.rotation.filter(
      (command) =>
        (typeof command === "string" ? command : command.name) === "Decapitate",
    ).length,
    29,
  );
  assert.equal(
    savedRotation.rotation.filter(
      (command) =>
        (typeof command === "string" ? command : command.name) === "Throw Axe",
    ).length,
    7,
  );
  assert.equal(
    savedRotation.rotation.filter(
      (command) =>
        (typeof command === "string" ? command : command.name) ===
        "Cyclone Axe",
    ).length,
    11,
  );
  const firstTremorIndex = savedRotation.rotation.findIndex(
    (command) =>
      (typeof command === "string" ? command : command.name) === "Tremor",
  );
  assert.equal(
    savedRotation.rotation[firstTremorIndex + 1].name,
    "Cyclone Axe",
  );

  const build = migrateWarriorBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: warriorCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  assert.deepEqual(result.warnings, []);
  const combatStart = result.events.find(
    (event) => event.type === "combat_start",
  );
  assert.equal(combatStart.at, 0.7);
  const firstCycloneAxe = result.steps.find(
    (step) => step.skill === "Cyclone Axe",
  );
  assert.equal(firstCycloneAxe.start, 4680);

  const decapitateEvents = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.skillId === ID.DECAPITATE,
  );
  assert.ok(decapitateEvents.length > 0);
  assert.equal(
    decapitateEvents.every(
      (event) =>
        event.coefficient === 3 &&
        event.weaponStrengthProfileId === "weapon.axe",
    ),
    true,
  );
  const decapitateDamage = decapitateEvents.reduce(
    (total, event) => total + event.damage,
    0,
  );
  assert.ok(Math.abs(decapitateDamage / 893575 - 1) < 0.02);
  assert.ok(
    Math.abs(result.totalDamage / savedRotation.metadata.benchmarkDamage - 1) <
      0.01,
  );
  assert.ok(Math.abs(result.dps / preset.benchmarkDps - 1) < 0.03);
});
