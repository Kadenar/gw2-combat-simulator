import {
  grantResource,
  refreshResource,
  spendResource,
  resourceReadyAt,
  type ResourcePolicy
} from '#gw2/platform/combat/resources/resource-policy.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { resourceDepletion } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { applyRangerWeaponSwapTraits } from '#gw2/professions/ranger/core/traits/index.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '#gw2/professions/ranger/types.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';

import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/druid/profiles.js';

const DRUID_AVATAR_EXIT_TASK = 'ranger.druid-avatar-exit';

function applyNaturalBalance(context: RangerCastContext | RangerSchedulerContext, at: number): void {
  if (!hasTrait(context, TRAIT.NATURAL_BALANCE)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.naturalBalance);
  const effect = requireEffect(profile, 'buff', 'natural-balance');
  if (!effect) return;
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.NATURAL_BALANCE,
    actorType: 'effect',
    skillId: TRAIT.NATURAL_BALANCE,
    skillName: 'Natural Balance',
    name: 'Natural Balance',
    kind: String(effect.kind),
    duration: effectNumber(profile, effect, 'duration'),
    stacks: effectNumber(profile, effect, 'stacks')
  });
}

function emitAvatarWeaponSwap(
  context: RangerCastContext | RangerSchedulerContext,
  skill: RangerSkill,
  at: number
): void {
  // CA enter/exit swaps the visual weapon bar without changing activeWeaponSet; clearing chains avoids
  // resuming a mid-chain auto-attack on the wrong bar after the transition
  resetAutoattackChains(context);
  // Avatar transitions trigger the equipped set's swap sigils under the shared combat and cooldown rules.
  context.emit({
    type: 'sigil_swap',
    at,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet
  });
  applyRangerWeaponSwapTraits(context, skill, at);
}

export function enterAvatar(context: RangerCastContext, skill: RangerSkill): void {
  const state = druidState.from(context);
  const avatarDuration = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.resources),
    'durationMultiplier'
  );
  state.celestialAvatarActive = true;
  state.celestialAvatarEndsAt = context.start + avatarDuration;
  // Entry settles the previous segment before arming drain and its deadline.
  refreshResource(context, 'astralForce');
  // Release Celestial Avatar is a flip skill; storing endsAt lets the UI show it as expiring automatically
  armSkillFlip(
    professionCoreState(context).availableFlips,
    ID.RELEASE_CELESTIAL_AVATAR,
    context.start,
    state.celestialAvatarEndsAt
  );
  // Natural Balance triggers on both entry and exit
  applyNaturalBalance(context, context.start);
  // Swap happens at effectiveEnd (after the cast animation) so sigil procs line up correctly
  emitAvatarWeaponSwap(context, skill, context.effectiveEnd);
}

export function leaveAvatar(
  context: RangerCastContext | RangerSchedulerContext,
  exhausted = false,
  at = context.state.time,
  transitionSkill?: RangerSkill
): void {
  const state = druidState.from(context);
  if (!state.celestialAvatarActive) return;
  // Stop drain before consuming the amount lost on exit; manual exits retain the authored fraction.
  state.celestialAvatarActive = false;
  state.celestialAvatarEndsAt = 0;
  refreshResource(context, 'astralForce');
  const retained = exhausted
    ? 0
    : balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.resources),
        'astralForceRetentionMultiplier'
      );
  spendResource(context, 'astralForce', state.astralClock.value * (1 - retained));
  // Remove the flip so Release Celestial Avatar no longer appears as available
  consumeSkillFlip(professionCoreState(context).availableFlips, ID.RELEASE_CELESTIAL_AVATAR);
  applyNaturalBalance(context, at);
  // Fallback to catalog lookup when the exit is triggered by the timer (no skill in context)
  const skill =
    transitionSkill || (context.catalog.skillsById.get(ID.RELEASE_CELESTIAL_AVATAR) as RangerSkill | undefined);
  if (skill) emitAvatarWeaponSwap(context, skill, at);
}

