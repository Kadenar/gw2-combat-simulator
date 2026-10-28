import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep, revenantUpkeepOwner } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { embracePulse } from '#gw2/professions/revenant/core/skills/legends/demon.js';
import { hammerPulse } from '#gw2/professions/revenant/core/skills/legends/dwarf.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const REVENANT_UPKEEP_PULSE = 'revenant.upkeep-pulse';

interface UpkeepPulse {
  readonly skillId: SkillId;
  readonly startsAt: number;
}

/** Start recurring damage only for pulse-producing skills after their upkeep activation commits. */
export function scheduleRevenantUpkeepPulses(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  // Core owns its packet cadence. The next whole second follows the exact canonical activation instant.
  const first =
    skill.id === ID.EMBRACE_THE_DARKNESS
      ? Math.floor(canonicalTime(runtime.time)) + 1
      : skill.id === ID.VENGEFUL_HAMMERS
        ? runtime.time + Math.max(0, skill.pulseInterval ?? 1)
        : null;

  if (first != null)
    runtime.schedule(
      REVENANT_UPKEEP_PULSE,
      canonicalTime(first),
      { skillId: skill.id, startsAt: runtime.time } satisfies UpkeepPulse,
      revenantUpkeepOwner(skill.id, runtime.time)
    );
}

/** One pulse per activation; only the owning activation schedules its successor. */
export function revenantUpkeepPulse(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as UpkeepPulse;
  const active = activeRevenantUpkeep(runtime, skillId, startsAt);
  const skill = runtime.helpers.skillsById.get(skillId);

  if (!active || !skill) return;

  if (skill.id === ID.EMBRACE_THE_DARKNESS) {
    embracePulse(runtime, skill, runtime.time, active.empoweredNextPulse);
    active.empoweredNextPulse = false;
  } else if (skill.id === ID.VENGEFUL_HAMMERS) hammerPulse(runtime, skill, runtime.time);
  else return;

  runtime.schedule(
    REVENANT_UPKEEP_PULSE,
    canonicalTime(runtime.time + Math.max(0, skill.pulseInterval ?? 1)),
    data,
    revenantUpkeepOwner(skillId, startsAt)
  );
}
