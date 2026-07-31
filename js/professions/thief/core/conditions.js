import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_SKILL_IDS as ID } from "../data/ids.js";
import {
  gw2AlliedPlayerAssumptions,
  gw2AlliedPlayerProcTimeline,
} from "../../../platform/gw2/allied-players.js";
import {
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";
import {
  beginStealthAttack as beginBaseStealthAttack,
  completeStealthAttack as completeBaseStealthAttack,
} from "./stealth.js";

const SPEAR_LEAD_SKILLS = new Set([
  ID.MANTIS_STING,
  ID.UNSUSPECTING_STRIKE,
]);
const SPEAR_FOLLOW_UP_SKILLS = new Set([
  ID.ENTANGLING_ASP,
  ID.VAMPIRIC_SLASH,
]);
const SPEAR_FINISHER_SKILLS = new Set([
  ID.FALLING_SPIDER,
  ID.SHATTERING_ASSAULT,
]);
const SPEAR_STEALTH_SKILLS = new Set([
  ID.ASHEN_ASSAULT,
]);
const SPEAR_CHAIN_STAGE_BY_SKILL = new Map([
  ...[...SPEAR_LEAD_SKILLS].map(skillId => [skillId, 0]),
  ...[...SPEAR_FOLLOW_UP_SKILLS].map(skillId => [skillId, 1]),
  ...[...SPEAR_FINISHER_SKILLS].map(skillId => [skillId, 2]),
]);

const THOUSAND_NEEDLES_PULSES = 5;
const CALTROPS_PULSES = 10;
const CALTROPS_CRIPPLE_PULSES = 5;

function emitCondition(context, {
  at,
  skillId,
  skillName,
  condition,
  stacks,
  duration,
  name = `${skillName} — ${condition}`,
  activationId,
  triggeredByAlly,
  extendsResolutionHorizon = false,
}) {
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
    ...(extendsResolutionHorizon ? { extendsResolutionHorizon: true } : {}),
  });
}

export function spearChainStageForSkill(skillId) {
  return SPEAR_CHAIN_STAGE_BY_SKILL.get(Number(skillId)) ?? null;
}

export function prepareSpearChainSkill(context, skill) {
  const state = professionCoreState(context);
  return {
    fallingSpiderEmpowered:
      skill.id === ID.FALLING_SPIDER
      && Number(state.spearChainStage || 0) === 2
      && state.spearPreviousSkillId === ID.ENTANGLING_ASP,
  };
}

export function observeSpearChainEffect(
  context,
  skill,
  event,
  handlerState = {},
) {
  if (
    handlerState.fallingSpiderEmpowered
    && event.type === "damage"
  ) {
    context.replaceEvent(event, {
      coefficient: Number(event.coefficient || 0) * 1.15,
    });
    return;
  }
  if (
    handlerState.fallingSpiderEmpowered
    && event.type === "condition"
    && ["Bleeding", "Poisoned"].includes(event.condition)
  ) {
    context.replaceEvent(event, {
      stacks: Number(event.stacks || 1) + 1,
    });
    return;
  }
  if (
    skill.id === ID.UNSUSPECTING_STRIKE
    && event.type === "condition"
    && event.condition === "Bleeding"
  ) {
    context.replaceEvent(event, {
      bonusAboveNinetyStacks: 3,
    });
  }
}

export function prepareSpearStealthAttack(context, skill) {
  beginBaseStealthAttack(context, skill);
}

export function completeSpearStealthAttack(
  context,
  skill,
) {
  const at = context.effectiveEnd;
  gainThiefInitiative(context, 4, at, "ashen-assault-refund");
  completeBaseStealthAttack(context, skill);
}

export function updateSpearChainState(context, skill, at) {
  const state = professionCoreState(context);
  const requiredStage = spearChainStageForSkill(skill.id);
  if (requiredStage != null) {
    state.spearChainStage = (requiredStage + 1) % 3;
    state.spearLastWasFinisher = requiredStage === 2;
    state.spearPreviousSkillId = skill.id;
    emitThiefState(context, at, "spear-chain");
    return;
  }
  if (skill.id === ID.BARBED_SPEAR) {
    const stage = Math.max(0, Math.min(
      2,
      Number(state.spearChainStage || 0),
    ));
    state.spearChainStage = (stage + 1) % 3;
    state.spearLastWasFinisher = stage === 2;
    state.spearPreviousSkillId = skill.id;
    emitThiefState(context, at, "spear-chain");
    return;
  }
  if (
    skill.id === ID.DISTRACTING_THROW
    && (
      state.spearLastWasFinisher
      || Number(state.spearChainStage || 0) === 0
    )
  ) {
    const followsFinisher = state.spearLastWasFinisher;
    state.spearChainStage = 1;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    if (followsFinisher) state.distractingThrowBuffUntil = at + 10;
    emitThiefState(context, at, "distracting-throw-lead");
    return;
  }
  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(skill.id)) {
    state.spearChainStage = 0;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    emitThiefState(context, at, "spear-stealth-attack");
  }
}

export function activateSpiderVenom(context) {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const party = gw2AlliedPlayerAssumptions(context.config);
  state.spiderVenomCharges = 6;
  state.spiderVenomExpiresAt = at + 24;
  state.spiderVenomGeneration += 1;
  context.emit({
    type: "buff",
    at,
    source: "thief",
    sourceId: ID.SPIDER_VENOM,
    actorType: "player",
    skillId: ID.SPIDER_VENOM,
    skillName: "Spider Venom",
    name: "Spider Venom",
    kind: "spider-venom",
    duration: 24,
    stacks: 6,
    recipients: "party",
    recipientCount: party.count + 1,
  });
  const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
    start: at,
    duration: 24,
    maximumPerAlly: 6,
  });
  for (let index = 0; index < alliedProcs.length; index += 1) {
    const proc = alliedProcs[index];
    emitCondition(context, {
      at: proc.at,
      skillId: ID.SPIDER_VENOM,
      skillName: "Spider Venom",
      name: `Spider Venom — Ally ${proc.allyIndex} Poison`,
      condition: "Poisoned",
      stacks: 1,
      duration: 3,
      activationId:
        `${context.reservationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
      triggeredByAlly: proc.allyIndex,
      extendsResolutionHorizon: index === alliedProcs.length - 1,
    });
  }
  emitThiefState(context, at, "spider-venom");
}

export function prepareThousandNeedles(context) {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.thousandNeedlesPrepared = true;
  state.thousandNeedlesArmedAt = at + 3;
  emitThiefState(context, at, "prepare-thousand-needles");
}

export function activateThousandNeedles(context, skill) {
  const state = professionCoreState(context);
  state.thousandNeedlesPrepared = false;
  state.thousandNeedlesArmedAt = 0;
  state.thousandNeedlesGeneration += 1;
  context.tasks.schedule({
    type: "thief.thousand-needles-pulse",
    at: context.start,
    ownerId: `thief.thousand-needles:${state.thousandNeedlesGeneration}`,
    payload: {
      generation: state.thousandNeedlesGeneration,
      pulse: 0,
      skillId: skill.id,
      activationId: context.reservationId,
    },
  });
  emitThiefState(context, context.start, "thousand-needles");
}

export function handleThousandNeedlesPulse(context, task) {
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
    name: pulse === 0
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
  ]) {
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

export function activateCaltrops(context, skill) {
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

export function handleCaltropsPulse(context, task) {
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
