import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import type {
  GuardianCastContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

/** Applies Virtues trait effects at their existing positions in the public Guardian dispatchers. */
export function applyInspiredVirtue(
  context: GuardianCastContext,
  skill: GuardianSkill,
  virtueSlot: string,
  at: number
): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)) return;
  const inspiredVirtueProfile = requireBalanceProfileFromContext(context, PROFILE.inspiredVirtue);
  const inspired = requireEffect(
    inspiredVirtueProfile,
    'boon',
    virtueSlot === 'Profession_1' ? 'might' : virtueSlot === 'Profession_2' ? 'regeneration' : 'protection'
  );
  if (!inspired) return;
  const boon = String(inspired.boon);
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    stacks: effectNumber(inspiredVirtueProfile, inspired, 'stacks'),
    sourceId: GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
    actorType: 'player',
    name: 'Inspired Virtue',
    kind: boon,
    duration: effectNumber(inspiredVirtueProfile, inspired, 'duration'),
    // Virtue activations apply these boons to nearby allies.
    audience: { recipients: 'party' as const }
  });
}

export function applyVirtueOfResolution(context: GuardianCastContext, skill: GuardianSkill, at: number): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)) return;
  const virtueOfResolutionProfile = requireBalanceProfileFromContext(context, PROFILE.virtueOfResolution);
  const resolution = requireEffect(virtueOfResolutionProfile, 'boon', 'resolution');
  if (!resolution) return;
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
    actorType: 'player',
    name: 'Virtue of Resolution',
    kind: 'resolution',
    duration: effectNumber(virtueOfResolutionProfile, resolution, 'duration'),
    stacks: effectNumber(virtueOfResolutionProfile, resolution, 'stacks')
  });
}

export function applyInspiringVirtue(context: GuardianCastContext, skill: GuardianSkill, at: number): void {
  if (!hasTrait(context, GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE)) return;
  const inspiringVirtueProfile = requireBalanceProfileFromContext(context, PROFILE.inspiringVirtue);
  const inspiring = requireEffect(inspiringVirtueProfile, 'buff', 'guardian-inspiring-virtue');
  if (!inspiring) return;
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
    actorType: 'player',
    name: 'Inspiring Virtue',
    kind: 'guardian-inspiring-virtue',
    duration: effectNumber(inspiringVirtueProfile, inspiring, 'duration'),
    stacks: effectNumber(inspiringVirtueProfile, inspiring, 'stacks')
  });
}

export function applyIndomitableCourage(
  context: GuardianCastContext,
  skill: GuardianSkill,
  virtueSlot: string,
  at: number
): void {
  if (virtueSlot !== 'Profession_3' || !hasTrait(context, GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE)) return;
  const indomitableCourageProfile = requireBalanceProfileFromContext(context, PROFILE.indomitableCourage);
  const stability = requireEffect(indomitableCourageProfile, 'boon', 'stability');
  if (!stability) return;
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    stacks: effectNumber(indomitableCourageProfile, stability, 'stacks'),
    sourceId: GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE,
    actorType: 'player',
    name: 'Indomitable Courage',
    kind: 'stability',
    duration: effectNumber(indomitableCourageProfile, stability, 'duration')
  });
}

// Report whether the dispatcher must stop so Resolution replacement keeps its original early-return boundary.
export function replaceVirtueOfResolutionDuration(
  context: GuardianSchedulerContext,
  event: GuardianResolverEvent
): boolean {
  if (
    event.type !== 'buff' ||
    String(event.kind || '').toLowerCase() !== 'resolution' ||
    !(Number(event.duration || 0) > 0) ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION)
  ) {
    return false;
  }

  const virtueOfResolutionProfile = requireBalanceProfileFromContext(context, PROFILE.virtueOfResolution);
  context.replaceEvent(event, {
    duration: Number(event.duration) * balanceProfileNumber(virtueOfResolutionProfile, 'durationMultiplier')
  });
  return true;
}

/** Emits each surviving extension effect directly from its authored cast-start timeline. */
export function applyMasterOfConsecrations(context: GuardianCastContext, skill: GuardianSkill): void {
  if (
    skill.id !== GUARDIAN_SKILL_IDS.PURGING_FLAMES ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS)
  ) {
    return;
  }

  const masterOfConsecrationsProfile = requireBalanceProfileFromContext(context, PROFILE.masterOfConsecrations);
  const strike = requireEffect(masterOfConsecrationsProfile, 'strike', 'Strike');
  const burning = requireEffect(masterOfConsecrationsProfile, 'condition', 'Burning');
  const ticks = strike?.ticks;
  if (strike && !ticks?.length) throw new Error('Master of Consecrations requires an explicit strike timeline.');
  for (const [index, tick] of (ticks ?? []).entries()) {
    const pulseAt = context.start + tick.atMs / 1000;
    context.emit(
      buildGuardianStrike({
        at: pulseAt,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        name: skill.name,
        coefficient: Number(tick.coefficient),
        skillWeapon: 'Unequipped',
        hitIndex: 7 + index,
        totalHits: 6 + (ticks?.length ?? 0)
      })
    );
  }

  const burningTicks = burning?.ticks;
  if (burning && !burningTicks?.length)
    throw new Error('Master of Consecrations requires an explicit condition timeline.');
  for (const tick of burningTicks ?? []) {
    emitSkillCondition(context, {
      skill,
      at: context.start + tick.atMs / 1000,
      name: `${skill.name} — Burning`,
      condition: tick.condition,
      stacks: tick.stacks,
      duration: tick.duration
    });
  }
}
