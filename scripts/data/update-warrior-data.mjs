import { generateWarriorData } from './generate-warrior-data.mjs';
import { updateWarriorApiData } from './update-warrior-api-data.mjs';

// Refreshes the snapshot and derives every Warrior generated artifact from the
// same in-memory data, preventing mismatches between sequential API fetches.
export async function updateWarriorData() {
  const snapshot = await updateWarriorApiData();

  await generateWarriorData(snapshot);
}

// Refresh only when invoked as a CLI so importing the pipeline never fetches or writes data.
if (import.meta.main) await updateWarriorData();
