import { generateRangerIds } from './generate-ranger-ids.mjs';
import { generateRangerPetData } from './generate-ranger-pet-data.mjs';
import { generateRangerSkillMechanics } from './generate-ranger-skill-mechanics.mjs';
import { updateProfessionApiData } from './update-profession-api-data.mjs';

// Refreshes the snapshot once and supplies that exact data to each Ranger
// generator so TypeScript compilation is not required midway through refresh.
const snapshot = await updateProfessionApiData('Ranger');

await generateRangerIds(snapshot);
await generateRangerPetData(snapshot);
await generateRangerSkillMechanics(snapshot);
