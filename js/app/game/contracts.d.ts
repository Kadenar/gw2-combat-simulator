/** Metadata the shared shell can render without loading game-owned code. */
export interface PlayableContentEntry {
  readonly id: string;
  readonly name: string;
  readonly route: string;
  readonly icon?: string;
  readonly themeClass?: string;
  readonly group?: string;
}

/** Minimal lifecycle exposed by one game-owned simulator entry. */
export interface PlayableContentPlugin {
  readonly gameId: string;
  readonly id: string;
  readonly name: string;

  mount(root: Document): Promise<unknown>;
}

/** Coarse game boundary used by the shell before game-specific contracts are loaded. */
export interface GamePlugin {
  readonly id: string;
  readonly name: string;
  readonly content: readonly PlayableContentEntry[];

  loadContent(contentId: string): Promise<PlayableContentPlugin | null>;
}

/** Lazy registry entry that keeps unselected games out of the application bundle. */
export interface GameRegistryEntry {
  readonly id: string;

  load(): Promise<GamePlugin>;
}
