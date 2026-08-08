import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import { engineerApp } from "../../dist/js/professions/engineer/app/app-definition.js";
import {
  migrateEngineerBuild,
  toApplicationBuild,
} from "../../dist/js/professions/engineer/build.js";
import { engineerProfession } from "../../dist/js/professions/engineer/definition.js";
import { calculateRandomDistribution } from "../../dist/js/app/simulation/random-distribution.js";

const trials = Math.max(1, Number.parseInt(process.argv[2] || "30", 10));
const runs = Math.max(1, Number.parseInt(process.argv[3] || "5", 10));

const savedBuild = JSON.parse(
  readFileSync(
    new URL(
      "../../Builds/engineer/b-power-holosmith-sword-pistol.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const savedRotation = JSON.parse(
  readFileSync(
    new URL(
      "../../Rotations/engineer/r-power-holosmith-sword-pistol-bench.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const build = toApplicationBuild(
  migrateEngineerBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
    assumptions: {
      ...savedBuild.assumptions,
      simulationMode: "stochastic",
    },
  }),
);
const app = {
  adapter: engineerApp.appAdapter,
  profession: engineerProfession,
  build,
  results: null,
  attributeWeaponSet: 1,
  skillById: engineerProfession.catalog.skillsById,
  skillByName: engineerProfession.catalog.skillsByName,
};
engineerApp.recalculate(app);
const request = engineerApp.randomDistributionRequest(app);
assert.ok(request);

const implementations = process.argv.includes("--compare-full")
  ? [
      [
        "full",
        (input) =>
          calculateRandomDistribution(input, engineerApp.simulateBuild, {
            includeSamples: true,
          }),
      ],
      [
        "distribution",
        (input) =>
          engineerApp.calculateRandomDistribution(input, {
            includeSamples: true,
          }),
      ],
    ]
  : [
      [
        "distribution",
        (input) =>
          engineerApp.calculateRandomDistribution(input, {
            includeSamples: true,
          }),
      ],
    ];

for (const [, calculate] of implementations) {
  calculate({ ...request, trials: 3 });
}

const durations = new Map(implementations.map(([name]) => [name, []]));
let resultHash = "";
for (let run = 0; run < runs; run += 1) {
  const ordered =
    run % 2 === 0 ? implementations : [...implementations].reverse();
  for (const [name, calculate] of ordered) {
    globalThis.gc?.();
    const startedAt = performance.now();
    const distribution = calculate({ ...request, trials });
    durations.get(name).push(performance.now() - startedAt);
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          samples: distribution.samples,
          outcomes: distribution.outcomes,
        }),
      )
      .digest("hex");
    if (resultHash) assert.equal(hash, resultHash);
    resultHash = hash;
  }
}

const results = Object.fromEntries(
  [...durations].map(([name, values]) => {
    const sorted = [...values].sort((left, right) => left - right);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [
      name,
      {
        durationsMs: values.map((value) => Number(value.toFixed(2))),
        medianMs: Number(median.toFixed(2)),
        meanMs: Number(mean.toFixed(2)),
        medianPerTrialMs: Number((median / trials).toFixed(2)),
      },
    ];
  }),
);
console.log(
  JSON.stringify(
    {
      trials,
      runs,
      results,
      resultHash,
    },
    null,
    2,
  ),
);
