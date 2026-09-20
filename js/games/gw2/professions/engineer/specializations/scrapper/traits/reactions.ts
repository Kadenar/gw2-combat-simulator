import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
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
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

// Deduplicates pulse events: if one is already scheduled at or before `at`, skip.
// massMomentumPulseAt tracks the timestamp of the outstanding pulse so stale ones are ignored.
function scheduleMassMomentumPulse(context: EngineerResolverContext, at: number): void {
  const state = procState(context);
  const scheduledAt = Number(state.massMomentumPulseAt || 0);
  if (scheduledAt > 0 && scheduledAt <= at + EPSILON) return;
  state.massMomentumPulseAt = at;
  context.queue.enqueue({
    type: 'engineer.mass-momentum-pulse',
    at,
    source: 'Trait',
    sourceId: TRAIT.MASS_MOMENTUM,
    actorType: 'effect'
  });
}

// Grants 1 might if stability is active and the 1s ICD has elapsed, then reschedules the pulse.
function triggerMassMomentum(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!hasTrait(context, TRAIT.MASS_MOMENTUM) || activeBoonStacks(context, 'stability', 1, event.at) === 0) return;
  const state = procState(context);
  if (Number(state.massMomentum || 0) <= event.at) {
    state.massMomentum = event.at + balanceProfileValueFromContext(context, PROFILE.massMomentum, 'pulseInterval', 1);
    queueBuff(context, event, {
      name: 'Mass Momentum',
      kind: 'might',
      stacks: 1,
      duration: balanceProfileValue(
        balanceProfileEffectFromContext(context, PROFILE.massMomentum, 'boon'),
        'duration',
        5
      ),
      sourceId: TRAIT.MASS_MOMENTUM,
      actorType: 'effect'
    });
    recordTrait(context, 'Mass Momentum', event);
  }

  scheduleMassMomentumPulse(
    context,
    Math.max(
      event.at + balanceProfileValueFromContext(context, PROFILE.massMomentum, 'pulseInterval', 1),
      Number(state.massMomentum || 0)
    )
  );
}

// Clears the stale pulse sentinel, then re-checks stability to keep the loop alive.
function handleMassMomentumPulse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const state = procState(context);
  if (Math.abs(Number(state.massMomentumPulseAt || 0) - event.at) <= EPSILON) {
    state.massMomentumPulseAt = 0;
  }

  triggerMassMomentum(context, event);
}

// Only real damage hits (coefficient > 0) trigger the pulse; 0-coeff events are skipped.
function reactToScrapperDamage(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (Number(event.coefficient) > 0) triggerMassMomentum(context, event);
}

/** Reacts to might thresholds and stability applications that can start Scrapper trait procs. */
function reactToScrapperBuff(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const kind = String(event.kind || '').toLowerCase();
  // Applied Force (GM trait): reaching 10+ might stacks triggers 3s stability on a 10s ICD.
  if (
    kind === 'might' &&
    hasTrait(context, TRAIT.APPLIED_FORCE) &&
    activeBoonStacks(
      context,
      'might',
      balanceProfileValueFromContext(context, PROFILE.appliedForce, 'maximumStacks', 25),
      event.at
    ) >= balanceProfileValueFromContext(context, PROFILE.appliedForce, 'threshold', 10)
  ) {
    const state = procState(context);
    if (isInternalCooldownReady(event.at, Number(state.appliedForce || 0))) {
      state.appliedForce =
        event.at + balanceProfileValueFromContext(context, PROFILE.appliedForce, 'internalCooldown', 10);
      queueBuff(context, event, {
        name: 'Applied Force',
        kind: 'stability',
        stacks: 1,
        duration: balanceProfileValue(
          balanceProfileEffectFromContext(context, PROFILE.appliedForce, 'boon'),
          'duration',
          3
        ),
        sourceId: TRAIT.APPLIED_FORCE,
        actorType: 'effect'
      });
      recordTrait(context, 'Applied Force', event);
    }
  }

  // Any new stability buff (including the one Applied Force just queued) kicks the pulse loop.
  if (kind === 'stability') triggerMassMomentum(context, event);
}

/** Every surviving combo grants boons once, including finishers created only during resolution. */
function reactToScrapperCombo(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const boons = kineticAcceleratorBoons(context, event);
  if (!boons.length) return;
  for (const boon of boons) queueResolverBoon(context, event, boon);
  recordTrait(context, 'Kinetic Accelerators', event);
}

export const scrapperResolverEventHandlers = Object.freeze({
  'engineer.mass-momentum-pulse': handleMassMomentumPulse
});

export const scrapperResolverEventReactions = Object.freeze({
  damage: reactToScrapperDamage,
  buff: reactToScrapperBuff,
  combo: reactToScrapperCombo
});
