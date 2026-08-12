import { professionCoreState } from "../../../platform/engine/profession.js";
import { emitEngineerState } from "./events.js";
import { ENGINEER_SKILL_IDS as ID } from "../data/ids.js";
import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSkill,
} from "../types.js";

interface LightningRodTaskPayload extends SchedulerRecord {
  readonly activationId: string;
}

const LIGHTNING_ROD_FIRST_PULSE_DELAY_SECONDS = 0.16;
const LIGHTNING_ROD_PULSE_INTERVAL_SECONDS = 0.5;
const LIGHTNING_ROD_PULSE_COUNT = 8;
// The supplied EVTC unlocks Electric Artillery 4.196-4.203 seconds after
// Lightning Rod starts across all eleven activations.
const ELECTRIC_ARTILLERY_ARMING_TIME_SECONDS = 4.2;

function emitSpearEvent(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
  eventType: string,
): void {
  context.emit({
    type: eventType,
    at,
    source: "engineer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
  });
}

export function scheduleLightningRod(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const state = professionCoreState(context);
  const activationId = context.reservationId;
  const firstAt =
    context.effectiveEnd + LIGHTNING_ROD_FIRST_PULSE_DELAY_SECONDS;
  const readyAt = context.start + ELECTRIC_ARTILLERY_ARMING_TIME_SECONDS;
  const ownerId = `engineer.lightning-rod:${activationId}`;
  state.lightningRodActivationId = activationId;
  state.lightningRodChargeExpiries = [];
  state.electricArtilleryAvailable = false;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = false;
  state.electricArtilleryReadyAt = readyAt;
  state.electricArtilleryExpiresAt = readyAt + 14;
  emitEngineerState(context, context.effectiveEnd, "lightning-rod-active");

  for (let index = 0; index < LIGHTNING_ROD_PULSE_COUNT; index += 1) {
    const at = firstAt + index * LIGHTNING_ROD_PULSE_INTERVAL_SECONDS;
    context.emit({
      type: "engineer.lightning-rod-pulse",
      at,
      source: "engineer",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      hitIndex: index + 1,
      totalHits: LIGHTNING_ROD_PULSE_COUNT,
      ...(index === LIGHTNING_ROD_PULSE_COUNT - 1
        ? { extendsResolutionHorizon: true }
        : {}),
    });
    context.tasks.schedule({
      type: "engineer.lightning-rod-charge",
      at,
      ownerId,
      payload: { activationId },
    });
  }
  context.tasks.schedule({
    type: "engineer.electric-artillery-ready",
    at: readyAt,
    ownerId,
    payload: { activationId },
  });
  context.tasks.schedule({
    type: "engineer.electric-artillery-expire",
    at: state.electricArtilleryExpiresAt,
    ownerId,
    payload: { activationId },
  });
}

export function scheduleConduitSurge(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const at = context.effectiveEnd;
  professionCoreState(context).focusedUntil = Math.max(
    professionCoreState(context).focusedUntil,
    at + 10,
  );
  emitEngineerState(context, at, "conduit-surge");
  emitSpearEvent(context, skill, at, "engineer.conduit-surge");
}

export function scheduleElectricArtillery(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const charges = state.lightningRodChargeExpiries.filter(
    (expiresAt) => Number(expiresAt) > at,
  ).length;
  context.emit({
    type: "engineer.electric-artillery",
    at,
    source: "engineer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    charges,
  });
  context.tasks.cancelOwner(
    `engineer.lightning-rod:${state.lightningRodActivationId}`,
  );
  state.lightningRodActivationId = "";
  state.lightningRodChargeExpiries = [];
  state.electricArtilleryAvailable = false;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = false;
  state.electricArtilleryReadyAt = 0;
  state.electricArtilleryExpiresAt = 0;
  emitEngineerState(context, at, "electric-artillery-consumed");
}

export function handleLightningRodCharge(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<LightningRodTaskPayload>,
): void {
  const state = professionCoreState(context);
  if (state.lightningRodActivationId !== task.payload?.activationId) return;
  state.lightningRodChargeExpiries = state.lightningRodChargeExpiries.filter(
    (expiresAt) => Number(expiresAt) > task.at,
  );
  if (state.lightningRodChargeExpiries.length < 12) {
    state.lightningRodChargeExpiries.push(task.at + 14);
  }
}

export function handleElectricArtilleryReady(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<LightningRodTaskPayload>,
): void {
  const state = professionCoreState(context);
  if (state.lightningRodActivationId !== task.payload?.activationId) return;
  state.electricArtilleryAvailable = true;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = true;
  state.electricArtilleryReadyAt = 0;
  emitEngineerState(context, task.at, "electric-artillery-ready");
}

export function handleElectricArtilleryExpire(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<LightningRodTaskPayload>,
): void {
  const state = professionCoreState(context);
  if (state.lightningRodActivationId !== task.payload?.activationId) return;
  state.lightningRodActivationId = "";
  state.lightningRodChargeExpiries = [];
  state.electricArtilleryAvailable = false;
  state.availableFlips[ID.ELECTRIC_ARTILLERY] = false;
  state.electricArtilleryReadyAt = 0;
  state.electricArtilleryExpiresAt = 0;
  emitEngineerState(context, task.at, "electric-artillery-expired");
}

export function scheduleRoilingSkiesControl(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const isFocused =
    professionCoreState(context).focusedUntil > context.effectiveEnd;
  context.emit({
    type: "control",
    at: context.effectiveEnd,
    source: "engineer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    controlKind: isFocused ? "launch" : "stun",
    focused: isFocused,
  });
}

export function scheduleDevastatorFollowup(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const impactAt = context.fullEnd;
  if (professionCoreState(context).focusedUntil <= impactAt) return;
  const activationId = `${context.reservationId}:focused-devastation`;
  for (let index = 0; index < 6; index += 1) {
    const at = impactAt + 0.16 * (index + 1);
    context.emit({
      type: "damage",
      at,
      source: "engineer",
      sourceId: ID.FOCUSED_DEVASTATION,
      activationId,
      actorType: "player",
      skillId: ID.FOCUSED_DEVASTATION,
      skillName: "Focused Devastation",
      name: "Focused Devastation",
      coefficient: 0.2,
      hits: 1,
      hitIndex: index + 1,
      totalHits: 6,
      skillWeapon: "Spear",
      weaponStrengthProfileId: "nonweapon.unequipped",
      persistsAfterInterrupt: true,
      ...(index === 5 ? { extendsResolutionHorizon: true } : {}),
    });
    context.emit({
      type: "condition",
      at,
      source: "engineer",
      sourceId: ID.FOCUSED_DEVASTATION,
      activationId,
      actorType: "player",
      skillId: ID.FOCUSED_DEVASTATION,
      skillName: "Focused Devastation",
      name: "Focused Devastation — Burning",
      condition: "Burning",
      stacks: 1,
      duration: 2,
      persistsAfterInterrupt: true,
    });
  }
}
