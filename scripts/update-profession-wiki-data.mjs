import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  fetchProfessionWikiSkillSnapshot,
  serializeWikiSkillSnapshot,
} from "./lib/gw2-wiki-snapshot.mjs";
import { normalizeProfessionName } from "./update-profession-api-data.mjs";

const CATEGORIES = Object.freeze({
  Engineer: Object.freeze([
    "Engineer skills",
    "Scrapper skills",
    "Holosmith skills",
    "Mechanist skills",
    "Amalgam skills",
  ]),
  Revenant: Object.freeze([
    "Revenant skills",
    "Herald skills",
    "Renegade skills",
    "Vindicator skills",
    "Conduit skills",
  ]),
  Thief: Object.freeze([
    "Thief skills",
    "Daredevil skills",
    "Deadeye skills",
    "Specter skills",
    "Antiquary skills",
  ]),
});

export function professionWikiCategories(professionName) {
  const normalized = normalizeProfessionName(professionName);
  const categories = CATEGORIES[normalized];
  if (!categories) {
    throw new Error(`No wiki skill categories configured for ${normalized}.`);
  }
  return categories;
}

export async function updateProfessionWikiData(
  professionName,
  {
    snapshotDate = new Date().toISOString().slice(0, 10),
    output: requestedOutput,
    fetchOptions,
    log = console.log,
  } = {},
) {
  const normalized = normalizeProfessionName(professionName);
  const categories = professionWikiCategories(normalized);
  const skills = await fetchProfessionWikiSkillSnapshot({
    professionName: normalized,
    categories,
    options: fetchOptions,
  });
  const id = normalized.toLowerCase();
  const output = requestedOutput
    ? path.resolve(requestedOutput)
    : path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        `../js/professions/${id}/data/${id}-wiki-skill-research.js`,
      );
  const source = serializeWikiSkillSnapshot({
    professionName: normalized,
    snapshotDate,
    categories,
    skills,
  });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
  log(`Wrote ${skills.length} ${normalized} wiki skill records to ${output}.`);
  return { output, categories, skills };
}

function parseProfession(args) {
  const index = args.indexOf("--profession");
  return normalizeProfessionName(index < 0 ? "" : args[index + 1]);
}

export async function main(args = process.argv.slice(2)) {
  return updateProfessionWikiData(parseProfession(args));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) await main();
