import { thiefStealPaletteGroups, thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/engine/profession/types.js';
import type { ThiefUiContext } from '#gw2/professions/thief/types.js';

/** Shows the Bounding Dodger damage bonus only during its post-dodge window. */
function daredevilStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const remaining =
    Number(thiefUiState(context).boundingDamageUntil || 0) - Math.max(0, Number(context.atSeconds || 0));
  return remaining > 0
    ? [
        {
          id: 'daredevil-bounding-dodger',
          label: 'Bounding Dodger',
          value: `${remaining.toFixed(1)}s`,
          title: 'Time remaining in the Bounding Dodger damage bonus'
        }
      ]
    : [];
}

// Daredevil owns its profession palette contribution while reusing the base Thief steal and stolen-skill pool.
export const daredevilUi = Object.freeze({
  rotationStateSnapshot: daredevilStateSnapshot,
  paletteGroups: () => thiefStealPaletteGroups()
});
