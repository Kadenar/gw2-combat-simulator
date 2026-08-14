import type {
  AvailabilityResult,
  CastContext,
  CastLifecycleContext,
  ScheduledTask,
  SchedulerContext,
  SchedulerRecord,
  Skill,
} from "../../../../platform/engine/types.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { emitElementalistBuff } from "../../core/rules.js";
import {
  elementalistCoreState,
  setElementalistAttunementReadyAt,
} from "../../core/state.js";
import { weaverState } from "./state.js";

const WEAVE_SELF_ACTIVATION_RATIO = 0.65;
const WEAVE_SELF_ACTIVATION_TASK = "elementalist.weave-self-activation";

function initialize(context: SchedulerContext<SchedulerRecord>): void {
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  if (
    core.primaryAttunement === core.secondaryAttunement &&
    hasTrait(context as never, "Elements of Rage")
  ) {
    emitElementalistBuff(
      context as never,
      context.state.time,
      "Elements of Rage",
      1,
      8,
      "Starting Attunement",
      "starting-attunement",
    );
  }
}

function availability(
  context: CastContext<SchedulerRecord>,
  skill: Skill,
): AvailabilityResult {
  if (skill.name === "Unravel" && !hasTrait(context, "Elements of Rage")) {
    return {
      ready: false,
      retryAt: null,
      code: "elementalist.weaver-elements-of-rage",
      reason: `${skill.name} is unavailable — requires Elements of Rage.`,
    };
  }
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
  emitElementalistBuff(
    context as never,
    context.effectiveEnd,
    kind,
    stacks,
    duration,
    skill.name,
    skill.id,
  );
}

function onCastStart(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  if (skill.name !== "Weave Self") return;
  const at =
    context.start +
    (context.fullEnd - context.start) * WEAVE_SELF_ACTIVATION_RATIO;
  if (at > context.effectiveEnd + context.epsilon) return;
  context.tasks.schedule({
    type: WEAVE_SELF_ACTIVATION_TASK,
    at,
    ownerId: context.reservationId,
    payload: { sourceId: skill.id },
  });
}

function modifyRechargeStart(
  context: CastContext<SchedulerRecord> & SchedulerRecord,
  rechargeStart: number,
): number {
  if (context.skill.name !== "Weave Self") return rechargeStart;
  return (
    context.start +
    (rechargeStart - context.start) * WEAVE_SELF_ACTIVATION_RATIO
  );
}

function onCastComplete(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  const state = weaverState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = context.effectiveEnd;
  if (skill.name === "Tailored Victory") {
    state.perfectWeaveUntil = 0;
  } else if (skill.name === "Unravel") {
    const previousPrimary = core.primaryAttunement;
    const previousSecondary = core.secondaryAttunement;
    core.secondaryAttunement = core.primaryAttunement;
    core.unravelUntil = at + 5;
    core.attunementEnteredAt = at;
    context.emit({
      type: "elementalist.attunement",
      at,
      priority: -20,
      source: skill.name,
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      from: previousPrimary,
      fromSecondaryAttunement: previousSecondary,
      to: core.primaryAttunement,
      secondaryAttunement: core.secondaryAttunement,
    });
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
    emitElementalistBuff(
      context as never,
      at,
      "Might",
      3,
      8,
      "Fervent Stance",
      skill.id,
    );
  }
}

function handleWeaveSelfActivation(
  context: SchedulerContext<SchedulerRecord>,
  task: ScheduledTask<SchedulerRecord>,
): void {
  const state = weaverState.from(context);
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  const at = task.at;
  const sourceId = String(task.payload?.sourceId || "weave-self");
  state.weaveSelfUntil = at + 20;
  state.weaveSelfVisited = [core.primaryAttunement];
  state.perfectWeaveUntil = 0;
  if (core.primaryAttunement === "Fire") {
    emitElementalistBuff(
      context as never,
      at,
      "Weave Self Fire",
      1,
      20,
      "Weave Self",
      sourceId,
    );
  } else if (core.primaryAttunement === "Air") {
    emitElementalistBuff(
      context as never,
      at,
      "Weave Self Air",
      1,
      20,
      "Weave Self",
      sourceId,
    );
  }
}

