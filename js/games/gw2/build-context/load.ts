import { professionRegistry } from '#gw2/profession-registry.js';
import type { BuildContextModule } from '#gw2/build-context/types.js';

const modules = new Map<string, Promise<BuildContextModule>>();

/** Cache module binding, never candidate calculations; failed imports remain retryable. */
export function loadBuildContext(professionId: string): Promise<BuildContextModule | null> {
  const entry = professionRegistry.find(({ id }) => id === professionId);
  if (!entry) return Promise.resolve(null);
  let pending = modules.get(professionId);
  if (!pending) {
    pending = entry.loadBuildContext().catch((error: unknown) => {
      modules.delete(professionId);
      throw error;
    });
    modules.set(professionId, pending);
  }

  return pending;
}
