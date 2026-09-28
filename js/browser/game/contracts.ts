/** Stable address used by the shell, workers, and game registry. */
export interface GameContentAddress {
  readonly gameId: string;
  readonly contentId: string;
}

/** Declares content identity so the shell can check membership before loading it. */
export interface PlayableContentEntry {
  readonly id: string;
}

/** Minimal lifecycle exposed by one game-owned simulator entry. */
export interface PlayableContentPlugin {
  readonly gameId: string;
  readonly id: string;

  mount(root: Document): Promise<unknown>;
}

/** Coarse game boundary used by the shell before game-specific contracts are loaded. */
export interface GamePlugin {
  readonly id: string;
  readonly content: readonly PlayableContentEntry[];

  loadContent(contentId: string): Promise<PlayableContentPlugin | null>;
}

/** Lazy registry entry that keeps unselected games out of the application bundle. */
export interface GameRegistryEntry {
  readonly id: string;

  load(): Promise<GamePlugin>;
}
