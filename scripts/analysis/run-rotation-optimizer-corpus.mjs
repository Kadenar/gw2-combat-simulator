import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";

import {
  loadProfessionAppAdapter,
  nativeProfessionRegistry,
} from "../../js/app/profession/registry.js";
import { enumerateRotationOptimizerCandidates } from "../../js/rotation-optimizer/candidates.js";
import { splitRotationAtCombatStart } from "../../js/rotation-optimizer/normalization.js";
import { loadRotationOptimizerSimulation } from "../../js/rotation-optimizer/profession-loader.js";
import { runRotationSearch } from "../../js/rotation-optimizer/search.js";

const repoUrl = (path) => new URL(`../../${path}`, import.meta.url);

function numericArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} requires a positive number.`);
  }
  return Math.round(value);
}

const horizonMs = numericArgument("--horizon-ms", 10_000);
const evaluationBudget = numericArgument("--evaluation-budget", 3);
const wallClockLimitMs = numericArgument("--wall-clock-limit-ms", 10_000);
const rows = [];

for (const registryEntry of nativeProfessionRegistry) {
  const professionId = registryEntry.id;
  const manifest = JSON.parse(
    await readFile(repoUrl(`Builds/${professionId}/manifest.json`), "utf8"),
  );
  const adapter = await loadProfessionAppAdapter(professionId);
  const simulate = await loadRotationOptimizerSimulation(professionId);
  if (!adapter || !simulate) {
    throw new Error(`${professionId} has no optimizer simulation adapter.`);
  }

  for (const section of manifest) {
    for (const preset of section.presets) {
      if (!preset.rotation) continue;
      const label = `${professionId}: ${section.section} / ${preset.label}`;
      const startedAt = performance.now();
      try {
        const [savedBuild, savedRotation] = await Promise.all([
          readFile(repoUrl(preset.build), "utf8").then(JSON.parse),
          readFile(repoUrl(preset.rotation), "utf8").then(JSON.parse),
        ]);
        const build = adapter.toApplicationBuild({
          ...savedBuild,
          rotation: savedRotation.rotation ?? savedRotation,
        });
        const app = {
          build,
          adapter,
          profession: adapter.profession,
          skills: [...adapter.profession.catalog.skills],
          skillByName: adapter.profession.catalog.skillsByName,
          skillById: adapter.profession.catalog.skillsById,
          attributeWeaponSet: 1,
          rotationInsertionIndex: null,
          results: null,
        };
        adapter.recalculate(app);
        app.results = adapter.runSimulation(app);
        const split = splitRotationAtCombatStart(build.rotation);
        const config = adapter.simulationConfig(app);
        const result = runRotationSearch(
          {
            professionId,
            config,
            candidates: enumerateRotationOptimizerCandidates(app),
            setupRotation: split.setupRotation,
            incumbentRotation: split.combatRotation,
            horizonMs,
            evaluationBudget,
            wallClockLimitMs,
            seed: 1,
            objective: "fixed-window-dps",
          },
          simulate,
        );
        const replay = simulate(result.rotation, {
          ...config,
          randomness: { mode: "deterministic", seed: 1 },
        });
        const invalidActions = replay.steps.filter((step) => step.invalid).length;
        const replayMismatch =
          Math.abs(Number(replay.dps || 0) - result.dps) > 0.01 ||
          Math.abs(Number(replay.totalDamage || 0) - result.totalDamage) > 0.01;
        rows.push({
          label,
          baselineDps: result.baselineDps,
          resultDps: result.dps,
          improvementDps: result.improvementDps,
          improvementPercent: result.improvementPercent,
          invalidActions,
          replayMismatch,
          evaluated: result.evaluated,
          exactEvaluations: result.exactEvaluations,
          projectedEvaluations: result.projectedEvaluations,
          stopReason: result.diagnostics.stopReason,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        rows.push({
          label,
          error: error instanceof Error ? error.message : String(error),
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      }
    }
  }
}

const errors = rows.filter((row) => row.error);
const regressions = rows.filter(
  (row) => !row.error && row.resultDps + 0.01 < row.baselineDps,
);
const invalidCasts = rows.reduce(
  (total, row) => total + Number(row.invalidActions || 0),
  0,
);
const replayMismatches = rows.filter((row) => row.replayMismatch);
const summary = {
  builds: rows.length,
  errors: errors.length,
  regressions: regressions.length,
  invalidCasts,
  replayMismatches: replayMismatches.length,
  horizonMs,
  evaluationBudget,
  elapsedMs: rows.reduce((total, row) => total + row.elapsedMs, 0),
};

console.log(JSON.stringify({ summary, rows }, null, 2));
if (
  errors.length ||
  regressions.length ||
  invalidCasts ||
  replayMismatches.length
) {
  process.exitCode = 1;
}
