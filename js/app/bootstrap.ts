import { gameRegistry, loadGameContent } from '#app/game/registry.js';
import type { GameRegistryEntry } from '#app/game/contracts.js';

/** Requires explicit game and content IDs so page identity never depends on profession-specific markup. */
export async function bootstrapGameApp(
  root: Document = document,
  registry: readonly GameRegistryEntry[] = gameRegistry
): Promise<unknown> {
  const gameId = root.body.dataset.game;
  const contentId = root.body.dataset.content;
  if (!gameId || !contentId) throw new Error('Simulator page requires data-game and data-content.');

  const content = await loadGameContent(gameId, contentId, registry);
  if (!content) throw new Error(`No playable content is registered for "${gameId}/${contentId}".`);
  return content.mount(root);
}
