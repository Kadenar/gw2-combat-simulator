/** Owns hit history that survives one Mesmer cast and triggers threshold packets across activations. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerState } from '#gw2/platform/engine/types.js';
import type { MesmerAddDamage } from '#gw2/content/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';
import type { MesmerRuntimeState } from '#gw2/content/professions/mesmer/state/types.js';

/** Records actual player hit times and emits each completed tracked-hit group. */
export function scheduleMesmerTrackedHits(
  state: SchedulerState<MesmerRuntimeState>,
  epsilon: number,
  addDamage: MesmerAddDamage,
  skill: MesmerSkill,
  playerHitTimes: readonly number[]
): void {
  if (!skill.trackedHitDamage) return;
  const tracking = skill.trackedHitDamage;
  const duration = Number(tracking.duration || 0);
  let recentHits = [...(professionCoreState(state).trackedSkillHits[skill.id] || [])];
  const required = Math.max(1, Math.trunc(Number(tracking.hitsRequired || 1)));
  for (const currentHitAt of [...playerHitTimes].sort((a, b) => a - b)) {
    const minimum = currentHitAt - duration;
    recentHits = recentHits.filter((hitAt) => hitAt > minimum + epsilon);
    recentHits.push(currentHitAt);
    while (recentHits.length >= required) {
      const triggerHits = recentHits.splice(0, required);
      const triggerAt = triggerHits[triggerHits.length - 1];
      const hasTicks = Array.isArray(tracking.ticks) && tracking.ticks.length > 0;
      addDamage(
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
          blade: skill.blade,
          name: tracking.name,
          skillName: tracking.name,
          parentSkillName: skill.name,
          sourceId: tracking.skillId ?? skill.id,
          skillId: tracking.skillId ?? skill.id
        }
      );
    }
  }

  professionCoreState(state).trackedSkillHits[skill.id] = recentHits;
}
