import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { addVenomCharges } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/professions/thief/core/mechanics/resource-events.js';
import type {
  ThiefCastContext,
  ThiefPrecastContext,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill,
  ThiefStealthAttackChargeState
} from '#gw2/professions/thief/types.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';

/** Reads optional attack charges from the active specialization without borrowing Core fields. */
export function thiefStealthAttackChargeState(context: ThiefSchedulerContext): Partial<ThiefStealthAttackChargeState> {
  return context.state.profession.specialization.state as Partial<ThiefStealthAttackChargeState>;
}

const THIEF_BREAK_STEALTH_TASK = 'thief.break-stealth-on-strike';

interface BreakStealthTaskPayload {
  readonly skillId: ThiefSkill['id'];
  readonly strikeAt: number;
}

/** Removes active stealth, applies Revealed, and fires traits shared by every attack that breaks stealth. */
function breakThiefStealth(
  context: ThiefSchedulerContext,
  skill: ThiefSkill,
  at: number,
  reason: string,
  snapshotPriority?: number
): boolean {
  const state = professionCoreState(context);
  const stealthed = state.stealthStartedAt <= at && state.stealthUntil > at && state.revealedUntil <= at;
  if (!stealthed) return false;
  if (hasTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
    const shadowsRejuvenationProfile = requireBalanceProfileFromContext(context, PROFILE.shadowsRejuvenation);
    gainThiefInitiative(context, balanceProfileNumber(shadowsRejuvenationProfile, 'resourceGain'), at, 'leave-stealth');
  }

  if (hasTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    const leechingVenomsProfile = requireBalanceProfileFromContext(context, PROFILE.leechingVenoms);
    addVenomCharges(
      state,
      ID.SPIDER_VENOM,
      at,
      balanceProfileNumber(leechingVenomsProfile, 'resourceGain'),
      balanceProfileNumber(leechingVenomsProfile, 'durationMultiplier'),
      balanceProfileNumber(leechingVenomsProfile, 'maximumStacks')
    );
  }

  state.stealthStartedAt = at;
  state.stealthUntil = at;
  const hiddenKillerProfile = requireBalanceProfileFromContext(context, TRAIT.HIDDEN_KILLER);
  // Only a real stealth exit starts the linger; bonus attack charges do not.
  state.hiddenKillerUntil = at + balanceProfileNumber(hiddenKillerProfile, 'duration');
  if (!skill.preservesStealth) state.revealedUntil = at + 3;
  const snapshot = emitThiefStateSnapshot(context, at, reason);
  if (snapshot && snapshotPriority != null) context.replaceEvent(snapshot, { priority: snapshotPriority });
  return true;
}

/** Defers stealth loss to an ordered task at each player strike's authored damage timestamp. */
export const stealthBreakingReaction = scheduledReaction<
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  BreakStealthTaskPayload
>({
  id: THIEF_BREAK_STEALTH_TASK,
  order: 20,
  select(context, event) {
    if (event.type !== 'damage' || event.cancelled === true || event.actorType !== 'player') return null;
    const skill = event.skillId == null ? null : context.catalog.skillsById.get(event.skillId);
    // Damage-and-stealth skills resolve their own strike before granting stealth, so they cannot cancel that grant.
    const grantsStealth = skill?.effects?.some((effect) => effect.type === 'buff' && effect.kind === 'stealth');
    if (!skill || skill.stealthAttack || grantsStealth) return null;

    // Same-time damage-derived work settles before the stealth transition without manufacturing elapsed time.
    return {
      at: event.at,
      priority: 20,
      ownerId: event.activationId,
      payload: { skillId: skill.id, strikeAt: event.at }
    };
  },
  execute(context, _taskAt, payload) {
    const skill = context.catalog.skillsById.get(payload.skillId);
    if (skill && !skill.stealthAttack) {
      // The snapshot sorts after a same-time action even though scheduler state is ready for its availability check.
      breakThiefStealth(context, skill, payload.strikeAt, 'strike-broke-stealth', 5);
    }
  }
});

// Consume either active stealth or a specialization-granted attack charge, then
// apply leave-stealth traits and Revealed from one cast-start transition.
export function beginStealthAttack(context: ThiefPrecastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const stealthAttackState = thiefStealthAttackChargeState(context);
  const stealthed =
    state.stealthStartedAt <= context.start &&
    state.stealthUntil > context.start &&
    state.revealedUntil <= context.start;
  if (
    !stealthed &&
    Number(stealthAttackState.stealthAttackCharges || 0) > 0 &&
    Number(stealthAttackState.stealthAttackExpiresAt || 0) > context.start
  ) {
    stealthAttackState.stealthAttackCharges = Number(stealthAttackState.stealthAttackCharges || 0) - 1;
  }

  if (breakThiefStealth(context, skill, context.start, 'stealth-attack')) return;
  state.stealthStartedAt = context.start;
  state.stealthUntil = context.start;
  if (!skill.preservesStealth) state.revealedUntil = context.start + 3;

  emitThiefStateSnapshot(context, context.start, 'stealth-attack');
}

export function completeStealthAttack(context: ThiefCastContext, _skill: ThiefSkill): void {
  const at = context.effectiveEnd;
  if (hasTrait(context.config, TRAIT.SUNDERING_SHADE)) {
    const sunderingShadeProfile = requireBalanceProfileFromContext(context, PROFILE.sunderingShade);
    const vulnerability = requireEffect(sunderingShadeProfile, 'condition', 'Vulnerability');
    // Explicit removal suppresses this packet without restoring baseline tuning.
    if (!vulnerability) return;
    emitSkillCondition(context, {
      at,
      source: 'Trait',
      skillId: context.skill?.id ?? null,
      skillName: context.skill?.name ?? null,
      condition: String(vulnerability.condition),
      duration: effectNumber(sunderingShadeProfile, vulnerability, 'duration'),
      stacks: effectNumber(sunderingShadeProfile, vulnerability, 'stacks'),
      sourceId: TRAIT.SUNDERING_SHADE,
      name: 'Sundering Shade — Vulnerability'
    });
  }
}
