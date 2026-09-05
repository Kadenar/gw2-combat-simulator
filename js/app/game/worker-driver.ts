import type { GameContentAddress } from '#app/shell/types.js';

/** Routes game worker imports separately from browser plug-ins so worker bundles exclude worker constructors. */
export async function loadGameWorkerDriver({ gameId, contentId }: GameContentAddress): Promise<unknown | null> {
  if (gameId !== 'gw2') return null;

  const { loadGw2WorkerDriver } = await import('#gw2/worker-driver.js');
  return loadGw2WorkerDriver(contentId);
}
