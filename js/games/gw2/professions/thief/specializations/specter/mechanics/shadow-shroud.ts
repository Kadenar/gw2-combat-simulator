import { resourceDepletion } from '#gw2/platform/profession-definition/mechanics.js';
import { advanceResourceClock, setResourceRate } from '#gw2/platform/combat/resources/clock.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitThiefShroudSwap } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import { emitTransitionLockout } from '#gw2/platform/skills/transition-delays.js';

import { completeStealWithStoredSkills } from '#gw2/professions/thief/core/mechanics/steal.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import type { ThiefCastContext, ThiefSchedulerContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/thief/core/profiles.js';

export const SHADOW_SHROUD_DEPLETION_TASK = 'thief.shadow-shroud-depleted';

/** Gains replace the shared zero-crossing deadline; exiting retires its lifetime. */
export const shadowDepletion = resourceDepletion({
  id: SHADOW_SHROUD_DEPLETION_TASK,
  priority: -10,
  clock: (context: ThiefSchedulerContext) => specterState.from(context).shadowClock,
  depleted(context: ThiefSchedulerContext, at: number) {
    const state = specterState.from(context);
    if (!state.shadowShroudActive) return;
    state.shadowClock.value = 0;
    state.shadowClock.rate = 0;
    emitTransitionLockout(context, 'shroudExitMs', at);
    state.shadowShroudActive = false;
    emitThiefShroudSwap(context, { id: SHADOW_SHROUD_DEPLETION_TASK, name: 'Exit Shadow Shroud' }, at);
    emitThiefStateSnapshot(context, at, 'shadow-shroud-depleted');
  }
});

/** Advance before applying a gain and immediately replace the active drain boundary. */
export function gainShadowForce(context: ThiefSchedulerContext, amount: number): void {
  const state = specterState.from(context);
  advanceResourceClock(state.shadowClock, context.state.time);
  state.shadowClock.value = Math.min(state.shadowClock.maximum, state.shadowClock.value + amount);
  if (state.shadowShroudActive) shadowDepletion.refresh(context);
}

export function completeSiphon(context: ThiefCastContext): void {
  // Cancellation preserves shadow force and stored-skill state.
  if (context.action?.cancelled === true) return;

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  // Amplified Siphoning adds percentage points of maximum force to Siphon's base gain.
  let gain =
    balanceProfileNumber(resourcesProfile, 'lifeForceGain') +
    (hasTrait(context.config, TRAIT.AMPLIFIED_SIPHONING)
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.amplifiedSiphoning), 'resourceGain')
      : 0);
  // Improvisation increases the full Siphon gain, including Amplified Siphoning's bonus.
  if (hasTrait(context.config, TRAIT.IMPROVISATION)) {
    const improvisationProfile = requireBalanceProfileFromContext(context, CORE_PROFILE.improvisation);
    gain *= 1 + balanceProfileNumber(improvisationProfile, 'lifeForceGain');
  }

  gainShadowForce(context, gain);
  // Siphon is a profession skill, not a steal; null clears any stored stolen skill.
  completeStealWithStoredSkills(context, []);
}

export function enterShadowShroud(context: ThiefCastContext, skill: ThiefSkill): void {
  emitTransitionLockout(context, 'shroudEntryMs', context.effectiveEnd, skill);
  const state = specterState.from(context);
  const at = context.effectiveEnd;

  const enterShadowShroudProfile = requireBalanceProfileFromContext(context, PROFILE.enterShadowShroud);
  const barrier = requireEffect(enterShadowShroudProfile, 'buff', 'barrier');
  state.shadowShroudActive = true;
  // Manual exit waits half a second; depletion continues to force an immediate exit.
  state.shadowShroudExitReadyAt = at + 0.5;
  state.shadowClock.updatedAt = at;
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  setResourceRate(
    state.shadowClock,
    at,
    -state.shadowClock.maximum * balanceProfileNumber(resourcesProfile, 'lifeForceDrain')
  );
  shadowDepletion.refresh(context);
  // Enter Shadow Shroud barriers one tethered ally, not the caster or whole party.
  const alliedRecipients = Math.min(
    balanceProfileNumber(enterShadowShroudProfile, 'maximumTargets'),
    gw2AlliedPlayerAssumptions(context.config).count
  );
  // Removing barrier suppresses its reaction while shroud entry and drain still occur.
  if (barrier && alliedRecipients > 0) {
    emitSkillBuff(context, {
      at,
      source: 'thief',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Enter Shadow Shroud - Barrier',
      kind: 'barrier',
      duration: effectNumber(enterShadowShroudProfile, barrier, 'duration'),
      stacks: effectNumber(enterShadowShroudProfile, barrier, 'stacks'),
      audience: { recipients: 'party' as const, affectsSelf: false, maximumRecipients: alliedRecipients }
    });
    context.tasks.schedule({
      type: 'thief.specter-dark-sentry',
      at,
      payload: { allyIndices: [1] }
    });
  }

  emitThiefShroudSwap(context, skill, at);
  emitThiefStateSnapshot(context, at, 'enter-shadow-shroud');
}

export function exitShadowShroud(context: ThiefCastContext, skill: ThiefSkill): void {
  emitTransitionLockout(context, 'shroudExitMs', context.effectiveEnd, skill);
  const at = context.effectiveEnd;
  specterState.from(context).shadowShroudActive = false;
  shadowDepletion.stop(context);
  setResourceRate(specterState.from(context).shadowClock, at, 0);
  emitThiefShroudSwap(context, skill, at);
  emitThiefStateSnapshot(context, at, 'exit-shadow-shroud');
}

// Specter converts spent initiative into shadow force instead of consuming it for damage.
// The core thief handler still deducts initiative; this is a parallel gain on top of that.
export function spendSpecterResources(context: ThiefCastContext, skill: ThiefSkill): void {
  const cost = Number(skill.initiativeCost || 0);
  if (!(cost > 0)) return;

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  gainShadowForce(context, cost * balanceProfileNumber(resourcesProfile, 'resourceGain'));
  // Emit at cast start so the resource timeline reflects the gain immediately.
  emitThiefStateSnapshot(context, context.start, 'shadow-force');
}

export function advanceSpecterResources(context: ThiefSchedulerContext, target: number): void {
  const state = specterState.from(context);

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  state.shadowClock.maximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  state.shadowClock.value = Math.min(state.shadowClock.maximum, state.shadowClock.value);
  advanceResourceClock(state.shadowClock, target);
  emitThiefStateSnapshot(context, target, 'resources');
}
