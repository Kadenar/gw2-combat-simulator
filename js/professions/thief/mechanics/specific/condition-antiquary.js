import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
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
  ID.MALICIOUS_ASHEN_ASSAULT,
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
  });
}

export function spearChainStageForSkill(skillId) {
  return SPEAR_CHAIN_STAGE_BY_SKILL.get(Number(skillId)) ?? null;
}

export function prepareSpearChainSkill(context, skill) {
  const state = context.state.profession;
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
  const state = context.state.profession;
  const handlerState = {
    followsFinisher: Boolean(state.spearLastWasFinisher),
    malice: Math.max(0, Number(state.malice || 0)),
  };
  beginBaseStealthAttack(context, skill);
  return handlerState;
}

export function observeSpearStealthEffect(
  context,
  skill,
  event,
  handlerState = {},
) {
  if (
    skill.id === ID.MALICIOUS_ASHEN_ASSAULT
    && event.type === "damage"
    && event.name === "Malicious Ashen Assault — Final Strike"
  ) {
    context.replaceEvent(event, {
      coefficient:
        Number(event.coefficient || 0)
        * (1 + Number(handlerState.malice || 0) * 0.02),
    });
  }
}

export function completeSpearStealthAttack(
  context,
  skill,
  handlerState = {},
) {
  const at = context.effectiveEnd;
  gainThiefInitiative(context, 4, at, "ashen-assault-refund");
  if (
    skill.id === ID.MALICIOUS_ASHEN_ASSAULT
    && Number(handlerState.malice || 0) > 0
  ) {
    emitCondition(context, {
      at,
      skillId: skill.id,
      skillName: skill.name,
      condition: "Torment",
      stacks: 1,
      duration: 0.5 + Number(handlerState.malice) * 0.5,
      activationId: context.reservationId,
    });
  }
  completeBaseStealthAttack(context, skill);
}

export function updateSpearChainState(context, skill, at) {
  const state = context.state.profession;
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
  if (SPEAR_STEALTH_SKILLS.has(skill.id)) {
    state.spearChainStage = 0;
    state.spearLastWasFinisher = false;
    state.spearPreviousSkillId = skill.id;
    emitThiefState(context, at, "spear-stealth-attack");
  }
}

export function activateSpiderVenom(context) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.spiderVenomCharges = 6;
  state.spiderVenomExpiresAt = at + 24;
  state.spiderVenomGeneration += 1;
  emitThiefState(context, at, "spider-venom");
}

export function prepareThousandNeedles(context) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.thousandNeedlesPrepared = true;
  state.thousandNeedlesArmedAt = at + 3;
  emitThiefState(context, at, "prepare-thousand-needles");
}

export function activateThousandNeedles(context, skill) {
  const state = context.state.profession;
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
