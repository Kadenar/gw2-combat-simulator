import { generateRangerIds } from './generate-ranger-ids.mjs';
import { generateRangerPetData } from './generate-ranger-pet-data.mjs';
import { updateProfessionApiData } from './update-profession-api-data.mjs';

// Refreshes generated identity data without overwriting the hand-authored owner-local mechanics catalogs.
export async function updateRangerData() {
  const snapshot = await updateProfessionApiData('Ranger');

  await generateRangerIds(snapshot);
  await generateRangerPetData(snapshot);
}

// Refresh only when invoked as a CLI so importing the pipeline never fetches or writes data.
if (import.meta.main) await updateRangerData();
