import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { activeBoonStacks, procState, queueBuff, recordTrait } from '../../core/shared.js';
import { engineerBalanceEffectValue, engineerBalanceValue } from '../../core/profiles.js';
import { SCRAPPER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { scrapperState } from './state.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '../../types.js';

// Deduplicates pulse events: if one is already scheduled at or before `at`, skip.
// massMomentumPulseAt tracks the timestamp of the outstanding pulse so stale ones are ignored.
function scheduleMassMomentumPulse(context: EngineerResolverContext, at: number): void {
  const state = procState(context);
  const scheduledAt = Number(state.massMomentumPulseAt || 0);
  if (scheduledAt > 0 && scheduledAt <= at + 1e-9) return;
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
    state.massMomentum = event.at + engineerBalanceValue(context, PROFILE.massMomentum, 'pulseInterval', 1);
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
      event.at + engineerBalanceValue(context, PROFILE.massMomentum, 'pulseInterval', 1),
      Number(state.massMomentum || 0)
    )
  );
}

// Clears the stale pulse sentinel, then re-checks stability to keep the loop alive.
function handleMassMomentumPulse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const state = procState(context);
  if (Math.abs(Number(state.massMomentumPulseAt || 0) - event.at) <= 1e-9) {
    state.massMomentumPulseAt = 0;
  }

  triggerMassMomentum(context, event);
}

// Only real damage hits (coefficient > 0) trigger the pulse; 0-coeff events are skipped.
function reactToScrapperDamage(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (Number(event.coefficient) > 0) triggerMassMomentum(context, event);
}

function reactToScrapperBuff(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const kind = String(event.kind || '').toLowerCase();
  // Applied Force (GM trait): reaching 10+ might stacks triggers 3s stability on a 10s ICD.
  if (
    kind === 'might' &&
    hasTrait(context, TRAIT.APPLIED_FORCE) &&
    activeBoonStacks(
      context,
      'might',
      engineerBalanceValue(context, PROFILE.appliedForce, 'maximumStacks', 25),
      event.at
    ) >= engineerBalanceValue(context, PROFILE.appliedForce, 'threshold', 10)
  ) {
    const state = procState(context);
    if (isInternalCooldownReady(event.at, Number(state.appliedForce || 0))) {
      state.appliedForce = event.at + engineerBalanceValue(context, PROFILE.appliedForce, 'internalCooldown', 10);
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
      event.at + engineerBalanceValue(context, PROFILE.kineticAccelerators, 'internalCooldown', 3);
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
