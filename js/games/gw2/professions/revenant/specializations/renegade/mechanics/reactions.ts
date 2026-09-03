import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileFromContext as balanceProfileById } from '#gw2/platform/combat/state/balance-profiles.js';
import { activeKallasFervorStacks } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import type { SchedulerRecord, SkillId } from '#gw2/platform/engine/types.js';
import type { RevenantResolverContext, RevenantResolverEvent, RevenantSkill } from '#gw2/professions/revenant/types.js';

function activeSkillIds(context: RevenantResolverContext): Set<SkillId> {
  return new Set<SkillId>(professionCoreState(context).activeUpkeeps.map((upkeep) => upkeep.skillId));
}

function skillById(context: RevenantResolverContext, id: SkillId): RevenantSkill | undefined {
  return context.helpers.skillsById?.get(id) as RevenantSkill | undefined;
}

function kallasFervorLifeSiphonMultiplier(context: RevenantResolverContext, at: number): number {
  const stacks = activeKallasFervorStacks(renegadeState.from(context), at);
  if (!stacks) return 1;
  const profile = balanceProfileById(
    context,
    hasTrait(context.config, TRAIT.LASTING_LEGACY)
      ? RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy
      : RENEGADE_PROFILE_IDS.kallasFervor
  );
  const perStack = Number(profile?.lifeSiphonDamagePerStack || 0);
  return 1 + stacks * perStack;
}

function reactToDamage(context: RevenantResolverContext, event: RevenantResolverEvent): void {
  // Only player hits with a real damage coefficient trigger Soulcleave; effect-sourced hits don't cascade
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const active = activeSkillIds(context);
  const soulcleave = skillById(context, ID.SOULCLEAVES_SUMMIT);
  const proc = skillById(context, RENEGADE_PROFILE_IDS.soulcleavesSummitProc);
  if (
    soulcleave &&
    proc &&
    active.has(soulcleave.id) &&
    // Exclude Soulcleave's own events to prevent self-triggering
    event.skillId !== soulcleave.id &&
    isInternalCooldownReady(event.at, Number(renegadeState.from(context).soulcleaveReadyAt || 0))
  ) {
    renegadeState.from(context).soulcleaveReadyAt = event.at + Math.max(0, Number(proc.cooldown || 0));
    for (const effect of proc.effects || []) {
      const applications = materializeSkillEffectApplications({
        skill: proc,
        effect,
        start: event.at,
        fullEnd: event.at,
        baseEvent: {
          source: 'revenant',
          sourceId: soulcleave.id,
          actorType: effect.actorType || 'effect',
          skillId: soulcleave.id,
          skillName: soulcleave.name
        },
        skillWeaponFallback: 'Unequipped'
      });
      for (const application of applications) {
        enqueueOrdered(context.queue, {
          ...application.event,
          ...(Number(application.event.flatStrikeBase) || Number(application.event.flatStrikePowerCoeff)
            ? {
                flatStrikeMultiplier: kallasFervorLifeSiphonMultiplier(context, event.at)
              }
            : {}),
          triggeredBy: event.skillName
        } as RevenantResolverEvent);
      }
    }
  }
}

function reactToFoodProc(context: RevenantResolverContext, event: RevenantResolverEvent): SchedulerRecord | undefined {
  // Food procs that are life siphons also benefit from Kalla's Fervor; returning a partial record merges flatStrikeMultiplier into the proc before resolution
  if (!event.lifeSiphon) return;
  return {
    flatStrikeMultiplier: kallasFervorLifeSiphonMultiplier(context, event.at)
  };
}

export const revenantRenegadeEventReactions = Object.freeze({
  damage: reactToDamage,
  food_proc: reactToFoodProc
});

export const renegadeEventHandlers = Object.freeze({});
