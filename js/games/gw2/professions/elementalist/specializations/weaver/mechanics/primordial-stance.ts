import { EPSILON } from '#kernel/core/clock.js';
/**
 * Owns Primordial Stance's scheduled pulses against the live Weaver attunement pair.
 * Skill packet templates remain in `skills/slot-skills.ts`.
 */
import { requireEffectFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { replaceSkill, timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
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
      if (at > context.effectiveEnd + EPSILON) tickTimes.add(at);
    }
  }

  primordialStance.start(context, {
    times: [...tickTimes].sort((a, b) => a - b),
    ownerId: context.reservationId,
    captured: { sourceId: skill.id }
  });
}

/** Weaver owns dynamic pulse emission while retaining the skills' patchable effect metadata. */
export const weaverSkillHandlers = Object.freeze({
  'elementalist.primordial-stance': replaceSkill<ElementalistCastContext>({ beforeEffects: schedulePrimordialStance })
});

/** Resolves one Primordial Stance pulse against the attunements live at its timestamp. */
function emitPrimordialStancePulse(
  context: ElementalistSchedulerContext,
  at: number,
  captured: { readonly sourceId: Skill['id'] }
): void {
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  const sourceId = captured.sourceId;
  const attunements = state.secondaryAttunement
    ? [core.primaryAttunement, state.secondaryAttunement]
    : [core.primaryAttunement];
  const strike = requireEffectFromContext(
    context,
    'balance-profile',
    PROFILE.primordialStance,
    'strike',
    'Primordial Stance'
  );
  if (strike)
    emitSkillDamage(context, {
      at,
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
    const effect = requireEffectFromContext(
      context,
      'balance-profile',
      PROFILE.primordialStance,
      'condition',
      attunement
    );
    if (!effect) continue;

    emitSkillCondition(context, {
      at,
      source: 'Primordial Stance',
      sourceId,
      skillName: 'Primordial Stance',
      condition: String(effect.condition),
      stacks: Number(effect.stacks),
      duration: Number(effect.duration)
    });
  }
}

/** The shared sequence owns occurrences; each pulse reads the live attunement pair. */
export const primordialStance = timedEffect({
  id: 'elementalist.primordial-stance',
  effectsAt: emitPrimordialStancePulse
});
