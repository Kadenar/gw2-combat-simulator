import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/skills/timing.js';
import { advanceEndurance, enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { selfBoonIntervals } from '#gw2/platform/combat/state/boon-extensions.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { refreshVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import type {
  ThiefPrecastContext,
  ThiefCastContext,
  ThiefCoreState,
  ThiefResourceContext,
  ThiefSchedulerContext,
  ThiefSkill
} from '#gw2/professions/thief/types.js';

export function thiefInitiativeRegenerationRate(state: Pick<ThiefCoreState, 'kneeling'>, context?: unknown): number {
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  return (
    Number(resources?.resourceGain ?? 1) +
    (state.kneeling ? Number(resources?.kneelingInitiativeRegenerationBonus ?? 1 / 3) : 0)
  );
}

export function thiefEnduranceRegenerationRate(
  context: ThiefResourceContext,
  at = Number(context.start ?? context.state?.time ?? 0),
  vigorActive = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at))
): number {
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const base = Number(resources?.enduranceRegenerationPerSecond ?? 5);
  const vigorMultiplier = Number(resources?.vigorRegenerationMultiplier ?? 1.5);
  return Math.min(Number(resources?.threshold ?? 10), base * (vigorActive ? vigorMultiplier : 1));
}

export function thiefEnduranceReadyAt(context: ThiefPrecastContext, cost: number): number | null {
  let current = Number(professionCoreState(context).endurance || 0);
  // Predict affordability across the same pooled Vigor windows used by advancement.
  for (const interval of selfBoonIntervals(context.events, 'vigor', context.start, Infinity)) {
    const rate = thiefEnduranceRegenerationRate(
      context,
      interval.start,
      Boolean(context.config.boons?.vigor || interval.active)
    );
    const readyAt = enduranceReadyAt(current, cost, interval.start, rate, context.epsilon);
    if (readyAt != null && readyAt <= interval.end) return readyAt;
    current += (interval.end - interval.start) * rate;
  }

  return null;
}

// Advance initiative and endurance regeneration while pruning expired Lead
// Attacks, venom, guild summon, and flip state at the same target timestamp.
export function advanceThiefCoreResources(context: ThiefSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  state.maximumInitiative = hasTrait(context.config, TRAIT.PREPAREDNESS)
    ? Number(resources?.minimumStacks ?? 15)
    : Number(resources?.maximumStacks ?? 12);
  state.leadAttackExpirations = (state.leadAttackExpirations || []).filter((expiresAt) => Number(expiresAt) > target);
  state.leadAttacksStacks = state.leadAttackExpirations.length;
  refreshVenomCharges(state, target);

  if (state.activeThievesGuild && Number(state.activeThievesGuild.expiresAt || 0) <= target) {
    state.activeThievesGuild = null;
  }

  for (const [skillId, expiresAt] of Object.entries(state.availableFlips)) {
    if (Number(expiresAt || 0) <= target) delete state.availableFlips[skillId];
  }

  const initiativeFrom = Number(state.initiativeUpdatedAt || 0);
  if (target > initiativeFrom) {
    state.initiative = Math.min(
      state.maximumInitiative,
      state.initiative + (target - initiativeFrom) * thiefInitiativeRegenerationRate(state, context)
    );
    state.initiativeUpdatedAt = target;
  }

  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  // Integrate each rate window so unrelated wait boundaries cannot change recovery.
  for (const interval of selfBoonIntervals(context.events, 'vigor', enduranceFrom, target)) {
    Object.assign(
      state,
      advanceEndurance(
        state,
        interval.end,
        thiefEnduranceRegenerationRate(
          context,
          interval.start,
          Boolean(context.config.boons?.vigor || interval.active)
        ),
        state.maximumEndurance
      )
    );
  }

  emitThiefStateSnapshot(context, target, 'resources');
}

// Spend initiative at cast start and apply Signets of Power's immediate refund
// for qualifying signet activations.
export function spendThiefCoreResources(context: ThiefPrecastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0) {
    state.initiative = Math.max(0, state.initiative - cost);
    emitThiefStateSnapshot(context, context.start, 'initiative-spent');
  }

  if (
    (skill.categories || []).some((category) => String(category).toLowerCase().includes('signet')) &&
    hasTrait(context.config, TRAIT.SIGNETS_OF_POWER)
  ) {
    gainThiefInitiative(
      context,
      Number(balanceProfileFromContext(context, PROFILE.signetsOfPower)?.resourceGain ?? 3),
      context.start,
      'signets-of-power'
    );
  }
}

export function completeThiefCoreResources(context: ThiefCastContext, skill: ThiefSkill): void {
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
  if (context.effectiveEnd + context.epsilon < finalBulletAt) return;
  gainThiefInitiative(
    context,
    Number(balanceProfileFromContext(context, PROFILE.unloadRefund)?.resourceGain ?? 2),
    context.effectiveEnd,
    'unload-refund'
  );
}
