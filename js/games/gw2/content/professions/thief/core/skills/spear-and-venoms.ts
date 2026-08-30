import { emitSkillCondition } from '../../../../../platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '../../../../../platform/engine/events/state-snapshots.js';
import { professionCoreState } from '../../../../../platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '../../data/ids.js';
import { snapshotThiefState } from '../state.js';
import {
  gw2AlliedPlayerAssumptions,
  gw2AlliedPlayerProcTimeline
} from '../../../../../platform/combat/state/allied-players.js';
import { gainThiefInitiative } from '../mechanics/resource-events.js';
import {
  beginStealthAttack as beginBaseStealthAttack,
  completeStealthAttack as completeBaseStealthAttack
} from '../mechanics/stealth.js';
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '../profiles.js';
import type { SkillId } from '../../../../../platform/engine/types.js';
import type { ThiefCastContext, ThiefPrecastContext, ThiefSimulationEvent, ThiefSkill } from '../../types.js';

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
    const profile = thiefBalanceProfile(context, PROFILE.fallingSpiderEmpowered);
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
        Number(thiefBalanceProfile(context, PROFILE.fallingSpiderEmpowered)?.resourceGain || 1)
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
    Number(thiefBalanceProfile(context, PROFILE.ashenAssaultRefund)?.resourceGain || 4),
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
    emitStateSnapshot(context, 'thief', at, 'spear-chain', snapshotThiefState(context.state.profession));
    return;
  }

  if (skill.id === ID.DISTRACTING_THROW && (state.spearLastWasFinisher || Number(state.spearChainStage || 0) === 0)) {
    const followsFinisher = state.spearLastWasFinisher;
    state.spearChainStage = 1;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    if (followsFinisher) {
      state.distractingThrowBuffUntil =
        at + Number(thiefBalanceProfile(context, PROFILE.distractingThrow)?.durationMultiplier || 10);
    }

    emitStateSnapshot(context, 'thief', at, 'distracting-throw-lead', snapshotThiefState(context.state.profession));
    return;
  }

  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(Number(skill.id))) {
    state.spearChainStage = 0;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    emitStateSnapshot(context, 'thief', at, 'spear-stealth-attack', snapshotThiefState(context.state.profession));
  }
}

export function observeSpiderVenomEffect(
  context: ThiefCastContext,
  _skill: ThiefSkill,
  event: ThiefSimulationEvent
): void {
  if (event.type !== 'buff' || event.kind !== 'spider-venom') return;
  const party = gw2AlliedPlayerAssumptions(context.config);
  context.replaceEvent(event, {
    recipientCount: party.count + 1,
    maximumRecipients: party.count + 1
  });
}

// Seed the player's finite Spider Venom window and precompute each assumed ally's
// limited poison proc timeline from the same profile.
export function activateSpiderVenom(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const profile = thiefBalanceProfile(context, PROFILE.spiderVenomProc);
  const poison = thiefBalanceProfileEffect(profile, 'condition');
  const maximumStacks = Number(profile?.maximumStacks || 6);
  const duration = Number(profile?.durationMultiplier || 24);
  state.spiderVenomCharges = maximumStacks;
  state.spiderVenomExpiresAt = at + duration;
  state.spiderVenomGeneration += 1;
  const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
    start: at,
    duration,
    maximumPerAlly: maximumStacks
  });
  for (let index = 0; index < alliedProcs.length; index += 1) {
    const proc = alliedProcs[index];
    emitSkillCondition(context, {
      at: proc.at,
      source: 'thief',
      sourceId: ID.SPIDER_VENOM,
      actorType: 'player',
      skillId: ID.SPIDER_VENOM,
      skillName: 'Spider Venom',
      name: `Spider Venom — Ally ${proc.allyIndex} Poison`,
      condition: String(poison?.condition || 'Poisoned'),
      stacks: Number(poison?.stacks || 1),
      duration: Number(poison?.duration || 3),
      activationId: `${context.reservationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
      triggeredByAlly: proc.allyIndex
    });
  }

  emitStateSnapshot(context, 'thief', at, 'spider-venom', snapshotThiefState(context.state.profession));
}

export function prepareThousandNeedles(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.thousandNeedlesPrepared = true;
  state.thousandNeedlesArmedAt = at + Number(skill.durationMultiplier || 3);
  emitStateSnapshot(context, 'thief', at, 'prepare-thousand-needles', snapshotThiefState(context.state.profession));
}

export function activateThousandNeedles(context: ThiefCastContext, _skill: ThiefSkill): void {
  // Complete the prepared-skill transition; skills.ts owns the declarative pulse timeline.
  const state = professionCoreState(context);
  state.thousandNeedlesPrepared = false;
  state.thousandNeedlesArmedAt = 0;
  emitStateSnapshot(context, 'thief', context.start, 'thousand-needles', snapshotThiefState(context.state.profession));
}
