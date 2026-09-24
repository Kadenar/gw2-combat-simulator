import { spendResource, type ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { pruneSkillFlips } from '#gw2/platform/engine/skills/skill-flips.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import { EPSILON } from '#kernel/core/clock.js';
import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';

import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefEndurance, gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { refreshVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import type {
  ThiefPrecastContext,
  ThiefCastContext,
  ThiefResourceContext,
  ThiefSchedulerContext,
  ThiefSkill
} from '#gw2/professions/thief/types.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import { advanceProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

/** Restart the equipped signet's ten-second pulse after it becomes ready, including cooldown resets. */
export function restartInfiltratorsSignetPassive(context: ThiefSchedulerContext): void {
  if (!selectedSkillNameSet(context.config.selectedSkills).has("Infiltrator's Signet")) return;
  infiltratorsSignetPassive.start(context, {
    key: 'thief.infiltrators-signet',
    at: Math.max(context.state.time, Number(context.state.cooldowns.get(ID.INFILTRATORS_SIGNET) || 0)) + 10,
    captured: {}
  });
}

/** Grant discrete initiative pulses so queued skills can become affordable at the pulse timestamp. */
export const infiltratorsSignetPassive = timedEffect<ThiefSchedulerContext, object>({
  id: 'thief.infiltrators-signet',
  nextAt: (context, at) => Math.max(at, Number(context.state.cooldowns.get(ID.INFILTRATORS_SIGNET) || 0)) + 10,
  effectsAt(context, at) {
    if (!selectedSkillNameSet(context.config.selectedSkills).has("Infiltrator's Signet")) return false;
    if (Number(context.state.cooldowns.get(ID.INFILTRATORS_SIGNET) || 0) <= at + EPSILON) {
      gainThiefInitiative(context, 1, at, 'infiltrators-signet');
    }
  }
});

/** Both readiness and regeneration use required tuning from the selected catalog. */
export function thiefInitiativeRegenerationRate(state: Pick<ThiefCoreState, 'kneeling'>, context: unknown): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return (
    balanceProfileNumber(profile, 'resourceGain') +
    (state.kneeling ? balanceProfileNumber(profile, 'kneelingInitiativeRegenerationBonus') : 0)
  );
}

function thiefEnduranceRegenerationRate(
  context: ThiefResourceContext,
  at = Number(context.start ?? context.state?.time ?? 0),
  vigorActive = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at))
): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const base = balanceProfileNumber(resourcesProfile, 'enduranceRegenerationPerSecond');
  const vigorMultiplier = balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier');
  return Math.min(balanceProfileNumber(resourcesProfile, 'threshold'), base * (vigorActive ? vigorMultiplier : 1));
}

// Advance endurance and prune expired effects after the engine settles initiative.
export function advanceThiefCoreResources(context: ThiefSchedulerContext, target: number): void {
  const state = professionCoreState(context);

  state.leadAttackExpirations = purgeExpiredStacks(state.leadAttackExpirations || [], target);
  state.leadAttacksStacks = state.leadAttackExpirations.length;
  // Ground axes expire independently, including while waiting or using another weapon.
  state.spinningAxeExpirations = purgeExpiredStacks(state.spinningAxeExpirations, target);
  refreshVenomCharges(state, target);

  if (state.activeThievesGuild && Number(state.activeThievesGuild.expiresAt || 0) <= target) {
    state.activeThievesGuild = null;
  }

  pruneSkillFlips(state.availableFlips, target);

  // Integrate shared Vigor windows so waits cannot change recovery; permanent Vigor needs no history replay.
  advanceProfessionEndurance(context, target);

  emitThiefStateSnapshot(context, target, 'resources');
}

// Spend initiative at cast start and apply Signets of Power's immediate refund
// for qualifying signet activations.
export function spendThiefCoreResources(context: ThiefPrecastContext, skill: ThiefSkill): void {
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0) {
    spendResource(context, 'initiative', cost);
    emitThiefStateSnapshot(context, context.start, 'initiative-spent');
  }

  if (
    (skill.categories || []).some((category) => String(category).toLowerCase().includes('signet')) &&
    hasTrait(context.config, TRAIT.SIGNETS_OF_POWER)
  ) {
    const signetsOfPowerProfile = requireBalanceProfileFromContext(context, PROFILE.signetsOfPower);
    gainThiefInitiative(
      context,
      balanceProfileNumber(signetsOfPowerProfile, 'resourceGain'),
      context.start,
      'signets-of-power'
    );
  }
}

export function completeThiefCoreResources(context: ThiefCastContext, skill: ThiefSkill): void {
  if (skill.id === ID.INFILTRATORS_SIGNET) {
    restartInfiltratorsSignetPassive(context);
    return;
  }

  // Agility restores a fixed 100 endurance on activation, capped by the specialization's endurance pool.
  if (skill.id === ID.SIGNET_OF_AGILITY) {
    const signetOfAgilityProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfAgility);
    gainThiefEndurance(
      context,
      balanceProfileNumber(signetOfAgilityProfile, 'resourceGain'),
      context.effectiveEnd,
      'signet-of-agility'
    );
    return;
  }

  if (skill.id !== ID.UNLOAD) return;
  // A default commit-mode interruption cannot award Unload's on-completion refund when its damage was cancelled.
  if (context.action?.cancelled === true) return;
  const bullets = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Unload');
  if (bullets?.type !== 'strike') return;
  const finalBulletOffsetMs = Number(bullets.ticks?.at(-1)?.atMs);
  if (!Number.isFinite(finalBulletOffsetMs)) return;
  const timingScale =
    bullets.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, (context.fullEnd - context.start) * 1000) : 1;
  const finalBulletAt = context.start + (finalBulletOffsetMs * timingScale) / 1000;
  if (context.effectiveEnd + EPSILON < finalBulletAt) return;
  const unloadRefundProfile = requireBalanceProfileFromContext(context, PROFILE.unloadRefund);
  gainThiefInitiative(
    context,
    balanceProfileNumber(unloadRefundProfile, 'resourceGain'),
    context.effectiveEnd,
    'unload-refund'
  );
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const thiefEndurance: EndurancePolicy<ThiefSchedulerContext> = {
  state: (context) => professionCoreState(context),
  maximum: () => 100,
  regenerationRate: (context, vigor, at) => thiefEnduranceRegenerationRate(context, at, vigor)
};

/** Initiative shares the platform lifecycle while kneeling and Preparedness remain Thief rules. */
export const thiefInitiative: ResourcePolicy<ThiefSchedulerContext> = {
  kind: 'continuous',
  state: (context) => professionCoreState(context).initiative,
  maximum: (context) =>
    balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.resources),
      hasTrait(context.config, TRAIT.PREPAREDNESS) ? 'minimumStacks' : 'maximumStacks'
    ),
  initial: (context) => Number(context.config.initialInitiative ?? 12),
  recovery: (context) => thiefInitiativeRegenerationRate(professionCoreState(context), context),
  // Queued grants can fund a cast even when passive regeneration is disabled.
  nextChange: (context) =>
    Math.min(
      infiltratorsSignetPassive.nextAt(context, 'thief.infiltrators-signet'),
      context.tasks.nextAt('thief.resource-grant')
    )
};
