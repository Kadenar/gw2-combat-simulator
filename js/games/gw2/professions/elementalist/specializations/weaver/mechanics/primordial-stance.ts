/**
 * Owns Primordial Stance's scheduled pulses against the live Weaver attunement pair.
 * Skill packet templates remain in `skills/slot-skills.ts`.
 */
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import type { ScheduledTask, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';

/** Reads canonical condition timing without emitting packets that the live-attunement tasks replace. */
function schedulePrimordialStance(context: ElementalistCastContext, skill: Skill): void {
  const tickTimes = new Set<number>();
  for (const effect of skill.effects || []) {
    if (effect.type !== 'condition') continue;
    const timing = context.schedulerPolicy.effectTiming?.(context, skill, effect) ?? effect;
    const applications = materializeSkillEffectApplications({
      skill,
      effect: timing,
      start: context.start,
      fullEnd: context.fullEnd,
      baseEvent: { source: 'elementalist', sourceId: skill.id, actorType: 'player' }
    });
    for (const { at } of applications) {
      // Preserve the activation-time exclusion and coalesce coincident condition applications.
      if (at > context.effectiveEnd + context.epsilon) tickTimes.add(at);
    }
  }

  for (const at of tickTimes) {
    context.tasks.schedule({
      type: 'elementalist.primordial-stance',
      at,
      ownerId: context.reservationId,
      payload: { sourceId: skill.id }
    });
  }
}

/** Weaver owns dynamic pulse emission while retaining the skills' patchable effect metadata. */
export const weaverSkillHandlers = Object.freeze({
  'elementalist.primordial-stance': replaceSkill<ElementalistCastContext>({ beforeEffects: schedulePrimordialStance })
});

/** Resolves one Primordial Stance pulse against the attunements live at its timestamp. */
export function handlePrimordialStanceTick(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<SchedulerRecord>
): void {
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  const sourceId = (task.payload?.sourceId || 'primordial-stance') as Skill['id'];
  const attunements = state.secondaryAttunement
    ? [core.primaryAttunement, state.secondaryAttunement]
    : [core.primaryAttunement];
  const strike = balanceProfileEffectFromContext(context, PROFILE.primordialStance, 'strike');
  if (strike)
    emitSkillDamage(context, {
      at: task.at,
      source: 'elementalist',
      sourceId,
      actorType: 'player',
      skillName: 'Primordial Stance',
      skillId: sourceId,
      coefficient: Number(strike.coefficient),
      skillWeapon: 'Unequipped',
      damageKind: 'field-tick'
    });
  for (const attunement of attunements) {
    const effect = balanceProfileEffectFromContext(context, PROFILE.primordialStance, 'condition', 0, attunement);
    if (!effect) continue;
    emitSkillCondition(context, {
      at: task.at,
      source: 'Primordial Stance',
      sourceId,
      actorType: 'player',
      skillName: 'Primordial Stance',
      condition: String(effect.condition),
      stacks: Number(effect.stacks),
      duration: Number(effect.duration)
    });
  }
}
