import { resolverTimedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
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

  const healersResolutionProfile = requireBalanceProfileFromContext(context, PROFILE.healersResolution);
  const resolution = requireEffect(healersResolutionProfile, 'boon', 'resolution');
  if (!resolution) return;
  state.healersResolutionReadyAt = at + balanceProfileNumber(healersResolutionProfile, 'internalCooldown');
  emitSkillBuff(context, skill, {
    at,
    source: 'guardian',
    sourceId: GUARDIAN_TRAIT_IDS.HEALERS_RESOLUTION,
    name: "Healer's Resolution",
    kind: 'resolution',
    duration: effectNumber(healersResolutionProfile, resolution, 'duration'),
    stacks: effectNumber(healersResolutionProfile, resolution, 'stacks')
  });
}

/** Owns Righteous Instincts' Resolution window and recurring Might tick behavior. */
function queueRighteousMight(context: GuardianResolverContext, at: number, detail: string): boolean {
  const righteousInstinctsProfile = requireBalanceProfileFromContext(context, PROFILE.righteousInstincts);
  const might = requireEffect(righteousInstinctsProfile, 'boon', 'might');
  if (!might) return false;
  queueGuardianResolverBuff(context, {
    at,
    sourceId: GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    skillName: 'Righteous Instincts',
    kind: 'might',
    duration: effectNumber(righteousInstinctsProfile, might, 'duration'),
    stacks: effectNumber(righteousInstinctsProfile, might, 'stacks')
  });
  recordGuardianTraitProc(
    context,
    GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS,
    'Righteous Instincts',
    at,
    'Resolution',
    detail
  );
  return true;
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
  // Duration stacking follows the same expiry tick as the self Resolution boon.
  const wasActive = event.at < Number(state.resolutionUntil || 0);
  state.resolutionUntil = gw2EffectExpiresAt(wasActive ? state.resolutionUntil : event.at, duration);
  if (!wasActive) {
    if (!queueRighteousMight(context, event.at, 'Resolution applied')) return;
    const righteousInstinctsProfile = requireBalanceProfileFromContext(context, PROFILE.righteousInstincts);
    // Zero disables subsequent interval procs while retaining the initial application.
    const interval = balanceProfileNumber(righteousInstinctsProfile, 'pulseInterval');
    if (!(interval > 0)) return;
    righteousInstincts.start(context, { key: 'resolution', at: event.at + interval, captured: {} });
  }
}

// Emit a scheduled Righteous Instincts Might tick only while its originating
// Resolution window remains current and active.
export const righteousInstincts = resolverTimedEffect<GuardianResolverContext, object>({
  id: 'guardian.righteous-instincts-tick',
  priority: -10,
  interval: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.righteousInstincts), 'pulseInterval'),
  effectsAt(context, at) {
    if (
      !hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS) ||
      at >= Number(guardianResolverState(context).resolutionUntil || 0)
    )
      return false;
    if (!queueRighteousMight(context, at, 'Resolution interval')) return false;
  }
});
