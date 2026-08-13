import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { emitThiefState } from "../../core/shared.js";
import { storeStolenSkill } from "../../core/steal.js";
import { hasThiefTrait } from "../../core/state.js";
import type {
  ThiefCastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill,
} from "../../types.js";
import { deadeyeState } from "./state.js";
import { applyMaleficentSeven } from "./traits.js";
import type { Gw2SchedulerPolicy } from "../../../../platform/gw2/types.js";
import type { SchedulerContext } from "../../../../platform/engine/types.js";

export const DEADEYE_STOLEN_ID_BY_CHOICE: Readonly<Record<string, number>> =
  Object.freeze({
    "steal-time": ID.STEAL_TIME,
    "steal-warmth": ID.STEAL_WARMTH,
    "steal-resistance": ID.STEAL_RESISTANCE,
    "steal-precision": ID.STEAL_PRECISION,
    "steal-health": ID.STEAL_HEALTH,
    "steal-strength": ID.STEAL_STRENGTH,
    "steal-durability": ID.STEAL_DURABILITY,
    "steal-defenses": ID.STEAL_DEFENSES,
    "steal-mobility": ID.STEAL_MOBILITY,
  });

export function selectedDeadeyeStolenSkill(context: ThiefCastContext): number {
  if (hasThiefTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) {
    return ID.STEAL_TIME;
  }
  const choice =
    context.config.deterministicChoices?.deadeyeStolenSkillChoice ||
    "steal-time";
  return (
    DEADEYE_STOLEN_ID_BY_CHOICE[choice] ||
    DEADEYE_STOLEN_ID_BY_CHOICE["steal-time"]
  );
}

function skillForEvent(
  context: ThiefSchedulerContext,
  event: ThiefSimulationEvent,
): ThiefSkill | undefined {
  return context.catalog.skillsById.get(event.skillId ?? event.sourceId);
}

function isInitiativeAttack(skill: ThiefSkill): boolean {
  return (
    skill.type === "Weapon" &&
    Number(skill.initiativeCost || 0) > 0 &&
    !skill.stealthAttack
  );
}

function markedAt(context: ThiefSchedulerContext, at: number): boolean {
  const state = deadeyeState.from(context);
  return Boolean(state.markedTargetId) && state.markExpiresAt > at;
}

export function initializeDeadeyeMalice(context: ThiefSchedulerContext): void {
  (context.schedulerPolicy as Gw2SchedulerPolicy).requireCriticalFacts();
}

export function observeDeadeyeScheduledEvent(
  context: ThiefSchedulerContext,
  event: ThiefSimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    typeof event.activationId !== "string"
  ) {
    return;
  }
  const skill = skillForEvent(context, event);
  if (!skill || (!skill.malicious && !isInitiativeAttack(skill))) return;
  context.tasks.schedule({
    type: "thief.deadeye-malice-hit",
    at: event.at,
    priority: -50,
    ownerId: event.activationId,
    payload: { eventOrder: event.__order },
  });
}

function gainInitiativeAttackMalice(
  context: ThiefSchedulerContext,
  event: ThiefSimulationEvent,
): void {
  const state = deadeyeState.from(context);
  let criticalMalice = 0;
  if (context.config.randomness?.mode === "stochastic") {
    criticalMalice = Number(event.didCrit === true);
  } else {
    const critical = (context.schedulerPolicy as Gw2SchedulerPolicy).critical(
      context as unknown as SchedulerContext,
      event,
    );
    state.maliceCriticalProgress += Math.max(
      0,
      Math.min(1, Number(critical.chance || 0)),
    );
    criticalMalice = Math.floor(state.maliceCriticalProgress + context.epsilon);
    state.maliceCriticalProgress -= criticalMalice;
  }
  state.malice = Math.min(
    state.maximumMalice,
    state.malice + 1 + criticalMalice,
  );
  applyMaleficentSeven(context, event.at);
  emitThiefState(context, event.at, "malice");
}

function consumeMaliciousAttackMalice(
  context: ThiefSchedulerContext,
  event: ThiefSimulationEvent,
): void {
  const state = deadeyeState.from(context);
  if (hasThiefTrait(context.config, TRAIT.MALICIOUS_INTENT)) {
    state.malice = Math.min(state.maximumMalice, state.malice + 2);
    applyMaleficentSeven(context, event.at);
    emitThiefState(context, event.at, "malicious-intent");
  }
  state.malice = 0;
  state.maleficentSevenTriggered = false;
  emitThiefState(context, event.at, "malice-spent");
}

export function resolveDeadeyeMaliceHit(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<{ readonly eventOrder?: number }>,
): void {
  const event = context.events.find(
    (candidate) => candidate.__order === task.payload.eventOrder,
  ) as ThiefSimulationEvent | undefined;
  const activationId = event?.activationId;
  if (
    !event ||
    typeof activationId !== "string" ||
    !markedAt(context, task.at)
  ) {
    return;
  }
  const skill = skillForEvent(context, event);
  if (!skill) return;
  const state = deadeyeState.from(context);
  if (state.maliceResolvedActivations[activationId]) return;
  state.maliceResolvedActivations[activationId] = true;
  if (skill.malicious) {
    consumeMaliciousAttackMalice(context, event);
  } else if (isInitiativeAttack(skill)) {
    gainInitiativeAttackMalice(context, event);
  }
}

function updateSilentScope(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = deadeyeState.from(context);
  if (
    skill.id !== ID.DODGE ||
    !hasThiefTrait(context.config, TRAIT.SILENT_SCOPE) ||
    state.malice <= 3
  ) {
    return;
  }
  state.stealthAttackCharges = 1;
  state.stealthAttackExpiresAt = context.effectiveEnd + 3;
  emitThiefState(context, context.effectiveEnd, "silent-scope");
}

function updateCantripTraits(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  if (!(skill.categories || []).includes("Cantrip")) return;
  const state = deadeyeState.from(context);
  const at = context.effectiveEnd;
  if (context.config.relic === "Deadeye") {
    state.deadeyeRelicUntil = at + 8;
    context.emit({
      type: "proc",
      procType: "relic",
      at,
      source: "Relic",
      sourceId: "relic.deadeye",
      actorType: "effect",
      name: "Relic of the Deadeye",
      sourceSkill: skill.name,
      detail: "activated",
    });
    emitThiefState(context, at, "deadeye-relic");
  }
  if (hasThiefTrait(context.config, TRAIT.ONE_IN_THE_CHAMBER)) {
    storeStolenSkill(context, selectedDeadeyeStolenSkill(context));
  }
}

export function updateDeadeyeCastState(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  updateSilentScope(context, skill);
  updateCantripTraits(context, skill);
}
