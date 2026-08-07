import { renegadeState } from "./state.js";
import {
  professionCoreState,
} from "../../../../platform/engine/profession.js";
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasRevenantTrait } from "../../core/state.js";
import {
  activeKallasFervorStacks,
  grantKallasFervor,
  isBandTogetherReady,
} from "./renegade.js";
import { RENEGADE_MECHANICS as MECHANICS } from "./mechanics.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";

export const RENEGADE_CRITICAL_TRAITS_TASK =
  "revenant.renegade-critical-traits";

function scaledBoonDuration(
  context: RevenantSchedulerContext,
  boon: string,
  duration: number,
): number {
  const skill = (context as unknown as SchedulerRecord).skill as RevenantSkill;
  return (
    context.schedulerPolicy.effectDuration?.(
      context,
      skill,
      { type: "boon", boon, duration },
      duration,
    ) ?? duration
  );
}

function criticalCount(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): number {
  if (context.config.randomness?.mode === "stochastic") {
    if (typeof event.didCrit !== "boolean") {
      throw new Error(
        `Missing sampled critical outcome for Renegade event ${String(
          event.skillName || event.name || event.sourceId,
        )}.`,
      );
    }
    return event.didCrit ? 1 : 0;
  }
  const state = renegadeState.from(context);
  const chance = Number(
    context.schedulerPolicy.critical?.(context, event)?.chance || 0,
  );
  state.renegadeCriticalProgress =
    Number(state.renegadeCriticalProgress || 0) + chance;
  const count = Math.floor(state.renegadeCriticalProgress + 1e-9);
  if (count > 0) state.renegadeCriticalProgress -= count;
  return count;
}

function applyCriticalTraits(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  const ambush = hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER);
  const enmity = hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY);
  if (!ambush && !enmity) return;
  const criticals = criticalCount(context, event);
  const positionalTrigger = Boolean(
    context.config.target?.flanking ||
    context.config.target?.behind ||
    context.config.target?.defiant,
  );
  if (ambush && (positionalTrigger || criticals > 0)) {
    grantKallasFervor(context, event, {
      sourceId: TRAIT.AMBUSH_COMMANDER,
      sourceName: "Ambush Commander",
    });
  }
  const state = professionCoreState(context);
  if (
    !enmity ||
    criticals <= 0 ||
    event.at + context.epsilon <
      Number(state.traitProcReadyAt.endlessEnmity || 0)
  ) {
    return;
  }
  const profile = MECHANICS.renegade.endlessEnmity;
  state.traitProcReadyAt.endlessEnmity = event.at + profile.interval;
  context.emitDerived(event, {
    type: "buff",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.ENDLESS_ENMITY,
    actorType: "player",
    skillId: TRAIT.ENDLESS_ENMITY,
    skillName: "Endless Enmity",
    name: "Endless Enmity — fury",
    kind: "fury",
    duration: scaledBoonDuration(context, "fury", profile.furyDuration),
    stacks: 1,
    recipients: "party",
  });
}

function applyVindication(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (
    event.skillId !== ID.CITADEL_BOMBARDMENT ||
    Number(event.hitIndex || 1) !== 1 ||
    !hasRevenantTrait(context.config, TRAIT.VINDICATION)
  ) {
    return;
  }
  const duration = MECHANICS.renegade.vindication.dazeDuration;
  context.emitDerived(event, {
    type: "control",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.VINDICATION,
    actorType: "player",
    skillId: TRAIT.VINDICATION,
    skillName: "Vindication",
    name: "Vindication — Daze",
    controlKind: "daze",
    duration,
    breakbar: duration * 100,
  });
}

function applyKallasFervorLifeSiphon(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (
    !Number.isFinite(Number(event.flatStrikeBase)) &&
    !Number.isFinite(Number(event.flatStrikePowerCoeff))
  ) {
    return;
  }
  if (!/siphon/i.test(`${event.name || ""} ${event.skillName || ""}`)) return;
  const stacks = activeKallasFervorStacks(renegadeState.from(context), event.at);
  if (!stacks) return;
  const profile = MECHANICS.renegade.kallasFervor;
  const perStack = hasRevenantTrait(context.config, TRAIT.LASTING_LEGACY)
    ? profile.improvedLifeSiphonDamagePerStack
    : profile.lifeSiphonDamagePerStack;
  context.replaceEvent(event, {
    flatStrikeMultiplier:
      Number(event.flatStrikeMultiplier ?? 1) * (1 + stacks * perStack),
  });
}

