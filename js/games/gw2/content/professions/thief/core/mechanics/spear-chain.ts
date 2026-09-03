import { emitThiefStateSnapshot } from '#gw2/content/professions/thief/state.js';
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import { gainThiefInitiative } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import {
  beginStealthAttack as beginBaseStealthAttack,
  completeStealthAttack as completeBaseStealthAttack
} from '#gw2/content/professions/thief/core/mechanics/stealth.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type {
  ThiefCastContext,
  ThiefPrecastContext,
  ThiefSimulationEvent,
  ThiefSkill
} from '#gw2/content/professions/thief/types.js';

const SPEAR_LEAD_SKILLS = new Set<number>([ID.MANTIS_STING, ID.UNSUSPECTING_STRIKE]);
const SPEAR_FOLLOW_UP_SKILLS = new Set<number>([ID.ENTANGLING_ASP, ID.VAMPIRIC_SLASH]);
const SPEAR_FINISHER_SKILLS = new Set<number>([ID.FALLING_SPIDER, ID.SHATTERING_ASSAULT]);
const SPEAR_STEALTH_SKILLS = new Set<number>([ID.ASHEN_ASSAULT]);
const SPEAR_CHAIN_STAGE_BY_SKILL = new Map<number, number>([
  ...[...SPEAR_LEAD_SKILLS].map((skillId) => [skillId, 0] as const),
  ...[...SPEAR_FOLLOW_UP_SKILLS].map((skillId) => [skillId, 1] as const),
  ...[...SPEAR_FINISHER_SKILLS].map((skillId) => [skillId, 2] as const)
]);

export function spearChainStageForSkill(skillId: SkillId): number | null {
  return SPEAR_CHAIN_STAGE_BY_SKILL.get(Number(skillId)) ?? null;
}

export function prepareSpearChainSkill(
  context: ThiefPrecastContext,
  skill: ThiefSkill
): { readonly fallingSpiderEmpowered: boolean } {
  const state = professionCoreState(context);
  return {
    fallingSpiderEmpowered:
      skill.id === ID.FALLING_SPIDER &&
      Number(state.spearChainStage || 0) === 2 &&
      state.spearPreviousSkillId === ID.ENTANGLING_ASP
  };
}

// Decorate spear packets with effects determined at cast preparation, avoiding
// later chain-state changes from altering Falling Spider or Unsuspecting Strike.
export function observeSpearChainEffect(
  context: ThiefCastContext,
  skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown
): void {
  const prepared = (handlerState || {}) as {
    readonly fallingSpiderEmpowered?: boolean;
  };
  if (prepared.fallingSpiderEmpowered && event.type === 'damage') {
    const profile = balanceProfileFromContext(context, PROFILE.fallingSpiderEmpowered);
    context.replaceEvent(event, {
      coefficient: Number(event.coefficient || 0) * Number(profile?.damageMultiplier || 1.15)
    });
    return;
  }

  if (
    prepared.fallingSpiderEmpowered &&
    event.type === 'condition' &&
    ['Bleeding', 'Poisoned'].includes(event.condition)
  ) {
    context.replaceEvent(event, {
      stacks:
        Number(event.stacks || 1) +
        Number(balanceProfileFromContext(context, PROFILE.fallingSpiderEmpowered)?.resourceGain || 1)
    });
    return;
  }

  if (skill.id === ID.UNSUSPECTING_STRIKE && event.type === 'condition' && event.condition === 'Bleeding') {
    context.replaceEvent(event, {
      bonusAboveNinetyStacks: 3
    });
  }
}

export function prepareSpearStealthAttack(context: ThiefCastContext, skill: ThiefSkill): void {
  beginBaseStealthAttack(context, skill);
}

export function completeSpearStealthAttack(context: ThiefCastContext, skill: ThiefSkill): void {
  const at = context.effectiveEnd;
  gainThiefInitiative(
    context,
    Number(balanceProfileFromContext(context, PROFILE.ashenAssaultRefund)?.resourceGain || 4),
    at,
    'ashen-assault-refund'
  );
  completeBaseStealthAttack(context, skill);
}

// Advance or reset the three-stage spear chain, arming Distracting Throw's bonus
// only when it follows a completed finisher.
export function updateSpearChainState(context: ThiefCastContext, skill: ThiefSkill, at: number): void {
  const state = professionCoreState(context);
  const requiredStage = spearChainStageForSkill(skill.id);
  if (requiredStage != null) {
    state.spearChainStage = (requiredStage + 1) % 3;
    state.spearLastWasFinisher = requiredStage === 2;
    state.spearPreviousSkillId = skill.id;
    emitThiefStateSnapshot(context, at, 'spear-chain');
    return;
  }

  if (skill.id === ID.DISTRACTING_THROW && (state.spearLastWasFinisher || Number(state.spearChainStage || 0) === 0)) {
    const followsFinisher = state.spearLastWasFinisher;
    state.spearChainStage = 1;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    if (followsFinisher) {
      state.distractingThrowBuffUntil =
        at + Number(balanceProfileFromContext(context, PROFILE.distractingThrow)?.durationMultiplier || 10);
    }

    emitThiefStateSnapshot(context, at, 'distracting-throw-lead');
    return;
  }

  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(Number(skill.id))) {
    state.spearChainStage = 0;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    emitThiefStateSnapshot(context, at, 'spear-stealth-attack');
  }
}
