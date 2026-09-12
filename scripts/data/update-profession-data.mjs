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

// Refresh only when invoked as a CLI so importing the pipeline never fetches or writes data.
if (import.meta.main) await updateProfessionData();
