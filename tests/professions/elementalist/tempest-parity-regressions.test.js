import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";

const repoUrl = (path) => new URL(`../../../${path}`, import.meta.url);

test("delayed Tempest shouts do not advance the serial rotation lane", async () => {
  const [savedBuild, savedRotation, adapter] = await Promise.all([
    readFile(
      repoUrl("Builds/elementalist/b-condi-alac-tempest-pistol.json"),
      "utf8",
    ).then(JSON.parse),
    readFile(
      repoUrl("Rotations/elementalist/r-condi-alac-tempest-pistol.json"),
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
  const shout = result.steps.find(
    (step) =>
      step.skill === "Feel the Burn!" &&
      result.steps.find((candidate) => candidate.ri === step.ri + 1)?.skill ===
        "Scorching Shot",
  );
  assert.ok(shout);
  const followingSerialCast = result.steps.find(
    (step) => step.ri === shout.ri + 1,
  );
  assert.ok(followingSerialCast);

  assert.equal(shout.start, shout.end);
  assert.equal(followingSerialCast.start, shout.start);
  assert.equal(
    result.warnings.some((warning) => warning.includes("Feel the Burn!")),
    false,
  );
});
