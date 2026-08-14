import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadProfessionAppAdapter } from "../../js/app/profession/registry.js";

const DEFAULT_PROFESSIONS = [
  "elementalist",
  "engineer",
  "guardian",
  "mesmer",
  "necromancer",
  "ranger",
  "revenant",
  "thief",
  "warrior",
];

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function captureProfession(professionId) {
  const [manifest, adapter] = await Promise.all([
    readJson(`Builds/${professionId}/manifest.json`),
    loadProfessionAppAdapter(professionId),
  ]);
  if (!adapter) throw new Error(`${professionId} has no native app adapter.`);

  const metrics = [];
  for (const section of manifest) {
    for (const preset of section.presets) {
      if (!preset.rotation) continue;
      const [savedBuild, savedRotation] = await Promise.all([
        readJson(preset.build),
        readJson(preset.rotation),
      ]);
      const build = adapter.toApplicationBuild({
        ...savedBuild,
        rotation: savedRotation.rotation ?? savedRotation,
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
      metrics.push({
        id: `${professionId}|${section.section || ""}|${preset.label}`,
        profession: professionId,
        section: section.section || "",
        label: preset.label,
        build: preset.build,
        rotation: preset.rotation,
        benchmarkDps: preset.benchmarkDps,
        duration: result.duration,
        dps: result.dps,
        totalDamage: result.totalDamage,
        strikeDamage: result.strikeDamage,
        conditionDamage: result.conditionDamage,
        warnings: [...result.warnings],
      });
    }
  }
  return metrics;
}

export async function captureSupportedBuildMetrics(
  professions = DEFAULT_PROFESSIONS,
) {
  const unknown = professions.filter(
    (profession) => !DEFAULT_PROFESSIONS.includes(profession),
  );
  if (unknown.length) {
    throw new TypeError(`Unknown professions: ${unknown.join(", ")}.`);
  }

  const metrics = [];
  for (const profession of professions) {
    metrics.push(...(await captureProfession(profession)));
  }
  return metrics;
}

const isMain =
  process.argv[1] != null &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const requested = process.argv.slice(2);
  const metrics = await captureSupportedBuildMetrics(
    requested.length ? requested : DEFAULT_PROFESSIONS,
  );
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
}
