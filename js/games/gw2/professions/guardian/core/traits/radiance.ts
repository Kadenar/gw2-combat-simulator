import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import {
  guardianResolverEpsilon,
  guardianResolverState,
  queueGuardianResolverBuff,
  recordGuardianTraitProc
} from '#gw2/professions/guardian/core/traits/shared.js';
import type { GuardianResolverContext, GuardianResolverEvent } from '#gw2/professions/guardian/types.js';

/** Owns Righteous Instincts' Resolution window and recurring Might tick behavior. */
function queueRighteousMight(context: GuardianResolverContext, at: number, detail: string): void {
  const might = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.righteousInstincts), 'boon');
  queueGuardianResolverBuff(context, {
    at,
    sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    skillName: 'Righteous Instincts',
    kind: 'might',
    duration: Number(might?.duration || 6),
    stacks: Number(might?.stacks || 1)
  });
  recordGuardianTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    'Righteous Instincts',
    at,
    'Resolution',
    detail
  );
}

// React to self Resolution with Righteous Instincts state, scheduling future
// Might ticks only for the newly established active window.
export function reactToRighteousInstincts(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  if (
    String(event.kind || '').toLowerCase() !== 'resolution' ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS)
  ) {
    return;
  }

  const state = guardianResolverState(context);
  const duration = Math.max(0, Number(event.duration || 0));
  const wasActive = event.at < Number(state.resolutionUntil || 0) - guardianResolverEpsilon(context);
  state.resolutionUntil = wasActive ? state.resolutionUntil + duration : event.at + duration;
  if (!wasActive) {
    queueRighteousMight(context, event.at, 'Resolution applied');
    state.righteousNextMightAt =
      event.at + Number(balanceProfileFromContext(context, PROFILE.righteousInstincts)?.pulseInterval || 1);
    enqueueOrdered(context.queue, {
      type: 'guardian.righteous-instincts-tick',
      at: state.righteousNextMightAt,
      priority: -10,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
      actorType: 'effect'
    });
  }
}

// Emit a scheduled Righteous Instincts Might tick only while its originating
// Resolution window remains current and active.
export function handleRighteousInstinctsTick(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = guardianResolverState(context);
  if (
    !hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS) ||
    event.at > Number(state.resolutionUntil || 0) + guardianResolverEpsilon(context) ||
    Math.abs(event.at - Number(state.righteousNextMightAt || 0)) > guardianResolverEpsilon(context)
  ) {
    return;
  }

  queueRighteousMight(context, event.at, 'Resolution interval');
  state.righteousNextMightAt =
    event.at + Number(balanceProfileFromContext(context, PROFILE.righteousInstincts)?.pulseInterval || 1);
  if (state.righteousNextMightAt <= Number(state.resolutionUntil || 0) + guardianResolverEpsilon(context)) {
    enqueueOrdered(context.queue, {
      ...event,
      at: state.righteousNextMightAt
    });
  }
}
