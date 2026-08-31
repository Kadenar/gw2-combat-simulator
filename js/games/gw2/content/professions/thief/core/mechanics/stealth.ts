import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import type {
  ThiefCastContext,
  ThiefCoreState,
  ThiefPrecastContext,
  ThiefSkill,
  ThiefStealthAttackChargeState
} from '#gw2/content/professions/thief/types.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';

/** Removes active stealth, applies Revealed, and fires traits shared by every attack that breaks stealth. */
function breakThiefStealth(context: ThiefPrecastContext, skill: ThiefSkill, reason: string): boolean {
  const state = professionCoreState(context);
  const stealthed = state.stealthUntil > context.start && state.revealedUntil <= context.start;
  if (!stealthed) return false;
  if (hasTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
    gainThiefInitiative(
      context,
      Number(balanceProfileFromContext(context, PROFILE.shadowsRejuvenation)?.resourceGain || 1),
      context.start,
      'leave-stealth'
    );
  }

  if (hasTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    const profile = balanceProfileFromContext(context, PROFILE.leechingVenoms);
    state.spiderVenomCharges = Math.min(
      Number(profile?.maximumStacks || 6),
      Number(state.spiderVenomCharges || 0) + Number(profile?.resourceGain || 3)
    );
    state.spiderVenomExpiresAt = context.start + Number(profile?.durationMultiplier || 24);
    state.spiderVenomGeneration += 1;
  }

  state.stealthUntil = context.start;
  if (!skill.preservesStealth) state.revealedUntil = context.start + 3;
  emitStateSnapshot(context, 'thief', context.start, reason, snapshotThiefState(context.state.profession));
  return true;
}

/** Breaks stealth when a non-stealth skill activates at least one authored strike. */
export function breakStealthOnStrike(context: ThiefPrecastContext, skill: ThiefSkill): void {
  if (!skill.stealthAttack && skill.effects?.some((effect) => effect.type === 'strike')) {
    breakThiefStealth(context, skill, 'strike-broke-stealth');
  }
}

// Consume either active stealth or a specialization-granted attack charge, then
// apply leave-stealth traits and Revealed from one cast-start transition.
export function beginStealthAttack(context: ThiefPrecastContext, skill: ThiefSkill): void {
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

  if (breakThiefStealth(context, skill, 'stealth-attack')) return;
  state.stealthUntil = context.start;
  if (!skill.preservesStealth) state.revealedUntil = context.start + 3;

  emitStateSnapshot(context, 'thief', context.start, 'stealth-attack', snapshotThiefState(context.state.profession));
}

export function completeStealthAttack(context: ThiefCastContext, _skill: ThiefSkill): void {
  const at = context.effectiveEnd;
  if (hasTrait(context.config, TRAIT.SUNDERING_SHADE)) {
    const vulnerability = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.sunderingShade), 'condition');
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
