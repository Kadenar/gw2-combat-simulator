import type { GamePlugin, GameRegistryEntry, PlayableContentEntry, PlayableContentPlugin } from './contracts.js';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} must be an object.`);
}

function assertId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a lowercase kebab-case identifier.`);
  }
}

function assertText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} must be a non-empty string.`);
}

/** Validates shell-visible content metadata and rejects ambiguous duplicate IDs. */
function validateContentEntries(value: unknown): asserts value is readonly PlayableContentEntry[] {
  if (!Array.isArray(value)) throw new TypeError('GamePlugin.content must be an array.');

  const ids = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const label = `GamePlugin.content[${index}]`;
    assertRecord(entry, label);
    assertId(entry.id, `${label}.id`);
    assertText(entry.name, `${label}.name`);
    assertText(entry.route, `${label}.route`);
    for (const key of ['icon', 'themeClass', 'group'] as const) {
      if (entry[key] !== undefined) assertText(entry[key], `${label}.${key}`);
    }

    if (ids.has(entry.id)) throw new TypeError(`GamePlugin.content contains duplicate ID "${entry.id}".`);
    ids.add(entry.id);
  }
}

/** Checks the coarse game contract at its lazy-loading boundary. */
export function validateGamePlugin(value: unknown): asserts value is GamePlugin {
  assertRecord(value, 'GamePlugin');
  assertId(value.id, 'GamePlugin.id');
  assertText(value.name, 'GamePlugin.name');
  validateContentEntries(value.content);
  if (typeof value.loadContent !== 'function') throw new TypeError('GamePlugin.loadContent must be a function.');
}

/** Creates an immutable lazy registry after validating IDs, loaders, and uniqueness. */
export function defineGameRegistry(entries: readonly GameRegistryEntry[]): readonly GameRegistryEntry[] {
  if (!Array.isArray(entries)) throw new TypeError('Game registry must be an array.');

  const ids = new Set<string>();
  return Object.freeze(
    entries.map((value, index) => {
      assertRecord(value, `Game registry entry ${index}`);
      const entry = value as unknown as GameRegistryEntry;
      assertId(entry.id, `Game registry entry ${index}.id`);
      if (typeof entry.load !== 'function') throw new TypeError(`Game registry entry "${entry.id}" needs a loader.`);
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
      const module = await import('../../games/gw2/plugin.js');
      return module.gw2Plugin;
    }
  }
]);

/** Lazily resolves and validates a game, returning null for an unknown ID. */
export async function loadGame(
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
  assertRecord(content, 'PlayableContentPlugin');
  if (content.gameId !== gameId || content.id !== contentId) {
    throw new TypeError(`Content loader "${gameId}/${contentId}" returned a mismatched plug-in.`);
  }

  assertText(content.name, 'PlayableContentPlugin.name');
  if (typeof content.mount !== 'function') throw new TypeError('PlayableContentPlugin.mount must be a function.');
  return content as unknown as PlayableContentPlugin;
}
