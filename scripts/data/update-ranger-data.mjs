import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateRangerIds } from './generate-ranger-ids.mjs';
import { generateRangerPetData } from './generate-ranger-pet-data.mjs';
import { updateProfessionApiData } from './update-profession-api-data.mjs';

// Refreshes generated identity data without overwriting the hand-authored owner-local mechanics catalogs.
export async function updateRangerData() {
  const snapshot = await updateProfessionApiData('Ranger');

  await generateRangerIds(snapshot);
  await generateRangerPetData(snapshot);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) await updateRangerData();
