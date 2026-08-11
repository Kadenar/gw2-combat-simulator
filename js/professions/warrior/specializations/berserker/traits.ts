import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type { ScheduledTask } from "../../../../platform/engine/types.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill,
} from "../../types.js";
import { emitBerserkMarker } from "./mechanics.js";
import { berserkerState } from "./state.js";

const FIRE_AURA_ICON =
  "https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fire_Aura.png";

function emitBoon(
  context: WarriorCastContext,
  skill: WarriorSkill,
  name: string,
  boon: string,
  duration: number,
  stacks = 1,
  recipients?: string,
): void {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "Trait",
    sourceId:
      name === "Burst of Aggression"
        ? TRAIT.BURST_OF_AGGRESSION
        : name === "Bloody Roar"
          ? TRAIT.BLOODY_ROAR
          : TRAIT.HEAT_THE_SOUL,
    actorType: "effect",
    skillId: skill.id,
    skillName: skill.name,
    name,
    kind: boon,
    boon,
    duration,
    stacks,
    ...(recipients ? { recipients } : {}),
  });
}

export function berserkEntryDuration(_context: WarriorCastContext): number {
  return 20;
}

export function applyBerserkEntryTraits(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  emitBoon(context, skill, "Burst of Aggression", "quickness", 3);
  emitBoon(context, skill, "Burst of Aggression", "fury", 8);
  if (hasTrait(context, TRAIT.BLOODY_ROAR)) {
    emitBoon(context, skill, "Bloody Roar", "resistance", 3.5);
  }
}

function isComplete(context: WarriorCastContext): boolean {
  return context.effectiveEnd >= context.fullEnd - context.epsilon;
}

/**
 * Base berserk-duration extension (seconds) granted by each rage skill on hit,
 * before the Last Blaze bonus. Entering berserk (Berserk itself) grants none;
 * unlisted rage skills use the shared default.
 */
function rageBerserkExtension(skill: WarriorSkill): number {
  switch (skill.id) {
    case ID.BERSERK:
    case ID.BERSERK_ID_30435:
      return 0;
    case ID.WILD_BLOW:
      return 5;
    case ID.OUTRAGE:
      // The simulator always has a nearby target, so Outrage uses its
      // increased three-second extension instead of the one-second base.
      return 3;
    case ID.SUNDERING_LEAP:
    case ID.SHATTERING_BLOW:
      return 3;
    default:
      return 2;
  }
}

function extendBerserk(context: WarriorCastContext, skill: WarriorSkill): void {
  const state = berserkerState.from(context);
  if (!state.berserkActive || !isComplete(context)) return;
  const previousUntil = state.berserkUntil;
  if (skill.primalBurst && hasTrait(context, TRAIT.SMASH_BRAWLER)) {
    state.berserkUntil += skill.id === ID.DECAPITATE ? 1 : 2;
  }
  if (
    skill.categories?.includes("Rage") &&
    skill.id !== ID.BERSERK &&
    skill.id !== ID.BERSERK_ID_30435
  ) {
    state.berserkUntil +=
      rageBerserkExtension(skill) +
      (skill.id !== ID.OUTRAGE && hasTrait(context, TRAIT.LAST_BLAZE) ? 1 : 0);
  }
  if (state.berserkUntil > previousUntil) emitBerserkMarker(context, skill);
}

function applyBerserkerTraits(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  if (!isComplete(context)) return;
  if (
    skill.categories?.includes("Rage") &&
    hasTrait(context, TRAIT.LAST_BLAZE)
  ) {
    context.emit({
      type: "condition",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.LAST_BLAZE,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "Last Blaze — Burning",
      condition: "Burning",
      stacks: 1,
      duration: 4,
    });
  }
  if (skill.primalBurst && hasTrait(context, TRAIT.HEAT_THE_SOUL)) {
    emitBoon(
      context,
      skill,
      "Heat the Soul — Quickness",
      "quickness",
      skill.id === ID.DECAPITATE ? 2 : 5,
      1,
      "party",
    );
    emitBoon(context, skill, "Heat the Soul — Fury", "fury", 5, 1, "party");
    emitBoon(context, skill, "Heat the Soul — Might", "might", 5, 3, "party");
  }
}

