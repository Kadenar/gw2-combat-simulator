/**
 * Revenant spear recharge and Crushing Abyss mechanics.
 *
 * The first four spear skills reduce Abyssal Raze's active count recharge on
 * hit. Abyssal Raze scales from the Crushing Abyss stacks that existed before
 * that use, then grants one new ten-second stack after its impact.
 */
import { REVENANT_SKILL_IDS as ID } from "../data/ids.js";
import { REVENANT_CORE_MECHANICS as MECHANICS } from "./mechanics.js";
import { emitRevenantState } from "./shared.js";
import type {
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantConfig,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
  RevenantState,
} from "../types.js";

const RECHARGE_TASK = "revenant.abyssal-raze-recharge";
const CRUSHING_GAIN_TASK = "revenant.crushing-abyss-gain";
const CRUSHING_SWAP_TASK = "revenant.crushing-abyss-weapon-swap";

function activeCrushingAbyss(
  state: RevenantState,
  at: number,
): number[] {
  state.crushingAbyss = (state.crushingAbyss || []).filter(
    (expiresAt) => Number(expiresAt) > at,
  );
  return state.crushingAbyss;
}

function crushingAbyssStacksAt(
  state: RevenantState,
  at: number,
): number {
  return (state.crushingAbyss || []).filter(
    (expiresAt) => Number(expiresAt) > at,
  ).length;
}

function weaponSet(config: RevenantConfig, set: number): string[] {
  return set === 2
    ? [config.weaponSet2Primary || "", config.weaponSet2Secondary || ""]
    : [config.primaryWeapon || "", config.secondaryWeapon || ""];
}

function sameWeaponSet(
  config: RevenantConfig,
  first: number,
  second: number,
): boolean {
  return (
    JSON.stringify(weaponSet(config, first)) ===
    JSON.stringify(weaponSet(config, second))
  );
}

function emitAbyssalRazePackets(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  at: number,
  crushingAbyssStacks: number,
  triggeredBy = "",
): void {
  const profile = MECHANICS.spear.abyssalRaze;
  const coefficient = triggeredBy
    ? profile.coefficient
    : profile.coefficient *
      (1 + profile.damageIncreasePerStack * crushingAbyssStacks);
  const common = {
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player" as const,
    skillId: skill.id,
    skillName: skill.name,
    skillWeapon: "Spear",
    ...(triggeredBy ? { triggeredBy } : {}),
  };
  context.emit({
    ...common,
    type: "damage",
    name: triggeredBy ? "Abyssal Raze — Crushing Abyss" : "Abyssal Raze",
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    crushingAbyssStacks,
  });
  context.emit({
    ...common,
    type: "condition",
    name: "Abyssal Raze — Torment",
    condition: "Torment",
    stacks: profile.baseTormentStacks,
    duration: profile.baseTormentDuration,
  });
  if (crushingAbyssStacks > 0) {
    context.emit({
      ...common,
      type: "condition",
      name: "Abyssal Raze — Crushing Abyss Torment",
      condition: "Torment",
      stacks: profile.tormentStacksPerCrushingAbyss * crushingAbyssStacks,
      duration: profile.empoweredTormentDuration,
      crushingAbyssStacks,
    });
  }
}

/** Replaces Abyssal Raze's packets with its current stack-scaled profile. */
export function castAbyssalRaze(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const at = context.effectiveEnd;
  const stacks = crushingAbyssStacksAt(context.state.profession, at);
  emitAbyssalRazePackets(context, skill, at, stacks);
  context.tasks.schedule({
    id: `${CRUSHING_GAIN_TASK}:${context.reservationId}`,
    type: CRUSHING_GAIN_TASK,
    at,
    payload: {},
  });
}

/**
 * Schedules one recharge reduction from the first strike packet of a spear
 * skill. Scheduling at impact preserves recharge behavior for interrupted
 * casts and delayed pulses.
 */
export function scheduleAbyssalRazeRechargeReduction(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  event: RevenantSimulationEvent,
): void {
  const reductions =
    MECHANICS.spear.rechargeReductionBySkillId as Readonly<
      Record<SkillId, number>
    >;
  const seconds = reductions[skill.id] || 0;
  if (!seconds || event.type !== "damage" || Number(event.hitIndex || 1) !== 1)
    return;
  context.tasks.schedule({
    id: `${RECHARGE_TASK}:${event.__order ?? event.at}`,
    type: RECHARGE_TASK,
    at: event.at,
    payload: {
      seconds,
      sourceSkillId: skill.id,
      sourceSkillName: skill.name,
    },
  });
}

