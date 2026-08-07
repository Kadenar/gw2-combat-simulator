import { enqueueOrdered } from "../../../../platform/engine/event-queue.js";
import {
  gw2AlliedPlayerAssumptions,
} from "../../../../platform/gw2/allied-players.js";
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import { emitThiefState } from "../../core/shared.js";
import { specterState } from "./state.js";
import type { ThiefScheduledTask, ThiefSchedulerContext } from "../../types.js";
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSimulationEvent,
  ThiefSkill,
} from "../../types.js";

const LARCENOUS_TORMENT_SHADOW_FORCE_PER_STACK = 0.5;
const LARCENOUS_TORMENT_SIPHON_COEFFICIENT = 0.005;
const DARK_SENTRY_INTERNAL_COOLDOWN = 1;

interface LarcenousTormentTaskPayload extends Record<string, unknown> {
  readonly stacks: number;
}

function emitShadeStepBoon(
  context: ThiefCastContext,
  boon: string,
  duration: number,
): void {
  const party = gw2AlliedPlayerAssumptions(context.config);
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "Trait",
    sourceId: TRAIT.SHADESTEP,
    actorType: "player",
    skillId: context.skill.id,
    skillName: context.skill.name,
    name: `Shade Step - ${boon}`,
    kind: boon,
    boon,
    duration,
    stacks: 1,
    recipients: "party",
    recipientCount: party.count + 1,
  });
}

/** Adds Shade Step's ally boon and arms Dark Sentry for barrier skills. */
export function completeShadowShroudSkill(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  if (hasThiefTrait(context.config, TRAIT.SHADESTEP)) {
    if (skill.id === ID.GRASPING_SHADOWS) {
      emitShadeStepBoon(context, "alacrity", 5);
    } else if (skill.id === ID.DAWNS_REPOSE) {
      emitShadeStepBoon(context, "protection", 5);
    } else if (skill.id === ID.MIND_SHOCK) {
      emitShadeStepBoon(context, "aegis", 4);
    }
  }
  // Dawn's Repose is the supplied shroud skill that grants nearby allies
  // barrier. Dark Sentry is a mandatory Specter minor trait.
  if (skill.id === ID.DAWNS_REPOSE) {
    context.tasks.schedule({
      type: "thief.specter-dark-sentry",
      at: context.effectiveEnd,
      payload: {},
    });
  }
}

/** Defers shadow-force gains until each torment application actually lands. */
export function observeSpecterEvent(
  context: ThiefSchedulerContext,
  event: ThiefSimulationEvent,
): void {
  if (
    event.type !== "condition"
    || event.condition !== "Torment"
    || event.actorType !== "player"
    || !hasThiefTrait(context.config, TRAIT.LARCENOUS_TORMENT)
  ) return;
  context.tasks.schedule({
    id: `thief.larcenous-torment:${event.__order}`,
    type: "thief.larcenous-torment",
    at: Math.max(context.state.time, event.at),
    payload: { stacks: Number(event.stacks || 0) },
  });
}

export function handleLarcenousTorment(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<LarcenousTormentTaskPayload>,
): void {
  const stacks = Math.max(0, Number(task.payload.stacks || 0));
  if (!(stacks > 0)) return;
  const state = specterState.from(context);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + stacks * LARCENOUS_TORMENT_SHADOW_FORCE_PER_STACK,
  );
  emitThiefState(context, task.at, "larcenous-torment");
}

export function handleDarkSentry(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask,
): void {
  const state = specterState.from(context);
  if (task.at + context.epsilon < state.darkSentryReadyAt) return;
  const party = gw2AlliedPlayerAssumptions(context.config);
  if (!party.count) return;
  state.darkSentryReadyAt = task.at + DARK_SENTRY_INTERNAL_COOLDOWN;
  context.emit({
    type: "buff",
    at: task.at,
    source: "Trait",
    sourceId: TRAIT.DARK_SENTRY,
    actorType: "player",
    skillId: TRAIT.DARK_SENTRY,
    skillName: "Dark Sentry",
    name: "Rot Wallow Venom",
    kind: "rot-wallow-venom",
    duration: 30,
    stacks: 1,
    affectsSelf: false,
    recipients: "allies",
    recipientCount: party.count,
  });
  if (party.strikesPerSecond > 0) {
    const procAt = task.at + 1 / party.strikesPerSecond;
    for (let allyIndex = 1; allyIndex <= party.count; allyIndex += 1) {
      context.emit({
        type: "condition",
        at: procAt,
        source: "Trait",
        sourceId: TRAIT.DARK_SENTRY,
        actorType: "player",
        skillId: TRAIT.DARK_SENTRY,
        skillName: "Rot Wallow Venom",
        name: `Rot Wallow Venom - Ally ${allyIndex} Torment`,
        condition: "Torment",
        stacks: 1,
        duration: 2,
        triggeredByAlly: allyIndex,
        extendsResolutionHorizon: true,
      });
    }
  }
  emitThiefState(context, task.at, "dark-sentry");
}

/** Resolver-side life siphons fire once for every applied torment stack. */
export function applyLarcenousTorment(
  context: ThiefResolverContext,
  application: ThiefResolverEvent,
): void {
  if (
    application.condition !== "Torment"
    || application.actorType !== "player"
    || !hasThiefTrait(context.config, TRAIT.LARCENOUS_TORMENT)
  ) return;
  const stacks = Math.max(0, Math.trunc(Number(application.stacks || 0)));
  for (let stack = 1; stack <= stacks; stack += 1) {
    enqueueOrdered(context.queue, {
      type: "damage",
      at: application.at,
      source: "Trait",
      sourceId: TRAIT.LARCENOUS_TORMENT,
      actorType: "effect",
      skillId: TRAIT.LARCENOUS_TORMENT,
      skillName: "Larcenous Torment",
      name: "Larcenous Torment - Life Siphon",
      coefficient: LARCENOUS_TORMENT_SIPHON_COEFFICIENT,
      hits: 1,
      canCrit: false,
      noCrit: true,
      lifeSiphon: true,
      triggeredBy: application.skillName,
      stackIndex: stack,
    });
  }
  const state = specterState.from(context);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + stacks * LARCENOUS_TORMENT_SHADOW_FORCE_PER_STACK,
  );
}
