import { EPSILON } from '#kernel/core/clock.js';
import { balanceProfileValueFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerCastContext } from '#gw2/professions/mesmer/types.js';

/** Arms Mimic on completion and consumes it on the next eligible completed utility skill. */
export function completeMimicCast(context: MesmerCastContext, skill: MesmerSkill): void {
  if (context.action.cancelled) return;

  const at = context.fullEnd;
  const core = professionCoreState(context.state);
  if (skill.id === ID.MIMIC) {
    core.mimicUntil = at + balanceProfileValueFromContext(context, PROFILE.mimic, 'durationMultiplier', 10);
    return;
  }

  if (
    skill.type !== 'Utility' ||
    skill.flipParentId ||
    core.mimicUntil <= 0 ||
    core.mimicUntil < context.start - EPSILON
  ) {
    return;
  }

  // Mimic resets the independent cast lockout as well as the visible cooldown.
  const ammo = context.state.ammo.get(skill.id);
  if (ammo) ammo.lockoutReadyAt = 0;
  context.state.cooldowns.delete(skill.id);
  core.mimicUntil = 0;
  mesmerRuntimeFor(context).addEvent({
    type: 'proc',
    at,
    source: 'Mimic',
    sourceId: ID.MIMIC,
    skillId: ID.MIMIC,
    skillName: 'Mimic',
    name: 'Mimic',
    targetSkillId: skill.id,
    targetSkillName: skill.name,
    reduction: context.rechargeDuration
  });
}