/** Avatar ends once, at the earlier duration or depletion deadline of its current lifetime. */
export const avatarDepletion = resourceDepletion({
  id: DRUID_AVATAR_EXIT_TASK,
  clock: (context: RangerSchedulerContext) => druidState.from(context).astralClock,
  endsAt: (context: RangerSchedulerContext) =>
    druidState.from(context).celestialAvatarActive ? druidState.from(context).celestialAvatarEndsAt : Infinity,
  depleted: (context: RangerSchedulerContext, at: number) => leaveAvatar(context, true, at)
});

/** Natural Mender keeps a fixed authored cadence even while Avatar suppresses its grants. */
export const naturalMender = timedEffect<RangerSchedulerContext, { deadline: number; interval: number }>({
  id: 'ranger.natural-mender',
  // Settle a pulse before same-time Avatar exit so suppressed ticks cannot become post-exit grants.
  priority: -1,
  effectsAt(context) {
    if (!druidState.from(context).celestialAvatarActive)
      grantResource(
        context,
        'astralForce',
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.naturalMender), 'resourceGain')
      );
  },
  nextAt(_context, _at, captured) {
    captured.deadline += captured.interval;
    return gw2CooldownReadyAt(captured.deadline);
  }
});
export function initializeNaturalMender(context: RangerSchedulerContext): void {
  if (!hasTrait(context, TRAIT.NATURAL_MENDER)) return;
  const interval = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.naturalMender),
    'pulseInterval'
  );
  if (interval > 0)
    naturalMender.start(context, {
      key: 'natural-mender',
      at: gw2CooldownReadyAt(interval),
      captured: { deadline: interval, interval }
    });
}

/** Affordability waits on the next known grant without predicting unlanded attacks. */
export function astralForceReadyAt(context: RangerCastContext): number | null {
  return resourceReadyAt(context, 'astralForce', druidState.from(context).astralClock.maximum, context.start);
}

/** Capture observation-time data and apply local state changes only when the queue reaches the impact. */
export const druidAstralForceReaction = eventReaction<RangerSchedulerContext, SimulationEvent, { eventOrder: number }>({
  id: 'ranger.druid-astral-force-damage',
  missingEvent: 'skip',
  order: 0,
  select(_context, event) {
    // Only player-sourced hits generate astral force; pet strikes and independent summon hits are excluded
    if (
      event.type !== 'damage' ||
      event.actorType === 'summon' ||
      event.ownerActorType === 'summon' ||
      event.source === 'ranger-pet' ||
      event.independentSummonStrike === true
    ) {
      return null;
    }

    // Each surviving hit grants force at its own causal timestamp.
    return {
      at: event.at,
      priority: 20,
      ownerId: 'ranger.druid-astral-force',
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute(context, event) {
    if (event.cancelled || event.offTarget) return;
    const state = druidState.from(context);
    // Force doesn't accumulate while CA is active (it's draining instead)
    if (state.celestialAvatarActive) return;
    // Eclipse doubles the astral force gained per hit
    const directDamageForce = balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.resources),
      'resourceGain'
    );
    const eclipseMultiplier = balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.resources),
      'coefficientMultiplier'
    );
    grantResource(
      context,
      'astralForce',
      directDamageForce * (hasTrait(context, TRAIT.ECLIPSE) ? eclipseMultiplier : 1)
    );
  }
});

/** Avatar rules own the rate; the engine owns force recovery and depletion scheduling. */
export const astralForce: ResourcePolicy<RangerSchedulerContext> = {
  kind: 'continuous',
  state: (context) => druidState.from(context).astralClock,
  maximum: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
  initial: (context, maximum) => Number(context.config.initialAstralForce ?? maximum),
  recovery(context) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.resources);
    const duration = balanceProfileNumber(profile, 'durationMultiplier');
    return druidState.from(context).celestialAvatarActive && duration > 0
      ? -balanceProfileNumber(profile, 'maximumStacks') / duration
      : 0;
  },
  depletion: avatarDepletion,
  nextChange: (context) =>
    Math.min(naturalMender.nextAt(context, 'natural-mender'), context.tasks.nextAt('ranger.druid-astral-force-damage'))
};
