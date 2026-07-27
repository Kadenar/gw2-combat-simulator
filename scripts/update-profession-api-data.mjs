import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  fetchProfessionSnapshot,
  writeProfessionSnapshot,
} from "./lib/gw2-profession-snapshot.mjs";

const PROFESSION_CONFIG = Object.freeze({
  Guardian: Object.freeze({}),
  Mesmer: Object.freeze({}),
  Necromancer: Object.freeze({
    canonicalSameNameAliasIds: Object.freeze({
      "Manifest Sand Shade": 44946,
    }),
  }),
});

function parseProfession(args) {
  const index = args.indexOf("--profession");
  const value = index >= 0 ? args[index + 1] : "";
  const normalized = String(value || "");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export async function updateProfessionApiData(
  professionName,
  {
    fetchImpl = fetch,
    snapshotDate,
  } = {},
) {
  const config = PROFESSION_CONFIG[professionName];
  if (!config) {
    throw new Error(
      `Unsupported native profession "${professionName || "<missing>"}".`,
    );
  }
  const id = professionName.toLowerCase();
  const output = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    `../js/professions/${id}/data/${id}-api-metadata.js`,
  );
  const snapshot = await fetchProfessionSnapshot({
    professionName,
    config,
    fetchImpl,
  });
  await writeProfessionSnapshot({
    output,
    professionName,
    snapshotDate,
    ...snapshot,
  });
  const traitCount = snapshot.specializations.reduce(
    (sum, specialization) =>
      sum
      + specialization.minorTraits.length
      + specialization.majorTraits.flat().length,
    0,
  );
  console.log(
    `Wrote ${snapshot.skills.length} skills, ${traitCount} traits, `
    + `${snapshot.specializations.length} specializations to ${output}.`,
  );
  return { output, ...snapshot };
}

export async function main(args = process.argv.slice(2)) {
  return updateProfessionApiData(parseProfession(args));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  await main();
}