function isBerserkerSkill(skill: WarriorSkill): boolean {
  return Boolean(
    skill.primalBurst ||
    skill.categories?.includes("Rage") ||
    skill.specialization === "Berserker",
  );
}

function activeComboField(
  context: WarriorSchedulerContext,
  type: string,
  at: number,
): boolean {
  return context.events.some((event) => {
    if (
      event.type !== "action" ||
      event.cancelled === true ||
      Number(event.endsAt) > at + context.epsilon ||
      event.skillId == null
    ) {
      return false;
    }
    const field = context.catalog.skillsById.get(event.skillId);
    return (
      String(field?.comboField || "").toLowerCase() === type.toLowerCase() &&
      Number(field?.duration || 0) > 0 &&
      Number(event.endsAt) + Number(field?.duration || 0) >=
        at - context.epsilon
    );
  });
}

function isFireLeapFinisher(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): boolean {
  const skill =
    event.skillId == null
      ? null
      : context.catalog.skillsById.get(event.skillId);
  const finisherType = String(
    event.finisherType || skill?.finisherType || "",
  ).toLowerCase();
  const finisherValue = Number(
    event.finisherValue ?? skill?.finisherValue ?? 0,
  );
  const action = context.events.find(
    (candidate) =>
      candidate.type === "action" &&
      candidate.activationId === event.activationId,
  );
  const comboAt = Number(action?.at ?? event.at);
  return (
    finisherType === "leap" &&
    finisherValue > 0 &&
    activeComboField(context, "Fire", comboAt)
  );
}

function applyFireProjectileFinisher(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  const skill =
    event.skillId == null
      ? null
      : context.catalog.skillsById.get(event.skillId);
  const finisherType = String(
    event.finisherType || skill?.finisherType || "",
  ).toLowerCase();
  const chance = Math.max(
    0,
    Math.min(1, Number(event.finisherValue ?? skill?.finisherValue ?? 0)),
  );
  if (
    finisherType !== "projectile" ||
    chance <= 0 ||
    !activeComboField(context, "Fire", event.at)
  ) {
    return;
  }

  const state = berserkerState.from(context);
  let triggered = chance >= 1;
  if (context.config.randomness?.mode === "stochastic") {
    const policy = context.schedulerPolicy as unknown as {
      rollRandom(probability: number, stream?: string): boolean;
    };
    triggered = policy.rollRandom(chance, "warrior.combo.fire-projectile");
  } else if (chance < 1) {
    state.fireProjectileFinisherProgress += chance;
    if (state.fireProjectileFinisherProgress >= 1 - context.epsilon) {
      state.fireProjectileFinisherProgress -= 1;
      triggered = true;
    }
  }
  if (!triggered) return;

  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: "Combo",
    sourceId: "warrior.combo.fire-projectile",
    actorType: "player",
    skillId: event.skillId,
    skillName: event.skillName,
    name: "Fire Combo — Burning",
    condition: "Burning",
    stacks: 1,
    duration: 1,
  });
}

function emitFireAura(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  source: "Combo" | "Trait",
): void {
  const fromTrait = source === "Trait";
  berserkerState.from(context).fireAuraUntil = event.at + 5;
  const common = {
    at: event.at,
    source,
    sourceId: fromTrait ? TRAIT.KING_OF_FIRES : "warrior.combo.fire-leap",
    actorType: "effect",
    skillId: event.skillId,
    skillName: event.skillName,
  } as const;
  context.emitDerived(event, {
    ...common,
    type: "buff",
    name: fromTrait ? "King of Fires — Fire Aura" : "Fire Aura — Leap Combo",
    kind: "fire-aura",
    stacks: 1,
    duration: 5,
  });
  context.emitDerived(event, {
    ...common,
    type: "proc",
    procType: fromTrait ? "trait" : "skill",
    name: "Fire Aura",
    sourceSkill: String(event.skillName || event.name || ""),
    detail: fromTrait ? "Granted by King of Fires" : "Granted by leap combo",
    icon: FIRE_AURA_ICON,
  });
}

