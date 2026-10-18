import { getProfessionEntry } from '#gw2/profession-registry.js';

/** Test setup uses the same lazy adapter loader as the application registry. */
export async function loadProfessionAppAdapter(professionId) {
  const entry = getProfessionEntry(professionId);
  return entry ? entry.loadAppAdapter() : null;
}
