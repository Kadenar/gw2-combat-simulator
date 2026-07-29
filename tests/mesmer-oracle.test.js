import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertMesmerResultParity,
} from "./helpers/mesmer-simulation-oracle.js";
import {
  defaultSimulationConfig,
} from "./helpers/fixture-harness-core.js";
import {
  simulateMesmer,
} from "./helpers/mesmer-simulation.js";

const fixtureDirectory = path.resolve(
  "tests",
  "fixtures",
  "mesmer-migration",
);

async function loadFixtures() {
  const files = (await readdir(fixtureDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  return Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(path.join(fixtureDirectory, file), "utf8")),
    ),
  );
}

test("Mesmer migration fixtures match checked-in expectations", async (t) => {
  const fixtures = await loadFixtures();
  for (const fixture of fixtures) {
    await t.test(fixture.name, () => {
      const config = defaultSimulationConfig(fixture.config);
      const actual = simulateMesmer(fixture.rotation, config);
      assertMesmerResultParity(fixture.name, fixture.expected, actual);
    });
  }
});