function criticalCount(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): number {
  if (context.config.randomness?.mode === "stochastic") {
    return event.didCrit === true ? 1 : 0;
  }
  const criticalPolicy = context.schedulerPolicy as unknown as {
    critical?: (
      schedulerContext: WarriorSchedulerContext,
      simulationEvent: WarriorSimulationEvent,
    ) => { chance?: number };
  };
  const state = berserkerState.from(context);
  state.kingOfFiresCriticalProgress += Number(
    criticalPolicy.critical?.(context, event)?.chance || 0,
  );
  const count = Math.floor(state.kingOfFiresCriticalProgress + 1e-9);
  state.kingOfFiresCriticalProgress -= count;
  return count;
}

export function observeBerserkerEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }
  applyFireProjectileFinisher(context, event);
  if (!hasTrait(context, TRAIT.KING_OF_FIRES)) return;
  context.tasks.schedule({
    type: "warrior.king-of-fires-hit",
    at: Math.max(context.state.time, event.at),
    priority: -30,
    payload: { eventOrder: Number(event.__order) },
    required: true,
  });
}

export function handleKingOfFiresHitTask(
  context: WarriorSchedulerContext,
  task: ScheduledTask,
): void {
  const payload = task.payload as { readonly eventOrder?: number } | null;
  const event = context.events.find(
    (candidate) => candidate.__order === Number(payload?.eventOrder),
  ) as WarriorSimulationEvent | undefined;
  if (!event) return;

  if (isFireLeapFinisher(context, event)) {
    emitFireAura(context, event, "Combo");
  }

  const state = berserkerState.from(context);
  if (
    event.at + context.epsilon < state.kingOfFiresReadyAt ||
    criticalCount(context, event) === 0
  ) {
    return;
  }
  state.kingOfFiresReadyAt = event.at + 15;
  emitFireAura(context, event, "Trait");
  const skill =
    event.skillId == null
      ? null
      : context.catalog.skillsById.get(event.skillId);
  const action = context.events.find(
    (candidate) =>
      candidate.type === "action" &&
      candidate.activationId === event.activationId,
  );
  if (
    skill &&
    isBerserkerSkill(skill) &&
    Number(action?.endsAt) < event.at - context.epsilon
  ) {
    context.tasks.schedule({
      type: "warrior.king-of-fires-detonation",
      at: event.at,
      priority: -20,
      payload: {
        activationId: event.activationId,
        skillId: skill.id,
      },
      required: true,
    });
  }
}

export function handleKingOfFiresDetonationTask(
  context: WarriorSchedulerContext,
  task: ScheduledTask,
): void {
  const payload = task.payload as {
    readonly activationId?: string;
    readonly skillId?: number;
  } | null;
  const skill = context.catalog.skillsById.get(Number(payload?.skillId));
  if (!skill) return;
  const state = berserkerState.from(context);
  if (state.fireAuraUntil <= task.at + context.epsilon) return;

  state.fireAuraUntil = 0;
  const common = {
    activationId: payload?.activationId,
    at: task.at,
    source: "Trait",
    sourceId: TRAIT.KING_OF_FIRES,
    actorType: "effect",
    skillId: skill.id,
    skillName: skill.name,
  } as const;
  context.emit({
    ...common,
    type: "proc",
    procType: "trait",
    name: "King of Fires",
    sourceSkill: skill.name,
    detail: "Fire Aura detonated",
  });
  context.emit({
    ...common,
    type: "damage",
    name: "King of Fires — Fire Aura Detonation",
    coefficient: 0.7,
    canTriggerCriticalTraits: true,
  });
  context.emit({
    ...common,
    type: "condition",
    name: "King of Fires — Burning",
    condition: "Burning",
    stacks: 3,
    duration: 3,
  });
}

export function finishBerserkerCast(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  extendBerserk(context, skill);
  applyBerserkerTraits(context, skill);
  if (
    isComplete(context) &&
    isBerserkerSkill(skill) &&
    hasTrait(context, TRAIT.KING_OF_FIRES)
  ) {
    context.tasks.schedule({
      type: "warrior.king-of-fires-detonation",
      at: context.effectiveEnd,
      priority: -20,
      payload: {
        activationId: context.reservationId,
        skillId: skill.id,
      },
      required: true,
    });
  }
}
