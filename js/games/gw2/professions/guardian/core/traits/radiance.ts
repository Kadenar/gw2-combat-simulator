import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import {
  guardianResolverState,
  queueGuardianResolverBuff,
  recordGuardianTraitProc
} from '#gw2/professions/guardian/core/traits/shared.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

// Committed heal skills grant self Resolution, sharing one cooldown across all heal activations.
export function applyHealersResolution(context: GuardianCastContext, skill: GuardianSkill, at: number): void {
  if (skill.type !== 'Heal' || !hasTrait(context, GUARDIAN_TRAIT_IDS.HEALERS_RESOLUTION)) return;
  const state = professionCoreState(context);
  if (!isInternalCooldownReady(at, state.healersResolutionReadyAt)) return;

  const profile = balanceProfileFromContext(context, PROFILE.healersResolution);
  const resolution = balanceProfileEffect(profile, 'boon');
  state.healersResolutionReadyAt = at + Number(profile?.internalCooldown ?? 20);
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.HEALERS_RESOLUTION,
    name: "Healer's Resolution",
    kind: 'resolution',
    duration: Number(resolution?.duration ?? 8),
    stacks: 1
  });
}

/** Owns Righteous Instincts' Resolution window and recurring Might tick behavior. */
function queueRighteousMight(context: GuardianResolverContext, at: number, detail: string): void {
  const might = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.righteousInstincts), 'boon');
  queueGuardianResolverBuff(context, {
    at,
    sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    skillName: 'Righteous Instincts',
    kind: 'might',
    duration: Number(might?.duration ?? 6),
    stacks: Number(might?.stacks ?? 1)
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
    event.resolvedAudience?.includesSelf !== true ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS)
  ) {
    return;
  }

  const state = guardianResolverState(context);
  const duration = Math.max(0, Number(event.duration || 0));
  const wasActive = event.at < Number(state.resolutionUntil || 0) - EPSILON;
  state.resolutionUntil = wasActive ? state.resolutionUntil + duration : event.at + duration;
  if (!wasActive) {
    queueRighteousMight(context, event.at, 'Resolution applied');
    // Zero disables subsequent interval procs while retaining the initial application.
    const interval = Number(balanceProfileFromContext(context, PROFILE.righteousInstincts)?.pulseInterval ?? 1);
    if (!(interval > 0)) return;
    state.righteousNextMightAt = event.at + interval;
    context.queue.enqueue({
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
    event.at >= Number(state.resolutionUntil || 0) - EPSILON ||
    Math.abs(event.at - Number(state.righteousNextMightAt || 0)) > EPSILON
  ) {
    return;
  }

  queueRighteousMight(context, event.at, 'Resolution interval');
  state.righteousNextMightAt =
    event.at + Number(balanceProfileFromContext(context, PROFILE.righteousInstincts)?.pulseInterval ?? 1);
  // Queue one candidate tick ahead so future Resolution applications can extend the active window before it fires.
  if (state.righteousNextMightAt > event.at && state.righteousNextMightAt <= context.horizon + EPSILON) {
    context.queue.enqueue({
      ...event,
      at: state.righteousNextMightAt
    });
  }
}