export function initializeRenegadeTraits(
  context: RevenantSchedulerContext,
): void {
  if (
    hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER) ||
    hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY)
  ) {
    context.schedulerPolicy.requireCriticalFacts?.();
  }
}

export function handleRenegadeCriticalTraitsTask(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{ readonly eventOrder: number }>,
): void {
  const eventOrder = Number(task.payload?.eventOrder);
  const event = context.events.find(
    (candidate) => candidate.__order === eventOrder,
  ) as RevenantSimulationEvent | undefined;
  if (!event) {
    throw new Error(
      `Missing Renegade critical event ${String(eventOrder)}.`,
    );
  }
  applyCriticalTraits(context, event);
}

export function modifyRenegadeCastDuration(
  context: RevenantPrecastContext,
  duration: number,
): number {
  return context.skill?.handlerId === "revenant.band-together" &&
      isBandTogetherReady(renegadeState.from(context), context.start)
    ? 0
    : duration;
}

export function modifyRenegadeRechargeDuration(
  context: RevenantRechargeContext,
  duration: number,
): number {
  return context.skill?.handlerId === "revenant.band-together" &&
      isBandTogetherReady(
        renegadeState.from(context),
        Number(context.start ?? context.at),
      ) &&
      hasRevenantTrait(context.config, TRAIT.ALL_FOR_ONE)
    ? duration * MECHANICS.renegade.allForOne.enhancedRechargeMultiplier
    : duration;
}

export function observeRenegadeTraits(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  const state = renegadeState.from(context);
  const coreState = professionCoreState(context);
  if (
    event.type === "buff" &&
    String(event.kind || "").toLowerCase() === "fury" &&
    hasRevenantTrait(context.config, TRAIT.BLOOD_FURY) &&
    event.at + context.epsilon >= Number(
      coreState.traitProcReadyAt.bloodFury || 0
    )
  ) {
    coreState.traitProcReadyAt.bloodFury =
      event.at + MECHANICS.renegade.bloodFury.interval;
    grantKallasFervor(context, event, {
      sourceId: TRAIT.BLOOD_FURY,
      sourceName: "Blood Fury",
    });
  }
  if (event.type === "damage") {
    applyVindication(context, event);
    applyKallasFervorLifeSiphon(context, event);
  }
  if (
    event.type !== "damage" ||
    event.actorType !== "player" ||
    Number(event.coefficient || 0) <= 0
  ) {
    return;
  }
  const tracksCriticalTraits =
    hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER) ||
    hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY);
  if (tracksCriticalTraits) {
    if (context.config.randomness?.mode === "stochastic") {
      // Shared critical materialization runs at priority -60. Resolve
      // Renegade's scheduler effects afterwards using that same hit fact.
      context.tasks.schedule({
        type: RENEGADE_CRITICAL_TRAITS_TASK,
        at: Math.max(context.state.time, event.at),
        priority: -40,
        payload: { eventOrder: Number(event.__order) },
      });
    } else {
      applyCriticalTraits(context, event);
    }
  }
  const razorclaw = state.razorclawsRage;
  if (
    event.skillId === ID.RAZORCLAWS_RAGE ||
    Number(razorclaw?.charges || 0) <= 0 ||
    event.at >= Number(razorclaw.expiresAt || 0) ||
    event.at + context.epsilon < Number(razorclaw.readyAt || 0)
  ) {
    return;
  }
  const profile = MECHANICS.bandTogether.razorclaw;
  razorclaw.charges -= 1;
  razorclaw.readyAt = event.at + profile.interval;
  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: "revenant",
    sourceId: ID.RAZORCLAWS_RAGE,
    actorType: "player",
    skillId: ID.RAZORCLAWS_RAGE,
    skillName: "Razorclaw's Rage",
    name: "Razorclaw's Rage — Bleeding",
    condition: "Bleeding",
    stacks: 1,
    duration: profile.bleedDuration,
  });
}
