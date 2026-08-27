import { materializeSkillEffectApplications } from '../../../platform/engine/effects/materializer.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '../../../platform/gw2/scheduler/policy.js';
/**
 * Trait effects triggered by invoking a legend.
 *
 * Materializes Spirit Boon, Song of the Mists, Invoking Torment, Diabolic
 * Inferno for Core legends at legend-swap completion. Elite legends add their
 * own invocation behavior through specialization-local observers.
 */
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from './skills.js';
import type { BalanceProfile, Skill, SkillEffect, SkillId } from '../../../platform/engine/types.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '../types.js';

const CORE_LEGENDS = new Set<string>([LEGEND.ASSASSIN, LEGEND.DEMON, LEGEND.DWARF, LEGEND.CENTAUR]);

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

function emitSpiritBoon(context: RevenantCastContext, _swapSkill: RevenantSkill, legendId: string, at: number): void {
  emitLegendInvocationProfile(
    context,
    REVENANT_CORE_BALANCE_PROFILE_IDS.spiritBoon,
    at,
    TRAIT.SPIRIT_BOON,
    (effect) => effect.metadata?.legendId === legendId
  );
}

function emitSongOfTheMists(
  context: RevenantCastContext,
  _swapSkill: RevenantSkill,
  legendId: string,
  at: number
): void {
  emitLegendInvocationProfile(
    context,
    REVENANT_CORE_BALANCE_PROFILE_IDS.songOfTheMists,
    at,
    TRAIT.SONG_OF_THE_MISTS,
    (effect) => effect.metadata?.legendId === legendId
  );
}

function emitInvokingTorment(context: RevenantCastContext, at: number): void {
  const diabolicInferno = hasTrait(context.config, TRAIT.DIABOLIC_INFERNO);
  emitLegendInvocationProfile(
    context,
    REVENANT_CORE_BALANCE_PROFILE_IDS.invokingTorment,
    at,
    TRAIT.INVOKING_TORMENT,
    (effect) => effect.metadata?.trigger !== 'diabolic-inferno' || diabolicInferno
  );
}

/** Applies every selected trait that triggers from the newly invoked legend. */
export function applyLegendInvocationTraits(context: RevenantCastContext, swapSkill: RevenantSkill): void {
  const at = context.effectiveEnd;
  const legendId = professionCoreState(context).activeLegendId;
  if (CORE_LEGENDS.has(legendId) && hasTrait(context.config, TRAIT.SPIRIT_BOON)) {
    emitSpiritBoon(context, swapSkill, legendId, at);
  }

  if (CORE_LEGENDS.has(legendId) && hasTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) {
    emitSongOfTheMists(context, swapSkill, legendId, at);
  }

  if (hasTrait(context.config, TRAIT.INVOKING_TORMENT)) {
    emitInvokingTorment(context, at);
  }
}
