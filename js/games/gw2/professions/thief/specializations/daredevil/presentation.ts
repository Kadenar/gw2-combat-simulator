import { planningBuffAt } from '#gw2/platform/results/query.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import { thiefStealPaletteGroups } from '#gw2/professions/thief/core/presentation.js';
import type { ThiefUiContext } from '#gw2/professions/thief/types.js';

/** Show dodge damage bonuses only while their projected post-dodge windows are active. */
function daredevilStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const items: RotationStateSnapshotItem[] = [];
  for (const [id, label, kind] of [
    ['daredevil-bounding-dodger', 'Bounding Dodger', 'bounding-dodger'],
    ['daredevil-lotus-training', 'Lotus Training', 'lotus-training']
  ] as const) {
    const remaining = planningBuffAt(context.planningState, kind)?.remaining ?? 0;
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
