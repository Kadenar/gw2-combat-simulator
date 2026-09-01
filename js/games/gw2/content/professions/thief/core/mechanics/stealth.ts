import { emitThiefStateSnapshot } from '#gw2/content/professions/thief/state.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gainThiefInitiative } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import type {
  ThiefCastContext,
  ThiefCoreState,
  ThiefPrecastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill,
  ThiefStealthAttackChargeState
} from '#gw2/content/professions/thief/types.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';

export const THIEF_BREAK_STEALTH_TASK = 'thief.break-stealth-on-strike';

interface BreakStealthTaskPayload extends Record<string, unknown> {
  readonly skillId: number;
  readonly strikeAt: number;
}

/** Removes active stealth, applies Revealed, and fires traits shared by every attack that breaks stealth. */
function breakThiefStealth(context: ThiefSchedulerContext, skill: ThiefSkill, at: number, reason: string): boolean {
  const state = professionCoreState(context);
  const stealthed = state.stealthStartedAt <= at && state.stealthUntil > at && state.revealedUntil <= at;
  if (!stealthed) return false;
  if (hasTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
    gainThiefInitiative(
      context,
      Number(balanceProfileFromContext(context, PROFILE.shadowsRejuvenation)?.resourceGain || 1),
      at,
      'leave-stealth'
    );
  }

  if (hasTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    const profile = balanceProfileFromContext(context, PROFILE.leechingVenoms);
    state.spiderVenomCharges = Math.min(
      Number(profile?.maximumStacks || 6),
      Number(state.spiderVenomCharges || 0) + Number(profile?.resourceGain || 3)
    );
    state.spiderVenomExpiresAt = at + Number(profile?.durationMultiplier || 24);
    state.spiderVenomGeneration += 1;
  }

  state.stealthStartedAt = at;
  state.stealthUntil = at;
  if (!skill.preservesStealth) state.revealedUntil = at + 3;
  emitThiefStateSnapshot(context, at, reason);
  return true;
}

/** Defers stealth loss until each player strike reaches its authored damage timestamp. */
export function observeStealthBreakingStrike(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  if (event.type !== 'damage' || event.cancelled === true || event.actorType !== 'player') return;
  const skill = event.skillId == null ? null : context.catalog.skillsById.get(event.skillId);
  // Damage-and-stealth skills resolve their own strike before granting stealth, so they cannot cancel that grant.
  const grantsStealth = skill?.effects?.some((effect) => effect.type === 'buff' && effect.kind === 'stealth');
  if (!skill || skill.stealthAttack || grantsStealth) return;

  // Same-timestamp casts commit before the strike transition, matching activation-before-damage EVTC ordering.
  context.tasks.schedule({
    type: THIEF_BREAK_STEALTH_TASK,
    at: event.at + context.epsilon * 2,
    ownerId: event.activationId,
    payload: { skillId: skill.id, strikeAt: event.at }
  });
}

/** Applies a deferred strike's stealth transition at the strike's real timestamp. */
export function handleStealthBreakingStrike(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<BreakStealthTaskPayload>
): void {
  const skill = context.catalog.skillsById.get(task.payload.skillId);
  if (skill && !skill.stealthAttack) {
    breakThiefStealth(context, skill, task.payload.strikeAt, 'strike-broke-stealth');
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
