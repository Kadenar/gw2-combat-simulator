import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import {
  activeBoonStacks,
  procState,
  queueBuff,
  recordTrait
} from '#gw2/content/professions/engineer/core/mechanics/state-helpers.js';
import { engineerBalanceEffectValue } from '#gw2/content/professions/engineer/core/profiles.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/engineer/specializations/scrapper/profiles.js';
import { scrapperState } from '#gw2/content/professions/engineer/specializations/scrapper/state.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/content/professions/engineer/types.js';

// Deduplicates pulse events: if one is already scheduled at or before `at`, skip.
// massMomentumPulseAt tracks the timestamp of the outstanding pulse so stale ones are ignored.
function scheduleMassMomentumPulse(context: EngineerResolverContext, at: number): void {
  const state = procState(context);
  const scheduledAt = Number(state.massMomentumPulseAt || 0);
  if (scheduledAt > 0 && scheduledAt <= at + EPSILON) return;
  state.massMomentumPulseAt = at;
  enqueueOrdered(context.queue, {
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
      duration: engineerBalanceEffectValue(context, PROFILE.massMomentum, 'boon', 'duration', 5),
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
        duration: engineerBalanceEffectValue(context, PROFILE.appliedForce, 'boon', 'duration', 3),
        sourceId: TRAIT.APPLIED_FORCE,
        actorType: 'effect'
      });
      recordTrait(context, 'Applied Force', event);
    }
  }

  // Any new stability buff (including the one Applied Force just queued) kicks the pulse loop.
  if (kind === 'stability') triggerMassMomentum(context, event);
}

/** Confirms Kinetic Accelerators combo procs and advances the resolver's whirl-only cooldown. */
function reactToScrapperCombo(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.KINETIC_ACCELERATORS) ||
    !['Blast', 'Leap', 'Whirl'].includes(String(event.finisherType))
  ) {
    return;
  }

  const state = scrapperState.from(context);
  if (event.finisherType === 'Whirl') {
    if (!isInternalCooldownReady(event.at, state.kineticAcceleratorsWhirlReadyAt)) return;
    state.kineticAcceleratorsWhirlReadyAt =
      event.at + balanceProfileValueFromContext(context, PROFILE.kineticAccelerators, 'internalCooldown', 3);
  }

  // Boons are emitted by the scheduler's resolved-combo prediction so they
  // remain visible in the canonical result timeline. Resolver confirmation
  // owns only proc attribution and its independent whirl ICD state.
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
