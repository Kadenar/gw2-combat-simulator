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
  const step = (rotationIndex) =>
    result.steps.find((candidate) => candidate.ri === rotationIndex);

  assert.deepEqual(
    [113, 114, 115].map((rotationIndex) => ({
      rotationIndex,
      skill: step(rotationIndex)?.skill,
      start: step(rotationIndex)?.start,
      end: step(rotationIndex)?.end,
    })),
    [
      {
        rotationIndex: 113,
        skill: "Scorching Shot",
        start: 63682,
        end: 64202,
      },
      {
        rotationIndex: 114,
        skill: "Feel the Burn!",
        start: 64349,
        end: 64349,
      },
      {
        rotationIndex: 115,
        skill: "Scorching Shot",
        start: 64349,
        end: 64869,
      },
    ],
  );
  assert.deepEqual(result.warnings, []);
});
