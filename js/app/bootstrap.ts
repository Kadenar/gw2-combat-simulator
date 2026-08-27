import { gameRegistry, loadGameContent } from './game/registry.js';
import type { GameRegistryEntry } from './game/contracts.js';

/** Resolves page identity through the game seam, with legacy GW2 profession markup as a compatibility fallback. */
export async function bootstrapGameApp(
  root: Document = document,
  registry: readonly GameRegistryEntry[] = gameRegistry
): Promise<unknown> {
  const gameId = root.body.dataset.game || 'gw2';
  const contentId = root.body.dataset.content || root.body.dataset.profession;
  if (!contentId) throw new Error('Simulator page is missing data-content or data-profession.');

  const content = await loadGameContent(gameId, contentId, registry);
  if (!content) throw new Error(`No playable content is registered for "${gameId}/${contentId}".`);
  return content.mount(root);
}

export { bootstrapGameApp as bootstrapProfessionApp };
