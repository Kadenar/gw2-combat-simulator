import { generateRangerIds } from './generate-ranger-ids.mjs';
import { fetchRangerPetMetadata, fetchRangerPetSkills, generateRangerPetData } from './generate-ranger-pet-data.mjs';
import { fetchGw2Api, fetchManyGw2 } from './lib/gw2-profession-snapshot.mjs';
import { prepareProfessionApiData, publishProfessionData } from './update-profession-api-data.mjs';

/** Derive the Ranger ID map and pet data from one profession snapshot and one shared pet snapshot. */
async function generateRangerData(snapshot) {
  // Keep land-capable pets only; White Moa remains excluded with its unsupported Icy Screech.
  const petIds = await fetchGw2Api('/pets');
  const pets = (await fetchManyGw2('pets', petIds, { preserveIdOrder: true })).filter(
    (pet) => ![14, 21, 40, 41, 42, 43].includes(pet.id)
  );
  // Both stages depend only on the shared pet list, so fetch them concurrently.
  const [skills, wikiMetadata] = await Promise.all([fetchRangerPetSkills(pets), fetchRangerPetMetadata(pets)]);
  const identities = await generateRangerIds(snapshot, skills);
  const petData = await generateRangerPetData({ pets, skills, keyById: identities.keyById, wikiMetadata });

  return { files: [...identities.files, ...petData.files] };
}

// Refreshes generated identity data without overwriting the hand-authored owner-local mechanics catalogs.
export async function updateRangerData() {
  await publishProfessionData(() => prepareProfessionApiData('Ranger'), generateRangerData);
}

// Refresh only when invoked as a CLI so importing the pipeline never fetches or writes data.
if (import.meta.main) await updateRangerData();
