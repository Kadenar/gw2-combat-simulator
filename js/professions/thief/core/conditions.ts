import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_SKILL_IDS as ID } from "../data/ids.js";
import {
  gw2AlliedPlayerAssumptions,
  gw2AlliedPlayerProcTimeline,
} from "../../../platform/gw2/allied-players.js";
import { emitThiefState, gainThiefInitiative } from "./shared.js";
import {
  beginStealthAttack as beginBaseStealthAttack,
  completeStealthAttack as completeBaseStealthAttack,
} from "./stealth.js";
import {
  thiefBalanceProfile,
  thiefBalanceProfileEffect,
  THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE,
} from "./profiles.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type {
  ThiefCastContext,
  ThiefPrecastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill,
} from "../types.js";

const SPEAR_LEAD_SKILLS = new Set<number>([
  ID.MANTIS_STING,
  ID.UNSUSPECTING_STRIKE,
]);
const SPEAR_FOLLOW_UP_SKILLS = new Set<number>([
  ID.ENTANGLING_ASP,
  ID.VAMPIRIC_SLASH,
]);
const SPEAR_FINISHER_SKILLS = new Set<number>([
  ID.FALLING_SPIDER,
  ID.SHATTERING_ASSAULT,
]);
const SPEAR_STEALTH_SKILLS = new Set<number>([ID.ASHEN_ASSAULT]);
const SPEAR_CHAIN_STAGE_BY_SKILL = new Map<number, number>([
  ...[...SPEAR_LEAD_SKILLS].map((skillId) => [skillId, 0] as const),
  ...[...SPEAR_FOLLOW_UP_SKILLS].map((skillId) => [skillId, 1] as const),
  ...[...SPEAR_FINISHER_SKILLS].map((skillId) => [skillId, 2] as const),
]);

const THOUSAND_NEEDLES_PULSES = 5;
const CALTROPS_PULSES = 10;
const CALTROPS_CRIPPLE_PULSES = 5;

function emitCondition(
  context: ThiefSchedulerContext,
  {
    at,
    skillId,
    skillName,
    condition,
    stacks,
    duration,
    name = `${skillName} — ${condition}`,
    activationId,
    triggeredByAlly,
  }: {
    readonly at: number;
    readonly skillId: SkillId;
    readonly skillName: string;
    readonly condition: string;
    readonly stacks: number;
    readonly duration: number;
    readonly name?: string;
    readonly activationId?: string;
    readonly triggeredByAlly?: number;
  },
): void {
  context.emit({
    type: "condition",
    at,
    source: "thief",
    sourceId: skillId,
    actorType: "player",
    skillId,
    skillName,
    name,
    condition,
    stacks,
    duration,
    ...(activationId ? { activationId } : {}),
    ...(triggeredByAlly ? { triggeredByAlly } : {}),
  });
}

export function spearChainStageForSkill(skillId: SkillId): number | null {
  return SPEAR_CHAIN_STAGE_BY_SKILL.get(Number(skillId)) ?? null;
}

export function prepareSpearChainSkill(
  context: ThiefPrecastContext,
  skill: ThiefSkill,
): { readonly fallingSpiderEmpowered: boolean } {
  const state = professionCoreState(context);
  return {
    fallingSpiderEmpowered:
      skill.id === ID.FALLING_SPIDER &&
      Number(state.spearChainStage || 0) === 2 &&
      state.spearPreviousSkillId === ID.ENTANGLING_ASP,
  };
}

export function observeSpearChainEffect(
  context: ThiefCastContext,
  skill: ThiefSkill,
  event: ThiefSimulationEvent,
  handlerState: unknown,
): void {
  const prepared = (handlerState || {}) as {
    readonly fallingSpiderEmpowered?: boolean;
  };
  if (prepared.fallingSpiderEmpowered && event.type === "damage") {
    const profile = thiefBalanceProfile(
      context,
      PROFILE.fallingSpiderEmpowered,
    );
    context.replaceEvent(event, {
      coefficient:
        Number(event.coefficient || 0) *
        Number(profile?.damageMultiplier || 1.15),
    });
    return;
  }
  if (
    prepared.fallingSpiderEmpowered &&
    event.type === "condition" &&
    ["Bleeding", "Poisoned"].includes(event.condition)
  ) {
    context.replaceEvent(event, {
      stacks:
        Number(event.stacks || 1) +
        Number(
          thiefBalanceProfile(context, PROFILE.fallingSpiderEmpowered)
            ?.resourceGain || 1,
        ),
    });
    return;
  }
  if (
    skill.id === ID.UNSUSPECTING_STRIKE &&
    event.type === "condition" &&
    event.condition === "Bleeding"
  ) {
    context.replaceEvent(event, {
      bonusAboveNinetyStacks: 3,
    });
  }
}

export function prepareSpearStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  beginBaseStealthAttack(context, skill);
}

export function completeSpearStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const at = context.effectiveEnd;
  gainThiefInitiative(
    context,
    Number(
      thiefBalanceProfile(context, PROFILE.ashenAssaultRefund)?.resourceGain ||
        4,
    ),
    at,
    "ashen-assault-refund",
  );
  completeBaseStealthAttack(context, skill);
}

