import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { spellbreakerState } from "./state.js";
import type {
  WarriorResolverContext,
  WarriorResolverEvent,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
} from "../../types.js";

const ATTACKERS_INSIGHT_DURATION = 15;
const ATTACKERS_INSIGHT_MAXIMUM = 5;
const MAGEBANE_TETHER_DURATION = 8;
const MAGEBANE_TETHER_COOLDOWN = 12;

function gainAttackersInsight(
  state: { attackerInsightExpiries: number[] },
  at: number,
  applications = 1,
): void {
  const expiries = Array.from(
    { length: Math.max(1, Math.trunc(applications)) },
    () => at + ATTACKERS_INSIGHT_DURATION,
  );
  state.attackerInsightExpiries = state.attackerInsightExpiries
    .filter((expiresAt) => expiresAt > at)
    .concat(expiries)
    .slice(-ATTACKERS_INSIGHT_MAXIMUM);
}

function attackerInsightApplications(
  context: WarriorSchedulerContext | WarriorResolverContext,
  event: WarriorSimulationEvent | WarriorResolverEvent,
): number {
  return event.skillId === ID.KICK && context.config.target?.defiant === true
    ? 2
    : 1;
}

function triggerMagebaneTether(
  state: {
    magebaneTetherUntil: number;
    magebaneTetherReadyAt: number;
  },
  at: number,
): boolean {
  if (at < state.magebaneTetherReadyAt) return false;
  state.magebaneTetherUntil = at + MAGEBANE_TETHER_DURATION;
  state.magebaneTetherReadyAt = at + MAGEBANE_TETHER_COOLDOWN;
  return true;
}

export function observeSpellbreakerEvent(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  if (event.actorType !== "player") return;
  if (event.type === "control") {
    if (hasTrait(context, TRAIT.ATTACKERS_INSIGHT)) {
      gainAttackersInsight(
        spellbreakerState.from(context),
        event.at,
        attackerInsightApplications(context, event),
      );
    }
    if (
      hasTrait(context, TRAIT.NO_ESCAPE) &&
      ["daze", "stun"].includes(String(event.controlKind || "").toLowerCase())
    ) {
      context.emitDerived(event, {
        type: "condition",
        at: event.at,
        source: "Trait",
        sourceId: TRAIT.NO_ESCAPE,
        actorType: "effect",
        skillId: event.skillId,
        skillName: event.skillName,
        name: "No Escape - Immobilized",
        condition: "Immobilized",
        stacks: 1,
        duration: 1,
      });
    }
    return;
  }
  if (
    event.type !== "damage" ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, TRAIT.MAGEBANE_TETHER)
  ) {
    return;
  }
  const skill =
    event.skillId == null
      ? undefined
      : context.catalog.skillsById.get(event.skillId);
  if (skill?.burst) {
    triggerMagebaneTether(spellbreakerState.from(context), event.at);
  }
}

export function reactToSpellbreakerControl(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  if (
    event.actorType === "player" &&
    hasTrait(context, TRAIT.ATTACKERS_INSIGHT)
  ) {
    gainAttackersInsight(
      spellbreakerState.from(context),
      event.at,
      attackerInsightApplications(context, event),
    );
  }
}

export function reactToSpellbreakerDamage(
  context: WarriorResolverContext,
  event: WarriorResolverEvent,
): void {
  if (
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context, TRAIT.MAGEBANE_TETHER)
  ) {
    return;
  }
  const skill =
    event.skillId == null
      ? undefined
      : context.helpers.skillsById?.get(event.skillId);
  if (
    skill?.burst &&
    triggerMagebaneTether(spellbreakerState.from(context), event.at)
  ) {
    context.recordProc(
      "trait",
      "Magebane Tether",
      event.at,
      event.skillName,
      "15% strike damage for 8 seconds",
    );
  }
}
