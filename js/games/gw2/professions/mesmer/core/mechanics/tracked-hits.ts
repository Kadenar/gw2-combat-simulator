import { buildMesmerStrikes, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
/** Owns hit history that survives one Mesmer cast and triggers threshold packets across activations. */
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Records actual player hit times and emits each completed tracked-hit group. */
export function scheduleMesmerTrackedHits(
  state: MesmerRuntime,
  skill: MesmerSkill,
  playerHitTimes: readonly number[]
): void {
  if (!skill.trackedHitDamage) return;
  const tracking = skill.trackedHitDamage;
  const duration = tracking.duration || 0;
  let recentHits = [...(professionCoreState(state).trackedSkillHits[skill.id] || [])];
  const required = Math.max(1, Math.trunc(tracking.hitsRequired || 1));
  for (const currentHitAt of [...playerHitTimes].sort((a, b) => a - b)) {
    // A prior hit expires at its exact age limit; retain its final live microsecond.
    recentHits = recentHits.filter((hitAt) => canonicalTime(hitAt + duration) > canonicalTime(currentHitAt));
    recentHits.push(currentHitAt);
    while (recentHits.length >= required) {
      const triggerHits = recentHits.splice(0, required);
      const triggerAt = triggerHits[triggerHits.length - 1];
      const hasTicks = Array.isArray(tracking.ticks) && tracking.ticks.length > 0;
      buildMesmerStrikes(
        state,
        skill,
        triggerAt,
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
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });
    }
  }

  professionCoreState(state).trackedSkillHits[skill.id] = recentHits;
}