export function updateSpearChainState(
  context: ThiefCastContext,
  skill: ThiefSkill,
  at: number,
): void {
  const state = professionCoreState(context);
  const requiredStage = spearChainStageForSkill(skill.id);
  if (requiredStage != null) {
    state.spearChainStage = (requiredStage + 1) % 3;
    state.spearLastWasFinisher = requiredStage === 2;
    state.spearPreviousSkillId = skill.id;
    emitThiefState(context, at, "spear-chain");
    return;
  }
  if (
    skill.id === ID.DISTRACTING_THROW &&
    (state.spearLastWasFinisher || Number(state.spearChainStage || 0) === 0)
  ) {
    const followsFinisher = state.spearLastWasFinisher;
    state.spearChainStage = 1;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    if (followsFinisher) {
      state.distractingThrowBuffUntil =
        at +
        Number(
          thiefBalanceProfile(context, PROFILE.distractingThrow)
            ?.durationMultiplier || 10,
        );
    }
    emitThiefState(context, at, "distracting-throw-lead");
    return;
  }
  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(Number(skill.id))) {
    state.spearChainStage = 0;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    emitThiefState(context, at, "spear-stealth-attack");
  }
}

export function observeSpiderVenomEffect(
  context: ThiefCastContext,
  _skill: ThiefSkill,
  event: ThiefSimulationEvent,
): void {
  if (event.type !== "buff" || event.kind !== "spider-venom") return;
  const party = gw2AlliedPlayerAssumptions(context.config);
  context.replaceEvent(event, {
    recipientCount: party.count + 1,
    maximumRecipients: party.count + 1,
  });
}

export function activateSpiderVenom(context: ThiefCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const profile = thiefBalanceProfile(context, PROFILE.spiderVenomProc);
  const poison = thiefBalanceProfileEffect(profile, "condition");
  const maximumStacks = Number(profile?.maximumStacks || 6);
  const duration = Number(profile?.durationMultiplier || 24);
  state.spiderVenomCharges = maximumStacks;
  state.spiderVenomExpiresAt = at + duration;
  state.spiderVenomGeneration += 1;
  const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
    start: at,
    duration,
    maximumPerAlly: maximumStacks,
  });
  for (let index = 0; index < alliedProcs.length; index += 1) {
    const proc = alliedProcs[index];
    emitCondition(context, {
      at: proc.at,
      skillId: ID.SPIDER_VENOM,
      skillName: "Spider Venom",
      name: `Spider Venom — Ally ${proc.allyIndex} Poison`,
      condition: String(poison?.condition || "Poisoned"),
      stacks: Number(poison?.stacks || 1),
      duration: Number(poison?.duration || 3),
      activationId: `${context.reservationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
      triggeredByAlly: proc.allyIndex,
    });
  }
  emitThiefState(context, at, "spider-venom");
}

export function prepareThousandNeedles(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.thousandNeedlesPrepared = true;
  state.thousandNeedlesArmedAt = at + Number(skill.durationMultiplier || 3);
  emitThiefState(context, at, "prepare-thousand-needles");
}

export function activateThousandNeedles(
  context: ThiefCastContext,
  _skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  state.thousandNeedlesPrepared = false;
  state.thousandNeedlesArmedAt = 0;
  state.thousandNeedlesGeneration += 1;
  emitThiefState(context, context.start, "thousand-needles");
}

export function handleThousandNeedlesPulse(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<{
    readonly pulse: number;
    readonly skillId: SkillId;
    readonly generation: number;
    readonly activationId?: string;
  }>,
): void {
  const pulse = Number(task.payload.pulse || 0);
  const activationId = task.payload.activationId;
  context.emit({
    type: "damage",
    at: task.at,
    source: "thief",
    sourceId: ID.THOUSAND_NEEDLES,
    actorType: "player",
    skillId: ID.THOUSAND_NEEDLES,
    skillName: "Thousand Needles",
    name:
      pulse === 0
        ? "Thousand Needles — Initial Strike"
        : "Thousand Needles — Pulse",
    coefficient: pulse === 0 ? 0.5 : 0.2,
    hits: 1,
    ...(activationId ? { activationId } : {}),
  });
  if (pulse === 0) {
    emitCondition(context, {
      at: task.at,
      skillId: ID.THOUSAND_NEEDLES,
      skillName: "Thousand Needles",
      condition: "Immobilized",
      stacks: 1,
      duration: 3,
      activationId,
    });
  }
  for (const [condition, stacks, duration] of [
    ["Poisoned", 1, 8],
    ["Bleeding", 2, 5],
    ["Crippled", 1, 2],
  ] as const) {
    emitCondition(context, {
      at: task.at,
      skillId: ID.THOUSAND_NEEDLES,
      skillName: "Thousand Needles",
      condition,
      stacks,
      duration,
      activationId,
    });
  }
  if (pulse + 1 < THOUSAND_NEEDLES_PULSES) {
    context.tasks.schedule({
      ...task,
      at: task.at + 1,
      payload: {
        ...task.payload,
        pulse: pulse + 1,
      },
    });
  }
}

export function activateCaltrops(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  context.tasks.schedule({
    type: "thief.caltrops-pulse",
    at: context.effectiveEnd,
    ownerId: `thief.caltrops:${context.reservationId}`,
    payload: {
      pulse: 0,
      skillId: skill.id,
    },
  });
}

export function handleCaltropsPulse(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<{
    readonly pulse: number;
    readonly skillId: SkillId;
    readonly activationId?: string;
  }>,
): void {
  const pulse = Number(task.payload.pulse || 0);
  const activationId = task.payload.activationId;
  emitCondition(context, {
    at: task.at,
    skillId: ID.CALTROPS,
    skillName: "Caltrops",
    condition: "Bleeding",
    stacks: 1,
    duration: 10,
    activationId,
  });
  if (pulse < CALTROPS_CRIPPLE_PULSES) {
    emitCondition(context, {
      at: task.at,
      skillId: ID.CALTROPS,
      skillName: "Caltrops",
      condition: "Crippled",
      stacks: 1,
      duration: 2,
      activationId,
    });
  }
  if (pulse + 1 < CALTROPS_PULSES) {
    context.tasks.schedule({
      ...task,
      at: task.at + 1,
      payload: {
        ...task.payload,
        pulse: pulse + 1,
      },
    });
  }
}
