import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { warriorBoonRemovalCounts } from "../../core/resolver.js";
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
const DOUBLE_DEFIANT_CONTROL_INSIGHT_SKILLS = new Set<number>([ID.KICK]);

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
  return DOUBLE_DEFIANT_CONTROL_INSIGHT_SKILLS.has(Number(event.skillId)) &&
    context.config.target?.defiant === true
    ? 2
    : 1;
}

function attackerInsightFromBoonRemoval(
  context: WarriorSchedulerContext | WarriorResolverContext,
  event: WarriorSimulationEvent | WarriorResolverEvent,
): { attempted: number; removed: number; applications: number } {
  const { attempted, removed } = warriorBoonRemovalCounts(context, event);
  return { attempted, removed, applications: removed };
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

function emitLightningLeapDaze(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    !(Number(event.coefficient) > 0) ||
    event.skillId == null
  ) {
    return;
  }
  const skill = context.catalog.skillsById.get(event.skillId);
  const finisherType = String(
    event.finisherType || skill?.finisherType || "",
  ).toLowerCase();
  const finisherValue = Number(
    event.finisherValue ?? skill?.finisherValue ?? 0,
  );
  if (
    finisherType !== "leap" ||
    finisherValue <= 0 ||
    !activeComboField(context, "Lightning", event.at)
  ) {
    return;
  }
  context.emitDerived(event, {
    type: "control",
    at: event.at,
    source: "Combo",
    sourceId: "warrior.combo.lightning-leap",
    actorType: "player",
    skillId: event.skillId,
    skillName: "Dazing Strike",
    parentSkillName: event.skillName,
    name: "Dazing Strike",
    controlKind: "daze",
    duration: 1,
  });
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
  if (event.type === "warrior.boon-removal") {
    const { applications } = attackerInsightFromBoonRemoval(context, event);
    if (applications > 0 && hasTrait(context, TRAIT.ATTACKERS_INSIGHT)) {
      gainAttackersInsight(
        spellbreakerState.from(context),
        event.at,
        applications,
      );
    }
    return;
  }
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
  if (event.type !== "damage" || !(Number(event.coefficient) > 0)) {
    return;
  }
  emitLightningLeapDaze(context, event);
  if (!hasTrait(context, TRAIT.MAGEBANE_TETHER)) return;
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
