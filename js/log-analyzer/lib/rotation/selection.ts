export type RotationPlayerSelection<Player> =
  | { readonly status: 'selected'; readonly player: Player }
  | { readonly status: 'no-player' | 'selection-required' | 'player-not-found' };

/** Applies the same evidence tie-break contract to every log source before adapter-specific dispatch. */
export function selectRotationPlayer<Player extends { readonly recordedActionCount: number }>(
  players: readonly Player[],
  explicitMatch?: (player: Player) => boolean
): RotationPlayerSelection<Player> {
  if (!players.length) return { status: 'no-player' };
  if (explicitMatch) {
    const player = players.find(explicitMatch);
    return player ? { status: 'selected', player } : { status: 'player-not-found' };
  }

  if (players.length > 1 && players[0].recordedActionCount === players[1].recordedActionCount) {
    return { status: 'selection-required' };
  }

  return { status: 'selected', player: players[0] };
}
