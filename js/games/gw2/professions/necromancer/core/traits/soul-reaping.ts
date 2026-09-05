/** Owns imperative Core Necromancer Soul Reaping trait behavior for ordered dispatcher calls. */
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { gainNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import {
  applyTraitCondition,
  applyTraitVulnerability
} from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import type {
  NecromancerCastContext,
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Supplies Gluttony's life-force multiplier to the interleaved Spiteful Fortitude step. */
export function gluttonyLifeForceMultiplier(context: NecromancerResolverContext): number {
  return hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1;
}

export function applyDhuumfire(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skillDuration: unknown,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.DHUUMFIRE) || !shroudSkillOne) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.dhuumfire), 'condition');
  const interval = Number(event.metadata?.dhuumfireInterval || 0);
  if (
    interval > 0 &&
    !isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt?.dhuumfire || 0))
  ) {
    return;
  }

  if (interval > 0) {
    professionCoreState(context).traitProcReadyAt.dhuumfire = event.at + interval;
  }

  applyTraitCondition(context, event, {
    name: 'Dhuumfire',
    traitId: TRAIT.DHUUMFIRE,
    condition: String(effect?.condition || 'Burning'),
    stacks: Number(effect?.stacks ?? 1),
    duration: Number(event.metadata?.dhuumfireDuration ?? skillDuration ?? effect?.duration ?? 3)
  });
}

export function applyUnyieldingBlast(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  firstHit: boolean,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.UNYIELDING_BLAST) || !firstHit || !shroudSkillOne) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.unyieldingBlast), 'condition');
  applyTraitVulnerability(context, event, {
    name: 'Unyielding Blast',
    traitId: TRAIT.UNYIELDING_BLAST,
    stacks: Number(effect?.stacks ?? 2),
    duration: Number(effect?.duration ?? 10)
  });
}

/** Grants Fear of Death life force only after a completed fear-producing cast and its ICD. */
export function applyFearOfDeath(context: NecromancerCastContext, skill: NecromancerSkill): void {
  const state = professionCoreState(context);
  const control = (skill.effects || []).find((effect) => effect.type === 'control');
  if (
    control?.controlKind !== 'fear' ||
    !hasTrait(context, TRAIT.FEAR_OF_DEATH) ||
    !isInternalCooldownReady(context.effectiveEnd, Number(state.fearOfDeathReadyAt || 0))
  )
    return;
  gainNecromancerLifeForce(context, 15, context.effectiveEnd, 'fear-of-death');
  state.fearOfDeathReadyAt = context.effectiveEnd + 4;
}
