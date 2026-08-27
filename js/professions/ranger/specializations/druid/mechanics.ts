import { emitSkillBuff } from '../../../../platform/gw2/scheduler/skill-events.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { resetAutoattackChains } from '../../../../platform/gw2/skills/autoattack-chains.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import type { SimulationEvent } from '../../../../platform/engine/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { applyRangerWeaponSwapTraits } from '../../core/traits.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '../../types.js';
import { druidState } from './state.js';
import { rangerBalanceProfile, rangerBalanceProfileEffect, rangerBalanceValue } from '../../core/profiles.js';
import { DRUID_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

export const DRUID_ASTRAL_FORCE_DAMAGE_TASK = 'ranger.druid-astral-force-damage';

function applyNaturalBalance(context: RangerCastContext | RangerSchedulerContext, duration: number, at: number): void {
  if (!hasTrait(context, TRAIT.NATURAL_BALANCE)) return;
  const effect = rangerBalanceProfileEffect(rangerBalanceProfile(context, PROFILE.naturalBalance), 'buff');
  emitSkillBuff(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.NATURAL_BALANCE,
    actorType: 'effect',
    skillId: TRAIT.NATURAL_BALANCE,
    skillName: 'Natural Balance',
    name: 'Natural Balance',
    kind: String(effect?.kind || 'natural-balance'),
    duration: Number(effect?.duration ?? duration),
    stacks: Number(effect?.stacks ?? 1)
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
  context.emit({
    type: 'sigil_swap',
    at,
    source: 'ranger',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
    // mechanicSwap prevents the sigil engine from treating this as a real weapon-set change
    mechanicSwap: true
  });
  applyRangerWeaponSwapTraits(context, skill, at);
}

export function enterAvatar(context: RangerCastContext, skill: RangerSkill): void {
  const state = druidState.from(context);
  const avatarDuration = rangerBalanceValue(context, PROFILE.resources, 'durationMultiplier', 15);
  state.celestialAvatarActive = true;
  state.celestialAvatarEndsAt = context.start + avatarDuration;
  // Reset so advance() doesn't count force drained before CA activated
  state.astralForceUpdatedAt = context.start;
  // Release Celestial Avatar is a flip skill; storing endsAt lets the UI show it as expiring automatically
  professionCoreState(context).availableFlips[ID.RELEASE_CELESTIAL_AVATAR] = state.celestialAvatarEndsAt;
  // Natural Balance triggers on both entry and exit
  applyNaturalBalance(context, 10, context.start);
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
  // Exhausted (timer or force depleted) zeroes force; manual exit retains half
  state.astralForce = exhausted
    ? 0
    : state.astralForce * rangerBalanceValue(context, PROFILE.resources, 'astralForceRetentionMultiplier', 0.5);
  state.celestialAvatarActive = false;
  state.celestialAvatarEndsAt = 0;
  state.astralForceUpdatedAt = at;
  // Remove the flip so Release Celestial Avatar no longer appears as available
  delete professionCoreState(context).availableFlips[ID.RELEASE_CELESTIAL_AVATAR];
  applyNaturalBalance(context, 10, at);
  // Fallback to catalog lookup when the exit is triggered by the timer (no skill in context)
  const skill =
    transitionSkill || (context.catalog.skillsById.get(ID.RELEASE_CELESTIAL_AVATAR) as RangerSkill | undefined);
  if (skill) emitAvatarWeaponSwap(context, skill, at);
}

export function advanceDruidState(context: RangerSchedulerContext, target: number): void {
  const state = druidState.from(context);
  const maximum = rangerBalanceValue(context, PROFILE.resources, 'maximumStacks', 100);
  const avatarDuration = rangerBalanceValue(context, PROFILE.resources, 'durationMultiplier', 15);
  const naturalMenderInterval = rangerBalanceValue(context, PROFILE.naturalMender, 'pulseInterval', 3);
  const naturalMenderForce = rangerBalanceValue(context, PROFILE.naturalMender, 'resourceGain', 8);
  state.maximumAstralForce = maximum;
  state.astralForce = Math.min(maximum, state.astralForce);
  if (state.astralForceUpdatedAt === 0 && state.naturalMenderReadyAt === 3) {
    state.naturalMenderReadyAt = naturalMenderInterval;
  }

  if (state.celestialAvatarActive) {
    const elapsed = Math.max(0, target - state.astralForceUpdatedAt);
    // Force drains linearly over the full 15s duration regardless of how much was held going in
    state.astralForce = Math.max(0, state.astralForce - elapsed * (state.maximumAstralForce / avatarDuration));
    state.astralForceUpdatedAt = target;
    // Advance Natural Mender clock even during CA so ticks resume at the right time after exit
    if (target >= state.naturalMenderReadyAt - context.epsilon) {
      const skippedApplications =
        Math.floor((target - state.naturalMenderReadyAt + context.epsilon) / naturalMenderInterval) + 1;
      state.naturalMenderReadyAt += skippedApplications * naturalMenderInterval;
    }

    // Either condition terminates CA as exhausted (force zeroed); caller must not double-exit
    if (target >= state.celestialAvatarEndsAt - context.epsilon || state.astralForce <= context.epsilon) {
      leaveAvatar(context, true, target);
    }

    return;
  }

  state.astralForceUpdatedAt = target;
  if (
    !hasTrait(context, TRAIT.NATURAL_MENDER) ||
    state.astralForce >= state.maximumAstralForce ||
    target < state.naturalMenderReadyAt - context.epsilon
  ) {
    return;
  }

  // Catch up any ticks that were skipped if advance() jumped a large interval
  const applications = Math.floor((target - state.naturalMenderReadyAt + context.epsilon) / naturalMenderInterval) + 1;
  state.astralForce = Math.min(state.maximumAstralForce, state.astralForce + applications * naturalMenderForce);
  state.naturalMenderReadyAt += applications * naturalMenderInterval;
}

export function astralForceReadyAt(context: RangerCastContext): number | null {
  const state = druidState.from(context);
  const maximum = rangerBalanceValue(context, PROFILE.resources, 'maximumStacks', 100);
  state.maximumAstralForce = maximum;
  state.astralForce = Math.min(maximum, state.astralForce);
  const naturalMenderForce = rangerBalanceValue(context, PROFILE.naturalMender, 'resourceGain', 8);
  const naturalMenderInterval = rangerBalanceValue(context, PROFILE.naturalMender, 'pulseInterval', 3);
  const naturalMender = hasTrait(context, TRAIT.NATURAL_MENDER);
  if (state.astralForce >= maximum - context.epsilon) return context.start;
  // Without Natural Mender, force only accumulates from damage events; no predictable ready time
  if (!naturalMender) return null;
  const applications = Math.ceil((maximum - state.astralForce) / naturalMenderForce);
  // naturalMenderReadyAt may already be in the past if advance() hasn't run yet; clamp to now
  return Math.max(context.start, state.naturalMenderReadyAt) + (applications - 1) * naturalMenderInterval;
}

export function observeDruidAstralForceEvent(context: RangerSchedulerContext, event: SimulationEvent): void {
  // Only player-sourced hits generate astral force; pet strikes and independent summon hits are excluded
  if (
    event.type !== 'damage' ||
    event.actorType === 'summon' ||
    event.ownerActorType === 'summon' ||
    event.source === 'ranger-pet' ||
    event.independentSummonStrike === true
  ) {
    return;
  }

  // Deferred task so all damage events at the same timestamp are coalesced into one force update
  context.tasks.schedule({
    type: DRUID_ASTRAL_FORCE_DAMAGE_TASK,
    at: event.at,
    priority: 20,
    ownerId: 'ranger.druid-astral-force'
  });
}

export function handleDruidAstralForceDamageTask(context: RangerSchedulerContext): void {
  const state = druidState.from(context);
  // Force doesn't accumulate while CA is active (it's draining instead)
  if (state.celestialAvatarActive) return;
  // Eclipse doubles the astral force gained per hit
  const directDamageForce = rangerBalanceValue(context, PROFILE.resources, 'resourceGain', 0.75);
  const eclipseMultiplier = rangerBalanceValue(context, PROFILE.resources, 'coefficientMultiplier', 2);
  state.maximumAstralForce = rangerBalanceValue(context, PROFILE.resources, 'maximumStacks', 100);
  state.astralForce = Math.min(
    state.maximumAstralForce,
    state.astralForce + directDamageForce * (hasTrait(context, TRAIT.ECLIPSE) ? eclipseMultiplier : 1)
  );
}
