import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { updateElementalistApiData } from './update-elementalist-api-data.mjs';
import { parseProfession, updateProfessionApiData } from './update-profession-api-data.mjs';
import { updateRangerData } from './update-ranger-data.mjs';
import { updateWarriorData } from './update-warrior-data.mjs';

// Route professions with dependent generators through their complete refresh; update metadata directly for the rest.
export async function updateProfessionData(args = process.argv.slice(2)) {
  const profession = parseProfession(args);
  const specializedUpdater = {
    Elementalist: updateElementalistApiData,
    Ranger: updateRangerData,
    Warrior: updateWarriorData
  }[profession];

  if (specializedUpdater) {
    await specializedUpdater();
    return;
  }

  await updateProfessionApiData(profession);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) await updateProfessionData();
