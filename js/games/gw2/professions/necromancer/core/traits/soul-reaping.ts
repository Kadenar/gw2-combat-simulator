/** Owns imperative Core Necromancer Soul Reaping trait behavior for ordered dispatcher calls. */
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
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

export function applyDhuumfire(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skillDuration: unknown,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.DHUUMFIRE) || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.dhuumfire);
  const effect = requireEffect(profile, 'condition', 'Burning');
  const interval = Number(event.metadata?.dhuumfireInterval || 0);
  // Zero or absent intervals bypass the claim so same-time applications remain unrestricted; the claim gates only
  // Burning, so a removed packet leaves it ready.
  if (!effect) return;
  if (
    interval > 0 &&
    !tryConsumeProcCooldown(professionCoreState(context).traitProcReadyAt, 'dhuumfire', event.at, interval)
  ) {
    return;
  }

  applyTraitCondition(context, event, {
    name: 'Dhuumfire',
    traitId: TRAIT.DHUUMFIRE,
    condition: String(effect.condition),
    stacks: effectNumber(profile, effect, 'stacks'),
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
  const profile = requireBalanceProfileFromContext(context, PROFILE.unyieldingBlast);
  const effect = requireEffect(profile, 'condition', 'Vulnerability');
  if (!effect) return;
  applyTraitVulnerability(context, event, {
    name: 'Unyielding Blast',
    traitId: TRAIT.UNYIELDING_BLAST,
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration')
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
  gainNecromancerLifeForce(
    context,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEAR_OF_DEATH), 'lifeForceGain'),
    context.effectiveEnd,
    'fear-of-death'
  );
  state.fearOfDeathReadyAt =
    context.effectiveEnd +
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEAR_OF_DEATH), 'internalCooldown');
}