/** Applies a hit-confirmed reduction to the active count recharge only. */
export function handleAbyssalRazeRechargeReduction(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{
    seconds: number;
    sourceSkillId: SkillId;
    sourceSkillName: string;
  }>,
): void {
  if (!task.payload) return;
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
  const sourceSkill = context.catalog.skillsById.get(
    task.payload.sourceSkillId,
  );
  if (!skill) return;
  const { ammo, reducedBy } = context.cooldownController.reduceAmmoRecharge(
    skill,
    task.payload.seconds,
    task.at,
  );
  if (!ammo || reducedBy <= 0) return;
  const cooldownReduction = Number(reducedBy.toFixed(3));
  context.emit({
    type: "proc",
    procType: "skill",
    at: task.at,
    source: "revenant",
    sourceId: task.payload.sourceSkillId,
    actorType: "player",
    skillId: task.payload.sourceSkillId,
    skillName: task.payload.sourceSkillName,
    sourceSkill: sourceSkill?.name || task.payload.sourceSkillName,
    icon: sourceSkill?.icon || "",
    name: `${task.payload.sourceSkillName} — Abyssal Raze recharge`,
    detail: `${cooldownReduction}s`,
    cooldownReduction,
  });
}

/** Grants one ten-second Crushing Abyss stack, up to the maximum of three. */
export function handleCrushingAbyssGain(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask,
): void {
  if (!task.payload) return;
  const profile = MECHANICS.spear.abyssalRaze;
  const effect = profile.crushingAbyssEffect;
  const stacks = activeCrushingAbyss(context.state.profession, task.at);
  if (stacks.length >= profile.crushingAbyssMaximum) return;
  stacks.push(task.at + profile.crushingAbyssDuration);
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
  if (!skill) return;
  context.emit({
    type: "buff",
    at: task.at,
    source: "revenant",
    sourceId: ID.ABYSSAL_RAZE,
    actorType: "player",
    skillId: effect.id,
    skillName: effect.name,
    icon: effect.icon,
    name: effect.name,
    kind: "crushing-abyss",
    duration: profile.crushingAbyssDuration,
    stacks: 1,
  });
  context.emit({
    type: "proc",
    procType: "skill",
    at: task.at,
    source: "revenant",
    sourceId: ID.ABYSSAL_RAZE,
    actorType: "player",
    skillId: effect.id,
    skillName: effect.name,
    sourceSkill: skill.name,
    icon: effect.icon,
    name: effect.name,
    detail: `${stacks.length}/${profile.crushingAbyssMaximum} stacks`,
  });
  emitRevenantState(context, task.at, "crushing-abyss-gain");
}

/** Queues the max-stack weapon-swap attack at the swap's completion time. */
export function observeRevenantSpearEvent(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (event.type !== "weapon_set" || event.skillId !== ID.SWAP_WEAPONS) return;
  context.tasks.schedule({
    id: `${CRUSHING_SWAP_TASK}:${event.__order ?? event.at}`,
    type: CRUSHING_SWAP_TASK,
    at: event.at,
    payload: { weaponSet: event.weaponSet },
  });
}

/** Unleashes one max-stack Raze when swapping to a different weapon set. */
export function handleCrushingAbyssWeaponSwap(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{ weaponSet?: number }>,
): void {
  if (!task.payload) return;
  const profile = MECHANICS.spear.abyssalRaze;
  const stacks = activeCrushingAbyss(context.state.profession, task.at);
  if (stacks.length < profile.crushingAbyssMaximum) return;
  const destination = Number(task.payload.weaponSet) === 2 ? 2 : 1;
  const origin = destination === 2 ? 1 : 2;
  if (sameWeaponSet(context.config, origin, destination)) return;
  context.state.profession.crushingAbyss = [];
  const skill = context.catalog.skillsById.get(ID.ABYSSAL_RAZE);
  if (!skill) return;
  emitAbyssalRazePackets(
    context,
    skill,
    task.at,
    profile.crushingAbyssMaximum,
    "Swap Weapons",
  );
  emitRevenantState(context, task.at, "crushing-abyss-weapon-swap");
}

/** Removes expired Crushing Abyss stacks from projected scheduler state. */
export function advanceRevenantSpearState(
  context: RevenantSchedulerContext,
  time: number,
): void {
  activeCrushingAbyss(context.state.profession, time);
}

export const revenantSpearSkillHandlers = Object.freeze({
  "revenant.spear-recharge": scheduleAbyssalRazeRechargeReduction,
  "revenant.abyssal-raze": castAbyssalRaze,
});
