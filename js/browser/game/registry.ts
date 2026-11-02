import type { GamePlugin, GameRegistryEntry, PlayableContentPlugin } from '#browser/game/contracts.js';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertId(value: string, label: string): void {
  if (!ID_PATTERN.test(value)) throw new TypeError(`${label} must be a lowercase kebab-case identifier.`);
}

/** Validates declared game and content IDs and rejects ambiguous duplicates before loading content. */
function validateGamePlugin(game: GamePlugin): void {
  assertId(game.id, 'GamePlugin.id');
  const ids = new Set<string>();
  for (const [index, entry] of game.content.entries()) {
    assertId(entry.id, `GamePlugin.content[${index}].id`);

    if (ids.has(entry.id)) throw new TypeError(`GamePlugin.content contains duplicate ID "${entry.id}".`);

    ids.add(entry.id);
  }
}

/** Creates an immutable lazy registry after validating IDs and uniqueness. */
export function defineGameRegistry(entries: readonly GameRegistryEntry[]): readonly GameRegistryEntry[] {
  const ids = new Set<string>();
  return Object.freeze(
    entries.map((entry, index) => {
      assertId(entry.id, `Game registry entry ${index}.id`);

      if (ids.has(entry.id)) throw new TypeError(`Game registry contains duplicate ID "${entry.id}".`);

      ids.add(entry.id);
      return Object.freeze({ id: entry.id, load: entry.load });
    })
  );
}

export const gameRegistry = defineGameRegistry([
  {
    id: 'gw2',
    load: async () => {
      const module = await import('#gw2/plugin.js');
      return module.gw2Plugin;
    }
  }
]);

/** Lazily resolves and validates a game, returning null for an unknown ID. */
async function loadGame(
  gameId: string,
  registry: readonly GameRegistryEntry[] = gameRegistry
): Promise<GamePlugin | null> {
  const entry = registry.find(({ id }) => id === gameId);

  if (!entry) return null;

  const game = await entry.load();
  validateGamePlugin(game);

  if (game.id !== gameId) throw new TypeError(`Game loader "${gameId}" returned plug-in "${game.id}".`);

  return game;
}

/** Resolves one declared content plug-in without exposing game-specific types to the shell. */
export async function loadGameContent(
  gameId: string,
  contentId: string,
  registry: readonly GameRegistryEntry[] = gameRegistry
): Promise<PlayableContentPlugin | null> {
  const game = await loadGame(gameId, registry);

  if (!game || !game.content.some(({ id }) => id === contentId)) return null;

  const content = await game.loadContent(contentId);

  if (!content) throw new TypeError(`Game "${gameId}" did not load its declared content "${contentId}".`);

  if (content.gameId !== gameId || content.id !== contentId) {
    throw new TypeError(`Content loader "${gameId}/${contentId}" returned a mismatched plug-in.`);
  }

  return content;
}
