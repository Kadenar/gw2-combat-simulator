import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { emitStateSnapshot } from '../../../platform/engine/events/state-snapshots.js';
import { emitSkillCondition } from '../../../platform/gw2/scheduler/skill-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { snapshotThiefState } from './state.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { gainThiefInitiative } from './shared.js';
import type { ThiefCastContext, ThiefCoreState, ThiefSkill, ThiefStealthAttackChargeState } from '../types.js';
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE
} from './profiles.js';

// Consume either active stealth or a specialization-granted attack charge, then
// apply leave-stealth traits and Revealed from one cast-start transition.
export function beginStealthAttack(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const specialization = context.state.profession.specialization;
  const specializationState = specialization.state as Partial<ThiefStealthAttackChargeState>;
  const stealthAttackState: Partial<ThiefStealthAttackChargeState> = Object.hasOwn(
    specializationState,
    'stealthAttackCharges'
  )
    ? specializationState
    : (state as ThiefCoreState & Partial<ThiefStealthAttackChargeState>);
  const stealthed = state.stealthUntil > context.start && state.revealedUntil <= context.start;

  if (
    !stealthed &&
    Number(stealthAttackState.stealthAttackCharges || 0) > 0 &&
    Number(stealthAttackState.stealthAttackExpiresAt || 0) > context.start
  ) {
    stealthAttackState.stealthAttackCharges = Number(stealthAttackState.stealthAttackCharges || 0) - 1;
  }

  if (stealthed && hasTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
    gainThiefInitiative(
      context,
      Number(thiefBalanceProfile(context, PROFILE.shadowsRejuvenation)?.resourceGain || 1),
      context.start,
      'leave-stealth'
    );
  }

  if (stealthed && hasTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    const profile = thiefBalanceProfile(context, PROFILE.leechingVenoms);
    state.spiderVenomCharges = Math.min(
      Number(profile?.maximumStacks || 6),
      Number(state.spiderVenomCharges || 0) + Number(profile?.resourceGain || 3)
    );
    state.spiderVenomExpiresAt = context.start + Number(profile?.durationMultiplier || 24);
    state.spiderVenomGeneration += 1;
  }

  state.stealthUntil = context.start;

  if (!skill?.preservesStealth) {
    state.revealedUntil = context.start + 3;
  }

  emitStateSnapshot(context, 'thief', context.start, 'stealth-attack', snapshotThiefState(context.state.profession));
}

export function completeStealthAttack(context: ThiefCastContext, _skill: ThiefSkill): void {
  const at = context.effectiveEnd;

  if (hasTrait(context.config, TRAIT.SUNDERING_SHADE)) {
    const vulnerability = thiefBalanceProfileEffect(thiefBalanceProfile(context, PROFILE.sunderingShade), 'condition');
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      actorType: 'player',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      condition: String(vulnerability?.condition || 'Vulnerability'),
      duration: Number(vulnerability?.duration || 5),
      stacks: Number(vulnerability?.stacks || 10),
      sourceId: TRAIT.SUNDERING_SHADE,
      name: 'Sundering Shade — Vulnerability'
    });
  }
}
