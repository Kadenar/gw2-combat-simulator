import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  activeBoonStacks,
  procState,
  queueBuff,
  recordTrait
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import { kineticAcceleratorBoons } from '#gw2/professions/engineer/specializations/scrapper/traits/kinetic-accelerators.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import type { EngineerRuntime, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

// Grants 1 might if stability is active and the 1s ICD has elapsed, then reschedules the pulse.
export function triggerMassMomentum(context: EngineerRuntime, event: EngineerResolverEvent): void | false {
  if (!hasTrait(context, TRAIT.MASS_MOMENTUM) || activeBoonStacks(context, 'stability', 1, event.at) === 0)
    return false;
  const state = procState(context);
  const massMomentumProfile = requireBalanceProfileFromContext(context, PROFILE.massMomentum);
  if (Number(state.massMomentum || 0) <= event.at) {
    state.massMomentum = event.at + balanceProfileNumber(massMomentumProfile, 'pulseInterval');
    const massMomentumMight = requireEffect(massMomentumProfile, 'boon', 'might');
    if (massMomentumMight) {
      queueBuff(context, event, {
        name: 'Mass Momentum',
        kind: String(massMomentumMight.boon).toLowerCase(),
        stacks: Number(massMomentumMight.stacks),
        duration: Number(massMomentumMight.duration),
        sourceId: TRAIT.MASS_MOMENTUM,
        actorType: 'effect'
      });

      recordTrait(context, 'Mass Momentum', event);
    }
  }

  const interval = balanceProfileNumber(massMomentumProfile, 'pulseInterval');
  const next = Math.max(event.at + interval, Number(state.massMomentum || 0));
  const live = scrapperState.from(context);
  if (interval > 0 && live.massMomentumAt > next) {
    live.massMomentumAt = next;
    context.schedule('engineer.mass-momentum', next, event);
  }
}

// Only real damage hits (coefficient > 0) trigger the pulse; 0-coeff events are skipped.
function reactToScrapperDamage(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (Number(event.coefficient) > 0) triggerMassMomentum(context, event);
}

/** Reacts to might thresholds and stability applications that can start Scrapper trait procs. */
function reactToScrapperBuff(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const kind = String(event.kind || '').toLowerCase();
  // Applied Force (GM trait): reaching 10+ might stacks triggers 3s stability on a 10s ICD.
  if (
    kind === 'might' &&
    hasTrait(context, TRAIT.APPLIED_FORCE) &&
    activeBoonStacks(
      context,
      'might',
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.appliedForce), 'maximumStacks'),
      event.at
    ) >= balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.appliedForce), 'threshold')
  ) {
    const state = procState(context);
    if (isInternalCooldownReady(event.at, Number(state.appliedForce || 0))) {
      const appliedForceProfile = requireBalanceProfileFromContext(context, PROFILE.appliedForce);
      state.appliedForce = event.at + balanceProfileNumber(appliedForceProfile, 'internalCooldown');
      const appliedForceStability = requireEffect(appliedForceProfile, 'boon', 'stability');
      if (appliedForceStability) {
        queueBuff(context, event, {
          name: 'Applied Force',
          kind: String(appliedForceStability.boon).toLowerCase(),
          stacks: Number(appliedForceStability.stacks),
          duration: Number(appliedForceStability.duration),
          sourceId: TRAIT.APPLIED_FORCE,
          actorType: 'effect'
        });

        recordTrait(context, 'Applied Force', event);
      }
    }
  }

  // Any new stability buff (including the one Applied Force just queued) kicks the pulse loop.
  if (kind === 'stability') triggerMassMomentum(context, event);
}

/** Every surviving combo grants boons once, including finishers created only during resolution. */
function reactToScrapperCombo(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const boons = kineticAcceleratorBoons(context, event);
  if (!boons.length) return;
  for (const boon of boons) queueResolverBoon(context, event, boon);
  recordTrait(context, 'Kinetic Accelerators', event);
}

export const scrapperResolverEventReactions = Object.freeze({
  damage: reactToScrapperDamage,
  buff: reactToScrapperBuff,
  combo: reactToScrapperCombo
});
