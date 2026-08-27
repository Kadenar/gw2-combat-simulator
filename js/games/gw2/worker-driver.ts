import { loadProfessionAppAdapter } from './app/profession/registry.js';

/** Resolves a GW2 profession adapter for simulation workers without loading the browser application. */
export function loadGw2WorkerDriver(contentId: string): ReturnType<typeof loadProfessionAppAdapter> {
  return loadProfessionAppAdapter(contentId);
}
