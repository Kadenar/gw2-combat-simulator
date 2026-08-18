import { professionCoreState } from '../../../platform/engine/profession.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { hasThiefTrait } from './state.js';
import { emitThiefState, gainThiefInitiative } from './shared.js';
import { thiefBalanceProfile, THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type {
  ThiefPrecastContext,
  ThiefCastContext,
  ThiefCoreState,
  ThiefResourceContext,
  ThiefSchedulerContext,
  ThiefSkill
} from '../types.js';

export function thiefInitiativeRegenerationRate(state: Pick<ThiefCoreState, 'kneeling'>, context?: unknown): number {
  const resources = thiefBalanceProfile(context, PROFILE.resources);
  return (
    Number(resources?.resourceGain || 1) +
    (state.kneeling ? Number(resources?.kneelingInitiativeRegenerationBonus ?? 1 / 3) : 0)
  );
}

export function thiefEnduranceRegenerationRate(
  context: ThiefResourceContext,
  at = Number(context.start ?? context.state?.time ?? 0)
): number {
  const vigorActive = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at));
  const resources = thiefBalanceProfile(context, PROFILE.resources);
  const base = Number(resources?.enduranceRegenerationPerSecond || 5);
  const vigorMultiplier = Number(resources?.vigorRegenerationMultiplier || 1.5);
  return Math.min(Number(resources?.threshold || 10), base * (vigorActive ? vigorMultiplier : 1));
}

export function thiefEnduranceReadyAt(context: ThiefPrecastContext, cost: number): number | null {
  const current = Number(professionCoreState(context).endurance || 0);
  const required = Math.max(0, Number(cost || 0));
  const missing = required - current;
  if (missing <= Number(context.epsilon || 0.0001)) return context.start;
  const rate = thiefEnduranceRegenerationRate(context, context.start);
  return rate > 0 ? context.start + missing / rate : null;
}

export function advanceThiefCoreResources(context: ThiefSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const resources = thiefBalanceProfile(context, PROFILE.resources);
  state.maximumInitiative = hasThiefTrait(context.config, TRAIT.PREPAREDNESS)
    ? Number(resources?.minimumStacks || 15)
    : Number(resources?.maximumStacks || 12);
  state.maximumEndurance =
    context.state.profession.specialization.kind === 'Daredevil'
      ? Number(thiefBalanceProfile(context, 'thief.daredevil.resources')?.maximumStacks || 150)
      : 100;
  state.endurance = Math.min(state.maximumEndurance, state.endurance);
  state.leadAttackExpirations = (state.leadAttackExpirations || []).filter((expiresAt) => Number(expiresAt) > target);
  state.leadAttacksStacks = state.leadAttackExpirations.length;
  state.leadAttacksUntil = state.leadAttackExpirations.length ? Math.max(...state.leadAttackExpirations) : 0;
  if (Number(state.spiderVenomExpiresAt || 0) <= target) {
    state.spiderVenomCharges = 0;
  }
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
  if (target > enduranceFrom) {
    state.endurance = Math.min(
      state.maximumEndurance,
      state.endurance + (target - enduranceFrom) * thiefEnduranceRegenerationRate(context, (enduranceFrom + target) / 2)
    );
    state.enduranceUpdatedAt = target;
  }
  emitThiefState(context, target, 'resources');
}

export function spendThiefCoreResources(context: ThiefPrecastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0) {
    state.initiative = Math.max(0, state.initiative - cost);
    emitThiefState(context, context.start, 'initiative-spent');
  }
  if (
    (skill.categories || []).some((category) => String(category).toLowerCase().includes('signet')) &&
    hasThiefTrait(context.config, TRAIT.SIGNETS_OF_POWER)
  ) {
    gainThiefInitiative(
      context,
      Number(thiefBalanceProfile(context, PROFILE.signetsOfPower)?.resourceGain || 3),
      context.start,
      'signets-of-power'
    );
  }
}

export function completeThiefCoreResources(context: ThiefCastContext, skill: ThiefSkill): void {
  if (skill.id !== ID.UNLOAD) return;
  const bullets = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Unload');
  if (!bullets || bullets.atMs == null) return;
  const finalBulletOffsetMs =
    Number(bullets.atMs) + (Math.max(1, Number(bullets.hits || 1)) - 1) * Number(bullets.intervalMs || 0);
  const baseCastMs = Math.max(0, Number(skill.castTimeMs || 0));
  const timingScale =
    bullets.timingScale === 'cast' && baseCastMs > 0 ? ((context.fullEnd - context.start) * 1000) / baseCastMs : 1;
  const finalBulletAt = context.start + (finalBulletOffsetMs * timingScale) / 1000;
  if (context.effectiveEnd + context.epsilon < finalBulletAt) return;
  gainThiefInitiative(
    context,
    Number(thiefBalanceProfile(context, PROFILE.unloadRefund)?.resourceGain || 2),
    context.effectiveEnd,
    'unload-refund'
  );
}
