import { THIEF_STOLEN_SKILL_IDS } from '#gw2/content/professions/thief/core/mechanics/steal.js';
import { thiefStealPaletteGroups, thiefUiState } from '#gw2/content/professions/thief/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/engine/types.js';
import type { ThiefUiContext } from '#gw2/content/professions/thief/types.js';

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
  paletteGroups: () => thiefStealPaletteGroups(),
  skillBarGroups: () => [
    {
      id: 'thief-stolen-skills',
      label: 'Stolen Skills',
      skillIds: [...THIEF_STOLEN_SKILL_IDS],
      color: '#9a535c'
    }
  ]
});
