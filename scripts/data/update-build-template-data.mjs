import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_URL =
  "https://api.guildwars2.com/v2/professions?ids=all&v=latest&lang=en";
const OUTPUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../js/platform/gw2/build-template-data.ts",
);

/** Refreshes the checked-in palette map so imports never require live API access. */
async function main() {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Guild Wars 2 API request failed (${response.status}).`);
  }
  const professions = await response.json();
  if (!Array.isArray(professions) || professions.length !== 9) {
    throw new Error("Guild Wars 2 API returned an incomplete profession list.");
  }
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const lines = [
    "// Generated from the official Guild Wars 2 /v2/professions palette map.",
    `// Snapshot: ${snapshotDate}. Run scripts/data/update-build-template-data.mjs to refresh.`,
    "",
    "export interface Gw2BuildTemplateProfessionData {",
    "  readonly paletteEntries: readonly (readonly [number, number])[];",
    "}",
    "",
    "/** Resolves build-template profession and palette IDs without a runtime API call. */",
    "export const GW2_BUILD_TEMPLATE_PROFESSIONS: Readonly<",
    "  Record<number, Gw2BuildTemplateProfessionData>",
    "> = Object.freeze({",
  ];
  for (const profession of professions.sort(
    (left, right) => left.code - right.code,
  )) {
    lines.push(
      `  ${profession.code}: {`,
      "    paletteEntries: Object.freeze([",
    );
    for (const [paletteId, skillId] of profession.skills_by_palette.sort(
      (left, right) => left[0] - right[0],
    )) {
      lines.push(`      [${paletteId}, ${skillId}],`);
    }
    lines.push("    ]) as readonly (readonly [number, number])[],", "  },");
  }
  lines.push("});", "");
  await writeFile(OUTPUT, lines.join("\n"), "utf8");
  console.log(`Wrote ${OUTPUT}.`);
}

await main();
