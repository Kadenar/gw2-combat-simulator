import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Arms Mimic on completion and consumes it on the next eligible completed utility skill. */
export function completeMimicCast(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  if (cast.cancelled) return;

  const at = canonicalTime(context.time);
  const core = professionCoreState(context);
  if (
    skill.id === ID.MIMIC ||
    skill.type !== 'Utility' ||
    skill.flipParentId ||
    core.mimicUntil <= 0 ||
    core.mimicUntil < cast.start
  ) {
    return;
  }

  // Mimic resets the independent cast lockout as well as the visible cooldown.
  const ammo = context.ammo.get(skill.id);
  if (ammo) {
    ammo.lockoutReadyAt = 0;
    delete ammo.lockoutProgress;
  }

  context.cooldownController.clear(skill.id);
  core.mimicUntil = 0;
  mesmerMechanicsFor(context).addEvent({
    type: 'proc',
    at,
    source: 'Mimic',
    sourceId: ID.MIMIC,
    skillId: ID.MIMIC,
    skillName: 'Mimic',
    name: 'Mimic'
  });
}

/** Mimic owns arming; the shared observer only consumes later eligible utilities. */
export function armMimic(context: MesmerRuntime): void {
  const profile = requireBalanceProfileFromContext(context, PROFILE.mimic);
  professionCoreState(context).mimicUntil = canonicalTime(
    context.time + balanceProfileNumber(profile, 'durationMultiplier')
  );
}
