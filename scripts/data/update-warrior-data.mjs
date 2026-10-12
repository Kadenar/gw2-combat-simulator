import { generateWarriorData } from './generate-warrior-data.mjs';
import { publishProfessionData } from './update-profession-api-data.mjs';
import { prepareWarriorApiData } from './update-warrior-api-data.mjs';

// Refreshes the snapshot and derives every Warrior generated artifact from the
// same in-memory data, preventing mismatches between sequential API fetches.
export async function updateWarriorData() {
  await publishProfessionData(() => prepareWarriorApiData(), generateWarriorData);
}

// Refresh only when invoked as a CLI so importing the pipeline never fetches or writes data.
if (import.meta.main) await updateWarriorData();
