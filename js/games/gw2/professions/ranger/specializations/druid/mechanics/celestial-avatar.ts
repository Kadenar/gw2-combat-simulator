import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { resourceDepletion } from '#gw2/platform/profession-definition/mechanics.js';
import {
  advanceDiscreteResource,
  advanceResourceClock,
  setResourceRate
} from '#gw2/platform/combat/resources/clock.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { EPSILON } from '#kernel/core/clock.js';
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

export const DRUID_AVATAR_EXIT_TASK = 'ranger.druid-avatar-exit';

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
  // Reset so advance() doesn't count force drained before CA activated
  state.astralClock.updatedAt = context.start;
  // Stop the scheduler at expiry or depletion so exit effects and later force recovery run on time.
  const maximum = balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks');
  setResourceRate(state.astralClock, context.start, -maximum / avatarDuration);
  avatarDepletion.refresh(context);
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
  // Manual exit cancels the old deadline, including when another Avatar is entered later.
  avatarDepletion.stop(context);
  setResourceRate(state.astralClock, at, 0);
  // Exhausted (timer or force depleted) zeroes force; manual exit retains half
  state.astralClock.value = exhausted
    ? 0
    : state.astralClock.value *
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.resources),
        'astralForceRetentionMultiplier'
      );
  state.celestialAvatarActive = false;
  state.celestialAvatarEndsAt = 0;
  state.astralClock.updatedAt = at;
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
  endsAt: (context: RangerSchedulerContext) => druidState.from(context).celestialAvatarEndsAt,
  depleted: (context: RangerSchedulerContext, at: number) => leaveAvatar(context, true, at)
});

export function advanceDruidState(context: RangerSchedulerContext, target: number): void {
  const state = druidState.from(context);
  const maximum = balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks');
  const naturalMenderInterval = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.naturalMender),
    'pulseInterval'
  );
  const naturalMenderForce = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.naturalMender),
    'resourceGain'
  );
  state.astralClock.maximum = maximum;
  state.astralClock.value = Math.min(maximum, state.astralClock.value);
  if (state.astralClock.updatedAt === 0 && state.naturalMenderReadyAt === 3) {
    state.naturalMenderReadyAt = naturalMenderInterval;
  }

  if (state.celestialAvatarActive) {
    advanceResourceClock(state.astralClock, target);
    // Advance Natural Mender clock even during CA so ticks resume at the right time after exit
    state.naturalMenderReadyAt = advanceDiscreteResource(
      0,
      0,
      state.naturalMenderReadyAt,
      naturalMenderInterval,
      target
    ).nextAt;

    return;
  }

  state.astralClock.updatedAt = target;
  if (
    !hasTrait(context, TRAIT.NATURAL_MENDER) ||
    state.astralClock.value >= state.astralClock.maximum ||
    target < gw2CooldownReadyAt(state.naturalMenderReadyAt)
  ) {
    return;
  }

  // Natural Mender uses the same tick-detected fixed cadence as other regenerating resources.
  const applications = advanceDiscreteResource(0, Infinity, state.naturalMenderReadyAt, naturalMenderInterval, target);
  state.astralClock.value = Math.min(
    state.astralClock.maximum,
    state.astralClock.value + applications.value * naturalMenderForce
  );
  state.naturalMenderReadyAt = applications.nextAt;
}

export function astralForceReadyAt(context: RangerCastContext): number | null {
  const state = druidState.from(context);
  const maximum = balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks');
  state.astralClock.maximum = maximum;
  state.astralClock.value = Math.min(maximum, state.astralClock.value);
  const naturalMenderForce = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.naturalMender),
    'resourceGain'
  );
  const naturalMenderInterval = balanceProfileNumber(
    requireBalanceProfileFromContext(context, PROFILE.naturalMender),
    'pulseInterval'
  );
  const naturalMender = hasTrait(context, TRAIT.NATURAL_MENDER);
  if (state.astralClock.value >= maximum - EPSILON) return context.start;
  // Without Natural Mender, force only accumulates from damage events; no predictable ready time
  if (!naturalMender) return null;
  const applications = Math.ceil((maximum - state.astralClock.value) / naturalMenderForce);
  // naturalMenderReadyAt may already be in the past if advance() hasn't run yet; clamp to now
  return gw2CooldownReadyAt(
    Math.max(context.start, state.naturalMenderReadyAt) + (applications - 1) * naturalMenderInterval
  );
}

/** Capture observation-time data and apply local state changes only when the queue reaches the impact. */
export const druidAstralForceReaction = scheduledReaction<
  RangerSchedulerContext,
  SimulationEvent,
  Record<string, never>
>({
  id: 'ranger.druid-astral-force-damage',
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

    // Deferred task so all damage events at the same timestamp are coalesced into one force update
    return {
      at: event.at,
      priority: 20,
      ownerId: 'ranger.druid-astral-force',
      payload: {}
    };
  },
  execute(context) {
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
    state.astralClock.maximum = balanceProfileNumber(
      requireBalanceProfileFromContext(context, PROFILE.resources),
      'maximumStacks'
    );
    state.astralClock.value = Math.min(
      state.astralClock.maximum,
      state.astralClock.value + directDamageForce * (hasTrait(context, TRAIT.ECLIPSE) ? eclipseMultiplier : 1)
    );
  }
});
