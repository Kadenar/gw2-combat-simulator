import type {
  AvailabilityResult,
  CastContext,
  CastLifecycleContext,
  SchedulerRecord,
  Skill,
} from "../../../../platform/engine/types.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  elementalistCoreState,
  setElementalistAttunementReadyAt,
} from "../../core/state.js";
import { weaverState } from "./state.js";

function availability(
  context: CastContext<SchedulerRecord>,
  skill: Skill,
): AvailabilityResult {
  if (skill.name !== "Tailored Victory") return { ready: true };
  const state = weaverState.from(context);
  return state.perfectWeaveUntil > context.start + context.epsilon
    ? { ready: true }
    : {
        ready: false,
        retryAt: null,
        code: "elementalist.weaver-perfect-weave",
        reason: `${skill.name} is unavailable — requires Perfect Weave.`,
      };
}

function emitBuff(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
  kind: string,
  stacks: number,
  duration: number,
): void {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: skill.name,
    sourceId: skill.id,
    actorType: "player",
    skillName: skill.name,
    kind: kind.toLowerCase(),
    stacks,
    duration,
  });
}

function onCastComplete(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  const state = weaverState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  if (skill.name === "Weave Self") {
    state.weaveSelfUntil = at + 20;
    state.weaveSelfVisited = [core.primaryAttunement];
    state.perfectWeaveUntil = 0;
    if (core.primaryAttunement === "Fire") {
      emitBuff(context, skill, "Weave Self Fire", 1, 20);
    } else if (core.primaryAttunement === "Air") {
      emitBuff(context, skill, "Weave Self Air", 1, 20);
    }
  } else if (skill.name === "Tailored Victory") {
    state.perfectWeaveUntil = 0;
  } else if (skill.name === "Unravel") {
    const previousPrimary = core.primaryAttunement;
    const previousSecondary = core.secondaryAttunement;
    core.secondaryAttunement = core.primaryAttunement;
    core.unravelUntil = at + 5;
    for (const attunement of Object.keys(core.attunementReadyAt)) {
      setElementalistAttunementReadyAt(
        context,
        attunement as keyof typeof core.attunementReadyAt,
        at,
      );
    }
    const boon =
      previousPrimary === "Fire"
        ? (["Might", 5] as const)
        : previousPrimary === "Water"
          ? (["Vigor", 1] as const)
          : previousPrimary === "Air"
            ? (["Fury", 1] as const)
            : (["Protection", 1] as const);
    emitBuff(context, skill, boon[0], boon[1], 5);
    if (
      hasTrait(context, "Elements of Rage") &&
      previousPrimary !== previousSecondary
    ) {
      emitBuff(context, skill, "Elements of Rage", 1, 8);
    }
  } else if (skill.name === "Fervent Stance") {
    state.ferventStanceUntil = at + 8;
  }

  if (
    String(skill.attunement || "").includes("+") &&
    state.ferventStanceUntil >= at
  ) {
    context.emit({
      type: "buff",
      at,
      source: "Fervent Stance",
      sourceId: skill.id,
      actorType: "player",
      skillName: skill.name,
      kind: "might",
      stacks: 3,
      duration: 8,
    });
  }
}

export const weaverCastRules = Object.freeze({
  availability: {
    id: "elementalist.weaver-availability",
    order: 30,
    handler: availability,
  },
});

export const weaverSchedulerHooks = Object.freeze({
  onCastComplete: {
    id: "elementalist.weaver-complete",
    order: 30,
    handler: onCastComplete,
  },
});
