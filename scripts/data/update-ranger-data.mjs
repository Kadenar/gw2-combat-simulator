import { generateRangerIds } from './generate-ranger-ids.mjs';
import { generateRangerPetData } from './generate-ranger-pet-data.mjs';
import { updateProfessionApiData } from './update-profession-api-data.mjs';

// Refreshes generated identity data without overwriting the hand-authored owner-local mechanics catalogs.
const snapshot = await updateProfessionApiData('Ranger');

await generateRangerIds(snapshot);
await generateRangerPetData(snapshot);
