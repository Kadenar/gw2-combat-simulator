import { generateWarriorData } from './generate-warrior-data.mjs';
import { updateWarriorApiData } from './update-warrior-api-data.mjs';

// Refreshes the snapshot and derives every Warrior generated artifact from the
// same in-memory data, preventing mismatches between sequential API fetches.
const snapshot = await updateWarriorApiData();

await generateWarriorData(snapshot);
