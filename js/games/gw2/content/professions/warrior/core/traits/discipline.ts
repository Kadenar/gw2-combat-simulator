/** Owns imperative Discipline trait effects while the public dispatcher preserves cross-line ordering. */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { gainWarriorAdrenaline } from '#gw2/content/professions/warrior/resources.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/core/profiles.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/content/professions/warrior/types.js';

// Refund the configured burst resource and emit Swiftness after Burst Precision is armed.
export function applyBurstMastery(
  context: WarriorCastContext,
  skill: WarriorSkill,
  adrenalineSpent: number,
  options: {
    readonly resourceSpent?: number;
    readonly resourceRefundRate?: number;
  } = {}
): void {
  if (!skill.burst || adrenalineSpent <= 0 || !hasTrait(context, TRAIT.BURST_MASTERY)) return;
  const profile = balanceProfileFromContext(context, PROFILE.burstMastery);
  const swiftness = balanceProfileEffect(profile, 'boon');
  const resourceSpent = Number(options.resourceSpent ?? adrenalineSpent);
  const resourceRefundRate = Number(options.resourceRefundRate ?? profile?.resourceGain ?? 0.33);
  gainWarriorAdrenaline(context, Math.max(0, resourceSpent) * resourceRefundRate);
  emitSkillBuff(context, {
    at: context.effectiveEnd + context.epsilon,
    source: 'Trait',
    sourceId: TRAIT.BURST_MASTERY,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Burst Mastery — Swiftness',
    kind: 'swiftness',
    boon: 'swiftness',
    stacks: Number(swiftness?.stacks || 1),
    duration: gw2SchedulerBoonDuration(context, skill, 'swiftness', Number(swiftness?.duration || 3))
  });
}

// Grant Versatile Rage adrenaline between Martial Cadence reset and Furious Burst.
export function applyVersatileRage(context: WarriorCastContext): void {
  if (hasTrait(context, TRAIT.VERSATILE_RAGE)) gainWarriorAdrenaline(context, 5);
}
