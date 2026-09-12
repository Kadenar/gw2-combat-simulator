import { thiefStealPaletteGroups, thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/engine/profession/types.js';
import type { ThiefUiContext } from '#gw2/professions/thief/types.js';

/** Show dodge damage bonuses only while their projected post-dodge windows are active. */
function daredevilStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const state = thiefUiState(context);
  const at = Math.max(0, Number(context.atSeconds || 0));
  const items: RotationStateSnapshotItem[] = [];
  for (const [id, label, expiresAt] of [
    ['daredevil-bounding-dodger', 'Bounding Dodger', state.boundingDamageUntil],
    ['daredevil-lotus-training', 'Lotus Training', state.lotusConditionDamageUntil]
  ] as const) {
    const remaining = Number(expiresAt || 0) - at;
    if (remaining > 0) {
      items.push({
        id,
        label,
        value: `${remaining.toFixed(1)}s`,
        title: `Time remaining in the ${label} damage bonus`
      });
    }
  }

  return items;
}

// Daredevil owns its profession palette contribution while reusing the base Thief steal and stolen-skill pool.
export const daredevilUi = Object.freeze({
  rotationStateSnapshot: daredevilStateSnapshot,
  paletteGroups: () => thiefStealPaletteGroups()
});
