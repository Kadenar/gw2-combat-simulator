import { loadProfession } from '#gw2/profession-registry.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';

// A worker's active preview is fixed at module load; reuse its composed engine across edits and warmup jobs.
const drivers = new Map<string, Gw2ProfessionSource>();

/** Loads the engine and active preview for every simulation endpoint without importing browser adapters. */
export async function loadGw2WorkerDriver(contentId: string): Promise<Gw2ProfessionSource | null> {
  const profession = await loadProfession(contentId);
  if (!profession) return null;
  let driver = drivers.get(contentId);
  if (!driver) {
    driver = withActivePatchPreview(profession);
    drivers.set(contentId, driver);
  }

  return driver;
}
