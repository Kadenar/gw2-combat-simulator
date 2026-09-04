import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateWarriorData } from './generate-warrior-data.mjs';
import { updateWarriorApiData } from './update-warrior-api-data.mjs';

// Refreshes the snapshot and derives every Warrior generated artifact from the
// same in-memory data, preventing mismatches between sequential API fetches.
export async function updateWarriorData() {
  const snapshot = await updateWarriorApiData();

  await generateWarriorData(snapshot);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) await updateWarriorData();
