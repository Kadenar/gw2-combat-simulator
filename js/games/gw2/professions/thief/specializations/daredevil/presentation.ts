import { thiefStealPaletteGroups, thiefUiState } from '#gw2/professions/thief/core/presentation.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import type { ThiefUiContext } from '#gw2/professions/thief/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  SkillDamagePreviewContext,
  SkillDamageProbeSetup
} from '#gw2/platform/profession-presentation/skill-damage.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

/** Show dodge damage bonuses only while their projected post-dodge windows are active. */
function daredevilStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const state = thiefUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  for (const [id, label, expiresAt] of [
    ['daredevil-bounding-dodger', 'Bounding Dodger', state.boundingDamageUntil],
    ['daredevil-lotus-training', 'Lotus Training', state.lotusConditionDamageUntil]
  ] as const) {
    const remaining = (expiresAt || 0) - at;
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
  /** Palm Strike is armed by a connecting Fist Flurry; that prerequisite damage is excluded by activation ownership. */
  skillDamageProbe(_context: SkillDamagePreviewContext, skill: Skill): SkillDamageProbeSetup | null {
    return skill.id === ID.PALM_STRIKE
      ? {
          setup: [
            { type: 'cast', skillId: ID.FIST_FLURRY, offTarget: false },
            { type: 'wait', durationMs: 1 }
          ]
        }
      : null;
  },
  rotationStateSnapshot: daredevilStateSnapshot,
  paletteGroups: () => thiefStealPaletteGroups()
});
