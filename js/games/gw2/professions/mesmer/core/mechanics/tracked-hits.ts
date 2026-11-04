/** Owns hit history that survives one Mesmer cast and triggers threshold packets across activations. */
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { buildMesmerStrikes } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Records one accepted player hit, retaining cross-cast progress until it expires or completes a group. */
export function recordMesmerTrackedHit(state: MesmerRuntime, skill: MesmerSkill, currentHitAt: number): void {
  if (!skill.trackedHitDamage) return;

  const tracking = skill.trackedHitDamage;
  const duration = tracking.duration || 0;
  // A prior hit expires at its exact age limit; retain its final live microsecond.
  const recentHits = (professionCoreState(state.profession).trackedSkillHits[skill.id] || []).filter(
    (hitAt) => canonicalTime(hitAt + duration) > canonicalTime(currentHitAt)
  );
  const required = Math.max(1, Math.trunc(tracking.hitsRequired || 1));
  recentHits.push(currentHitAt);

  // This sole ledger writer leaves progress below the run's selected threshold; one hit can complete only one group.
  if (recentHits.length >= required) {
    recentHits.length = 0;
    const hasTicks = Array.isArray(tracking.ticks) && tracking.ticks.length > 0;
    buildMesmerStrikes(
      state,
      skill,
      currentHitAt,
      {
        ...tracking,
        ...(hasTicks
          ? {
              coefficient: undefined,
              hits: undefined,
              timingAnchor: 'castStart' as const,
              timingScale: 'fixed' as const
            }
          : {})
      },
      {
        metadata: { blade: Boolean(skill.blade) },
        name: tracking.name,
        skillName: tracking.name,
        parentSkillName: skill.name,
        sourceId: tracking.skillId ?? skill.id,
        skillId: tracking.skillId ?? skill.id
      }
    ).forEach((packet) => {
      state.effects.emit({
        kind: 'packet',
        event: packet,
        priority: Number(packet.priority ?? 0)
      });
    });
  }

  professionCoreState(state.profession).trackedSkillHits[skill.id] = recentHits;
}
