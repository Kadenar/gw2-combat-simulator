import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerRunResult } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ProfessionContract, Gw2SimulationPlanningState } from '#gw2/platform/simulation/types.js';

/** Projects scheduler-owned state at its planning boundary without borrowing resolver state. */
export function planningState(
  profession: Gw2ProfessionContract,
  config: Gw2Config,
  scheduled: SchedulerRunResult
): Gw2SimulationPlanningState {
  // Planning describes the completed schedule, even when combat ended earlier.
  // Never mix resolver-owned effects at death into this later prediction.
  const endTime = scheduled.state.time;
  const skillName = (id: SkillId): string => profession.catalog?.skillsById?.get(id)?.name || String(id);
  const cooldowns = Object.fromEntries(
    [...scheduled.state.cooldowns].map(([id, readyAt]) => [
      skillName(id),
      {
        readyAt: Math.round(readyAt * 1000),
        remaining: Math.max(0, Math.round((readyAt - endTime) * 1000))
      }
    ])
  );
  const ammo = Object.fromEntries(
    [...scheduled.state.ammo].map(([id, value]) => [skillName(id), structuredClone(value)])
  );
  // Preserve exact skill identities for UI consumers because API variants can share names.
  const ammoBySkillId = Object.fromEntries(
    [...scheduled.state.ammo].map(([id, value]) => [String(id), structuredClone(value)])
  );
  // Profession projections receive only scheduler-owned inputs.
  const projected = profession.projectPlanningState({
    config,
    schedulerContext: scheduled.context,
    schedulerState: scheduled.state
  });
  return {
    atSeconds: endTime,
    cooldowns,
    ammo,
    ammoBySkillId,
    activeWeaponSet: scheduled.state.activeWeaponSet,
    // Projection lets a profession hide resolver-only bookkeeping.
    profession: structuredClone(projected ?? flattenProfessionState(scheduled.state.profession))
  };
}
