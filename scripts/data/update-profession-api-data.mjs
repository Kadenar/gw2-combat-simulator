import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchProfessionSnapshot, writeProfessionSnapshot } from './lib/gw2-profession-snapshot.mjs';

const STABLE_THIEF_ARTIFACT_SKILL_IDS = Object.freeze([76633, 76674, 76702]);
const SIMULATOR_OMITTED_SKILL_IDS = Object.freeze({
  Engineer: Object.freeze([5825, 5832, 5860, 5861, 5862, 5910]),
  Guardian: Object.freeze([9150, 9182, 9245, 29786, 30461, 30871, 41571, 68676]),
  Ranger: Object.freeze([12494, 12500, 12502, 12542, 12550, 31582, 31746, 34309, 45142, 45789, 45970, 63195, 63256])
});

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
  { fetchImpl = fetch, snapshotDate, snapshotConfig, output: requestedOutput, refreshCommand, log = console.log } = {}
) {
  const normalizedProfession = normalizeProfessionName(professionName);
  const omittedSkillIds = SIMULATOR_OMITTED_SKILL_IDS[normalizedProfession] || [];
  // Unsupported profession skills are filtered during generation so an API refresh cannot restore them.
  // The live Thief profession payload alternates between expansion snapshots; explicit seeds prevent data loss.
  const config = {
    ...(snapshotConfig || {}),
    ...(omittedSkillIds.length
      ? {
          excludedIds: [...omittedSkillIds, ...(snapshotConfig?.excludedIds || [])]
        }
      : {}),
    ...(normalizedProfession === 'Thief'
      ? {
          extraSkillIds: [
            ...STABLE_THIEF_ARTIFACT_SKILL_IDS,
            ...(Array.isArray(snapshotConfig?.extraSkillIds) ? snapshotConfig.extraSkillIds : [])
          ]
        }
      : {})
  };
  const id = normalizedProfession.toLowerCase();
  const output = requestedOutput
    ? path.resolve(requestedOutput)
    : path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        `../../js/games/gw2/content/professions/${id}/data/${id}-api-metadata.ts`
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
    refreshCommand,
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
