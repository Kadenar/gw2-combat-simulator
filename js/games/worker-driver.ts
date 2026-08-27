import type { GameContentAddress } from '../app/shell/types.js';

/** Routes worker-only imports without pulling browser plug-ins and their worker constructors into worker bundles. */
export async function loadGameWorkerDriver({ gameId, contentId }: GameContentAddress): Promise<unknown | null> {
  if (gameId !== 'gw2') return null;

  const { loadGw2WorkerDriver } = await import('./gw2/worker-driver.js');
  return loadGw2WorkerDriver(contentId);
}
