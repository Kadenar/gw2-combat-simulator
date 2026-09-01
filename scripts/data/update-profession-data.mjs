import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseProfession, updateProfessionApiData } from './update-profession-api-data.mjs';

// Route professions with dependent generators through their complete refresh; update metadata directly for the rest.
export async function updateProfessionData(args = process.argv.slice(2)) {
  const profession = parseProfession(args);
  const specializedUpdater = {
    Elementalist: './update-elementalist-api-data.mjs',
    Ranger: './update-ranger-data.mjs',
    Warrior: './update-warrior-data.mjs'
  }[profession];

  if (specializedUpdater) {
    await import(specializedUpdater);
    return;
  }

  await updateProfessionApiData(profession);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) await updateProfessionData();
