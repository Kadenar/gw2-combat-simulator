import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";

const repoUrl = (path) => new URL(`../../../${path}`, import.meta.url);

test("Power Tempest sword commands Flame Barrage off cooldown", async () => {
  const [savedBuild, savedRotation, adapter] = await Promise.all([
    readFile(
      repoUrl("Builds/elementalist/b-power-tempest-sword.json"),
      "utf8",
    ).then(JSON.parse),
    readFile(
      repoUrl("Rotations/elementalist/r-power-tempest-sword.json"),
      "utf8",
    ).then(JSON.parse),
    loadProfessionAppAdapter("elementalist"),
  ]);
  const build = adapter.toApplicationBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1,
  };

  adapter.recalculate(app);
  const result = adapter.runSimulation(app);
  const combatStart = result.steps.find(
    (step) => step.skill === "Combat Start",
  );
  const barrages = result.steps.filter(
    (step) => step.skill === "Flame Barrage",
  );
  const overloadHit = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.skillName === "Overload Air",
  );
  const procCounts = Object.fromEntries(
    [
      "Burning Precision",
      "Electric Discharge",
      "Lightning Jolt",
      "Sunspot",
    ].map((name) => [
      name,
      result.procSteps.filter((step) => step.skill === name).length,
    ]),
  );

  assert.equal(barrages.length, 9);
  assert.equal(
    result.steps.some((step) => step.skill === "Glyph of Elementals"),
    false,
  );
  assert.equal(barrages[0].start, combatStart.start);
  for (let index = 1; index < barrages.length; index += 1) {
    assert.equal(barrages[index].start - barrages[index - 1].start, 12000);
  }
  assert.ok(Math.abs(overloadHit.criticalChance - 0.9990476190476191) < 1e-12);
  assert.deepEqual(procCounts, {
    "Burning Precision": 19,
    "Electric Discharge": 24,
    "Lightning Jolt": 12,
    Sunspot: 7,
  });
  assert.deepEqual(result.warnings, []);
});