function afterCast(
  context: CastLifecycleContext<SchedulerRecord>,
  skill: Skill,
): void {
  if (skill.name === "Unravel") {
    const core = elementalistCoreState(context as unknown as SchedulerRecord);
    core.unravelUntil = context.effectiveEnd + 5;
    for (const attunement of Object.keys(core.attunementReadyAt)) {
      setElementalistAttunementReadyAt(
        context,
        attunement as keyof typeof core.attunementReadyAt,
        context.effectiveEnd,
      );
    }
    return;
  }
  if (!skill.name.startsWith("Primordial Stance")) return;
  const tickTimes = new Set<number>();
  for (const event of context.events) {
    if (event.activationId !== context.reservationId) continue;
    if (event.type === "condition") {
      if (event.at > context.effectiveEnd + context.epsilon) {
        tickTimes.add(event.at);
      }
      context.replaceEvent(event, {
        type: "marker",
        cancelled: true,
        detail: "replaced by dynamic Primordial Stance attunements",
      });
    } else if (event.type === "damage") {
      context.replaceEvent(event, {
        type: "marker",
        cancelled: true,
        detail: "replaced by chronological Primordial Stance pulses",
      });
    }
  }
  for (const at of tickTimes) {
    context.tasks.schedule({
      type: "elementalist.primordial-stance",
      at,
      ownerId: context.reservationId,
      payload: { sourceId: skill.id },
    });
  }
}

function handlePrimordialStanceTick(
  context: SchedulerContext<SchedulerRecord>,
  task: ScheduledTask<SchedulerRecord>,
): void {
  const core = elementalistCoreState(context as unknown as SchedulerRecord);
  const sourceId = (task.payload?.sourceId ||
    "primordial-stance") as Skill["id"];
  const attunements = core.secondaryAttunement
    ? [core.primaryAttunement, core.secondaryAttunement]
    : [core.primaryAttunement];
  const effects: Readonly<Record<string, readonly [string, number, number]>> = {
    Fire: ["Burning", 1, 2],
    Water: ["Chilled", 1, 1],
    Air: ["Vulnerability", 8, 3],
    Earth: ["Bleeding", 2, 6],
  };
  context.emit({
    type: "damage",
    at: task.at,
    source: "elementalist",
    sourceId,
    actorType: "player",
    skillName: "Primordial Stance",
    skillId: sourceId,
    coefficient: 0.33,
    skillWeapon: "Unequipped",
    damageKind: "field-tick",
  });
  for (const attunement of attunements) {
    const [condition, stacks, duration] = effects[attunement];
    context.emit({
      type: "condition",
      at: task.at,
      source: "Primordial Stance",
      sourceId,
      actorType: "player",
      skillName: "Primordial Stance",
      condition,
      stacks,
      duration,
    });
  }
}

export const weaverCastRules = Object.freeze({
  availability: {
    id: "elementalist.weaver-availability",
    order: 30,
    handler: availability,
  },
  modifyRechargeStart,
});

export const weaverSchedulerHooks = Object.freeze({
  initialize: {
    id: "elementalist.weaver-initialize",
    order: 30,
    handler: initialize,
  },
  onCastStart: {
    id: "elementalist.weaver-cast-start",
    order: 30,
    handler: onCastStart,
  },
  afterCast: {
    id: "elementalist.weaver-after-cast",
    order: 30,
    handler: afterCast,
  },
  onCastComplete: {
    id: "elementalist.weaver-complete",
    order: 30,
    handler: onCastComplete,
  },
  taskHandlers: Object.freeze({
    [WEAVE_SELF_ACTIVATION_TASK]: handleWeaveSelfActivation,
    "elementalist.primordial-stance": handlePrimordialStanceTick,
  }),
});
