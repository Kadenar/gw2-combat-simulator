/** Owns imperative Core Necromancer Soul Reaping trait behavior for ordered dispatcher calls. */
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

import {
  applyTraitCondition,
  applyTraitVulnerability
} from '#gw2/professions/necromancer/core/mechanics/trait-effects.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** The first accepted player strike of a mark contributes to the shared percentage grant. */
export function soulMarksLifeForce(
  runtime: NecromancerRuntime,
  skill: NecromancerSkill,
  event: NecromancerResolverEvent
): number {
  return Number(event.hitIndex ?? 1) === 1 && skill.categories?.includes('Mark') && hasTrait(runtime, TRAIT.SOUL_MARKS)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_MARKS), 'lifeForceGain')
    : 0;
}

/** Accepted non-summon fear grants life force under one cooldown; missed and travelling packets grant nothing. */
export function applyFearOfDeath(runtime: NecromancerRuntime, event: NecromancerResolverEvent): void {
  if (
    event.controlKind !== 'fear' ||
    event.actorType === 'summon' ||
    !hasTrait(runtime, TRAIT.FEAR_OF_DEATH) ||
    !isInternalCooldownReady(runtime.time, runtime.procs.deadline('necromancer.core.fearOfDeath'))
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FEAR_OF_DEATH);
  runtime.procs.readyAt['necromancer.core.fearOfDeath'] =
    runtime.time + balanceProfileNumber(profile, 'internalCooldown');
  grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
}

export function applyDhuumfire(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  skillDuration: unknown,
  shroudSkillOne: boolean
): void {
  if (!hasTrait(context, TRAIT.DHUUMFIRE) || !shroudSkillOne) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.dhuumfire);
  const effect = requireEffect(profile, 'condition', 'Burning');
  const interval = event.metadata?.dhuumfireInterval || 0;
  // Zero or absent intervals bypass the claim so same-time applications remain unrestricted; the claim gates only
  // Burning, so a removed packet leaves it ready.
  if (!effect) return;
  if (interval > 0 && !context.procs.claimCooldown('dhuumfire', event.at, interval)) {
    return;
  }

  applyTraitCondition(context, event, {
    name: 'Dhuumfire',
    traitId: TRAIT.DHUUMFIRE,
    condition: String(effect.condition),
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: Number(event.metadata?.dhuumfireDuration ?? skillDuration ?? effect.duration ?? 3)
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
