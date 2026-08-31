/** Materializes shared legend-invocation profiles for Core and elite trait callers. */
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import type { BalanceProfile, Skill, SkillEffect, SkillId } from '#gw2/platform/engine/types.js';
import type { RevenantSchedulerContext } from '#gw2/content/professions/revenant/types.js';

/** Emits a declarative proc skill while preserving the triggering trait as its source. */
export function emitLegendInvocationSkill(
  context: RevenantSchedulerContext,
  skillId: SkillId,
  at: number,
  sourceId: SkillId
): void {
  const skill = context.catalog.skillsById.get(skillId);
  if (!skill) return;
  const activationId = context.createActivationId('legend-invocation');
  for (const effect of skill.effects || []) {
    const applications = materializeSkillEffectApplications({
      skill,
      effect,
      start: at,
      fullEnd: at,
      baseEvent: {
        activationId,
        source: 'revenant',
        sourceId,
        actorType: effect.actorType || 'player',
        skillId: skill.id,
        skillName: skill.name
      },
      skillWeaponFallback: 'Unequipped',
      ...(effect.type === 'boon'
        ? {
            statusDuration: gw2SchedulerBoonDuration(
              context,
              skill,
              String(effect.boon || effect.kind || ''),
              Number(effect.duration || 0)
            )
          }
        : {})
    });
    for (const application of applications) {
      context.emit(application.event);
    }
  }
}

/** Emits an authorable non-skill invocation profile with its trait as source. */
export function emitLegendInvocationProfile(
  context: RevenantSchedulerContext,
  profileId: SkillId,
  at: number,
  sourceId: SkillId,
  effectPredicate: (effect: SkillEffect) => boolean = () => true
): void {
  const profile = context.catalog.balanceProfilesById.get(profileId);
  if (!profile) return;
  const activationId = context.createActivationId('legend-invocation');
  const materializerProfile = profile as BalanceProfile & Skill;
  for (const effect of profile.effects || []) {
    if (!effectPredicate(effect)) continue;
    const applications = materializeSkillEffectApplications({
      skill: materializerProfile,
      effect,
      start: at,
      fullEnd: at,
      baseEvent: {
        activationId,
        source: 'revenant',
        sourceId,
        actorType: effect.actorType || 'player',
        skillId: profile.id,
        skillName: profile.name
      },
      skillWeaponFallback: 'Unequipped',
      ...(effect.type === 'boon'
        ? {
            statusDuration: gw2SchedulerBoonDuration(
              context,
              materializerProfile,
              String(effect.boon || effect.kind || ''),
              Number(effect.duration || 0)
            )
          }
        : {})
    });
    for (const application of applications) {
      context.emit(application.event);
    }
  }
}
