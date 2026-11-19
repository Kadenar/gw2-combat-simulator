import type { DpsReportPlayer } from '#gw2/integrations/logs/dps-report/types.js';
import type { RotationCatalog } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type { RecordedLogAction } from '#gw2/integrations/logs/shared/rotation/normalization.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import { referenceCastTimeMs } from '#gw2/platform/execution/cast-timing.js';

/** A mech animation can shorten replay of its instant player command while preserving the recorded source duration. */
export function applyMechanistAnimations(
  actions: RecordedLogAction[],
  player: DpsReportPlayer,
  catalog: RotationCatalog | null
): RecordedLogAction[] {
  if (!catalog || !player.minions?.length) return actions;

  const cutoffsBySkill = new Map<number, Map<number, number | undefined>>();
  for (const group of player.minions.flatMap((minion) => minion.rotation ?? [])) {
    const skill = catalog.skillsById.get(group.id);

    if (!skill?.independentCast || skill.interruptMode !== 'per-packet') continue;

    const fullDuration = referenceCastTimeMs(skill);
    const cutoffs = cutoffsBySkill.get(group.id) ?? new Map<number, number | undefined>();
    cutoffsBySkill.set(group.id, cutoffs);
    for (const animation of group.skills) {
      // The first animation at this exact start owns the command, even when its channel ran to completion.
      if (cutoffs.has(animation.castTime)) continue;

      const duration = quantizeGw2ActionTimingMs(animation.duration);
      cutoffs.set(animation.castTime, duration > 0 && duration < fullDuration ? duration : undefined);
    }
  }

  return actions.map((action) => {
    const cutoff = action.status === 'instant' ? cutoffsBySkill.get(action.rawSkillId)?.get(action.start) : undefined;
    return cutoff == null ? action : { ...action, replayInterruptMs: cutoff };
  });
}
