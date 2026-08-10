import { hasTrait } from "../../../../platform/gw2/trait-state.js";
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

export function berserkEntryDuration(context: WarriorCastContext): number {
  return hasTrait(context, TRAIT.SMASH_BRAWLER) ? 20 : 15;
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
    case ID.SUNDERING_LEAP:
    case ID.SHATTERING_BLOW:
    case ID.OUTRAGE:
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
  if (skill.categories?.includes("Rage")) {
    state.berserkUntil +=
      rageBerserkExtension(skill) +
      (hasTrait(context, TRAIT.LAST_BLAZE) ? 1 : 0);
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

  const state = berserkerState.from(context);
  const berserkerSkill =
    skill.primalBurst ||
    skill.categories?.includes("Rage") ||
    skill.specialization === "Berserker";
  if (
    berserkerSkill &&
    hasTrait(context, TRAIT.KING_OF_FIRES) &&
    state.fireAuraUntil > context.effectiveEnd + context.epsilon
  ) {
    state.fireAuraUntil = 0;
    context.emit({
      type: "damage",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.KING_OF_FIRES,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "King of Fires — Fire Aura Detonation",
      coefficient: 0.7,
    });
    context.emit({
      type: "condition",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.KING_OF_FIRES,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "King of Fires — Burning",
      condition: "Burning",
      stacks: 3,
      duration: 3,
    });
  }
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
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, TRAIT.KING_OF_FIRES)
  ) {
    return;
  }
  const state = berserkerState.from(context);
  if (
    event.at + context.epsilon < state.kingOfFiresReadyAt ||
    criticalCount(context, event) === 0
  ) {
    return;
  }
  state.fireAuraUntil = event.at + 5;
  state.kingOfFiresReadyAt = event.at + 15;
  context.emitDerived(event, {
    type: "buff",
    at: event.at,
    source: "Trait",
    sourceId: TRAIT.KING_OF_FIRES,
    actorType: "effect",
    skillId: event.skillId,
    skillName: event.skillName,
    name: "King of Fires — Fire Aura",
    kind: "fire-aura",
    stacks: 1,
    duration: 5,
  });
}

export function finishBerserkerCast(
  context: WarriorCastContext,
  skill: WarriorSkill,
): void {
  extendBerserk(context, skill);
  applyBerserkerTraits(context, skill);
}
