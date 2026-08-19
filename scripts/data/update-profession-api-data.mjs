import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchProfessionSnapshot, writeProfessionSnapshot } from './lib/gw2-profession-snapshot.mjs';

export function normalizeProfessionName(value) {
  const normalized = String(value || '').trim();

  if (!/^[a-z][a-z0-9]*$/i.test(normalized)) {
    throw new Error(`Invalid Guild Wars 2 profession "${normalized || '<missing>'}".`);
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export function parseProfession(args) {
  const index = args.indexOf('--profession');
  const value = index >= 0 ? args[index + 1] : '';

  return normalizeProfessionName(value);
}

export async function updateProfessionApiData(
  professionName,
  { fetchImpl = fetch, snapshotDate, snapshotConfig, output: requestedOutput, log = console.log } = {}
) {
  const normalizedProfession = normalizeProfessionName(professionName);
  const config = snapshotConfig || {};
  const id = normalizedProfession.toLowerCase();
  const output = requestedOutput
    ? path.resolve(requestedOutput)
    : path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        `../../js/professions/${id}/data/${id}-api-metadata.js`
      );
  const snapshot = await fetchProfessionSnapshot({
    professionName: normalizedProfession,
    config,
    fetchImpl
  });

  await writeProfessionSnapshot({
    output,
    professionName: normalizedProfession,
    snapshotDate,
    ...snapshot
  });
  const traitCount = snapshot.specializations.reduce(
    (sum, specialization) => sum + specialization.minorTraits.length + specialization.majorTraits.flat().length,
    0
  );

  log(
    `Wrote ${snapshot.skills.length} skills, ${traitCount} traits, ` +
      `${snapshot.specializations.length} specializations to ${output}.`
  );

  return { output, ...snapshot };
}

export async function main(args = process.argv.slice(2)) {
  return updateProfessionApiData(parseProfession(args));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) {
  await main();
}
