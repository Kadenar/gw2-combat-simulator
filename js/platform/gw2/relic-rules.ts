/**
 * Relic trigger rules: strike/condition multipliers, active effects, and
 * passive timelines. Each simulation selects exactly one rule set and creates
 * only the mutable state required by that relic.
 */

import { EPSILON, isInternalCooldownReady } from "../engine/clock.js";
import { enqueueOrdered } from "../engine/event-queue.js";
import {
  GW2_EVENT_ACTOR_TYPES,
  gw2EventActorType,
  isGw2PlayerActorEvent,
} from "./event-ownership.js";

import type { SimulationEvent, Skill } from "../engine/types.js";
import type {
  Gw2ApplyCondition,
  Gw2ConditionHelpers,
  Gw2RelicContext,
  Gw2RelicMaterializerContext,
  Gw2RelicRule,
  Gw2RelicRuntime,
  Gw2RelicRuntimeContext,
  Gw2RelicState,
} from "./types.js";

interface TimedBuffProcOptions {
  readonly duration: number;
  readonly name: string;
  readonly detail?: string | null;
}

const STATELESS_RELIC: Readonly<Gw2RelicRule> = Object.freeze({});

const ARISTOCRACY_BONUS_PER_STACK = 0.03;
const ARISTOCRACY_DURATION = 8;
const ARISTOCRACY_INTERNAL_COOLDOWN = 1;
const ARISTOCRACY_MAX_STACKS = 5;

interface AristocracyActivation {
  readonly at: number;
  readonly expiresAt: number;
  readonly stacks: number;
  readonly event: SimulationEvent;
}

interface AristocracyState extends Gw2RelicState {
  readyAt: number;
  stacks: number;
  expiresAt: number;
  activations: AristocracyActivation[];
  timelineEvents?: readonly SimulationEvent[];
  timelineLength?: number;
}

function createAristocracyState(): AristocracyState {
  return {
    readyAt: 0,
    stacks: 0,
    expiresAt: 0,
    activations: [],
  };
}

function compareTimelineEvents(
  left: SimulationEvent,
  right: SimulationEvent,
): number {
  return (
    left.at - right.at ||
    Number(left.causalOrder ?? left.__order ?? 0) -
      Number(right.causalOrder ?? right.__order ?? 0)
  );
}

function applyAristocracyTrigger(
  state: AristocracyState,
  event: SimulationEvent,
): AristocracyActivation | null {
  if (
    event.type !== "weakness_vulnerability" ||
    !isInternalCooldownReady(event.at, state.readyAt)
  ) {
    return null;
  }
  if (event.at >= state.expiresAt - EPSILON) state.stacks = 0;
  state.stacks = Math.min(ARISTOCRACY_MAX_STACKS, state.stacks + 1);
  state.expiresAt = event.at + ARISTOCRACY_DURATION;
  state.readyAt = event.at + ARISTOCRACY_INTERNAL_COOLDOWN;
  const activation = {
    at: event.at,
    expiresAt: state.expiresAt,
    stacks: state.stacks,
    event,
  };
  state.activations.push(activation);
  return activation;
}

function replayAristocracyTimeline(
  events: readonly SimulationEvent[],
  combatStartTime: number,
): AristocracyState {
  const state = createAristocracyState();
  const ordered = [...events]
    .filter(
      (event) =>
        event.type === "weakness_vulnerability" &&
        event.at >= combatStartTime - EPSILON,
    )
    .sort(compareTimelineEvents);
  for (const event of ordered) applyAristocracyTrigger(state, event);
  return state;
}

function explicitCombatStartTime(events: readonly SimulationEvent[]): number {
  let combatStartTime = Infinity;
  for (const event of events) {
    if (event.type === "combat_start") {
      combatStartTime = Math.min(combatStartTime, event.at);
    }
  }
  return combatStartTime === Infinity ? -Infinity : combatStartTime;
}

function syncAristocracyTimeline(state: AristocracyState): void {
  const events = state.timelineEvents;
  if (!events || state.timelineLength === events.length) return;
  const replay = replayAristocracyTimeline(
    events,
    explicitCombatStartTime(events),
  );
  state.readyAt = replay.readyAt;
  state.stacks = replay.stacks;
  state.expiresAt = replay.expiresAt;
  state.activations = replay.activations;
  state.timelineLength = events.length;
}

function aristocracyActivationAt(
  state: AristocracyState,
  at: number,
): AristocracyActivation | null {
  syncAristocracyTimeline(state);
  for (let index = state.activations.length - 1; index >= 0; index -= 1) {
    const activation = state.activations[index];
    // A triggering application cannot benefit from its own same-time stack.
    if (activation.at >= at - EPSILON) continue;
    return at < activation.expiresAt - EPSILON ? activation : null;
  }
  return null;
}

/**
 * @param {Gw2RelicRule} rules
 * @returns {Readonly<Gw2RelicRule>}
 */
function defineRelic(rules: Gw2RelicRule): Readonly<Gw2RelicRule> {
  return Object.freeze(rules);
}

function recordTimedBuffProc(
  ctx: Gw2RelicContext,
  state: Gw2RelicState,
  event: SimulationEvent,
  { duration, name, detail = null }: TimedBuffProcOptions,
): void {
  const wasActive = Number(state.buffUntil || 0) > event.at;
  state.buffUntil = Math.max(Number(state.buffUntil || 0), event.at + duration);
  ctx.recordProc(
    "relic",
    name,
    event.at,
    event.skillName,
    detail ?? (wasActive ? "refreshed" : "activated"),
  );
}

/**
 * Builds a strikeMultiplier hook returning `multiplier` while the relic's timed
 * buff window is open and 1 otherwise. An optional predicate further gates the
 * bonus (e.g. player-only strikes).
 */
function timedStrikeBuff(
  multiplier: number,
  predicate?: (event: SimulationEvent) => boolean,
): NonNullable<Gw2RelicRule["strikeMultiplier"]> {
  return (_ctx, state, event) =>
    Number(state.buffFrom ?? -Infinity) <= event.at &&
    Number(state.buffUntil || 0) > event.at &&
    (predicate ? predicate(event) : true)
      ? multiplier
      : 1;
}

const RELIC_RULES: Readonly<Record<string, Readonly<Gw2RelicRule>>> =
  Object.freeze({
    Akeem: defineRelic({
      createState: () => ({ readyAt: 0 }),
      control(
        ctx,
        state,
        event,
        { activeConditionStackCount, applyCondition },
      ) {
        if (!isInternalCooldownReady(event.at, state.readyAt)) return;
        if (
          activeConditionStackCount(ctx, "Confusion", event.at) < 5 &&
          activeConditionStackCount(ctx, "Torment", event.at) < 5
        ) {
          return;
        }

        state.readyAt = event.at + 10;
        ctx.recordProc("relic", "Relic of Akeem", event.at, event.skillName);
        applyCondition(ctx, {
          type: "condition",
          at: event.at,
          name: "Relic of Akeem — Confusion",
          skillName: "Relic of Akeem",
          condition: "Confusion",
          duration: 10,
          stacks: 2,
          source: "Relic",
        });
        applyCondition(ctx, {
          type: "condition",
          at: event.at,
          name: "Relic of Akeem — Torment",
          skillName: "Relic of Akeem",
          condition: "Torment",
          duration: 10,
          stacks: 2,
          source: "Relic",
        });
      },
    }),

    Aristocracy: defineRelic({
      createState: createAristocracyState,
      weaknessVulnerability(ctx, state, event) {
        if (
          ctx.combatStartTime != null &&
          event.at < ctx.combatStartTime - EPSILON
        ) {
          return;
        }
        applyAristocracyTrigger(state as AristocracyState, event);
      },
      timeline(ctx, _state, events) {
        const replay = replayAristocracyTimeline(
          events,
          ctx.combatStartTime ?? -Infinity,
        );
        for (const activation of replay.activations) {
          ctx.recordProc(
            "relic",
            "Relic of Aristocracy",
            activation.at,
            activation.event.skillName,
            `${activation.stacks}/${ARISTOCRACY_MAX_STACKS} stacks`,
          );
        }
      },
      conditionDurationBonus(_ctx, state, at) {
        const activation = aristocracyActivationAt(
          state as AristocracyState,
          at,
        );
        return activation ? activation.stacks * ARISTOCRACY_BONUS_PER_STACK : 0;
      },
    }),

    Blightbringer: defineRelic({
      createState: () => ({
        readyAt: 0,
        count: 0,
        trackedActivations: new Set<string>(),
      }),
      condition(ctx, state, application, { applyCondition }) {
        if (
          application?.condition !== "Poisoned" ||
          !isGw2PlayerActorEvent(application)
        ) {
          return;
        }
        const tracked = state.trackedActivations as Set<string> | undefined;
        const key = String(
          application.activationId ||
            `${application.skillId || application.skillName}:${application.at}`,
        );
        if (tracked?.has(key)) return;
        tracked?.add(key);
        state.count = Math.min(6, Number(state.count || 0) + 1);
        if (
          Number(state.count) < 6 ||
          !isInternalCooldownReady(application.at, state.readyAt)
        ) {
          return;
        }

        state.count = 0;
        state.readyAt = application.at + 8;
        ctx.recordProc(
          "relic",
          "Relic of Blightbringer",
          application.at,
          application.skillName,
        );
        for (const [condition, stacks, duration] of [
          ["Poisoned", 3, 10],
          ["Crippled", 1, 5],
          ["Weakness", 1, 5],
        ] as const) {
          applyCondition(ctx, {
            type: "condition",
            at: application.at,
            name: `Relic of Blightbringer - ${condition}`,
            skillName: "Relic of Blightbringer",
            condition,
            duration,
            stacks,
            source: "Relic",
            sourceId: "relic.blightbringer",
            actorType: "effect",
          });
        }
      },
    }),

    Bloodstone: defineRelic({
      createState: () => ({
        stacks: 0,
        expiresAt: 0,
        buffUntil: 0,
      }),
      blastCombo(ctx, state, event) {
        // Volatility cannot accumulate while Fervor is active.
        if (Number(state.buffUntil || 0) > event.at) return;
        if (Number(state.expiresAt || 0) <= event.at) state.stacks = 0;

        const currentStacks = Number(state.stacks || 0);
        if (currentStacks < 3) {
          state.stacks = currentStacks + 1;
          state.expiresAt = event.at + 10;
          ctx.recordProc(
            "relic",
            "Bloodstone Volatility",
            event.at,
            event.skillName,
            `${state.stacks}/3 stacks`,
          );
          return;
        }

        state.stacks = 0;
        state.expiresAt = 0;
        state.buffUntil = event.at + 8;
        ctx.recordProc(
          "relic",
          "Relic of Bloodstone",
          event.at,
          event.skillName,
          "Bloodstone Fervor",
        );
        const explosionAt = event.at + 0.68;
        enqueueOrdered(ctx.queue, {
          type: "damage",
          at: explosionAt,
          name: "Bloodstone Explosion",
          skillName: "Bloodstone Explosion",
          coefficient: 3,
          hits: 1,
          hitIndex: 1,
          totalHits: 1,
          source: "Relic",
          sourceId: "relic.bloodstone",
          actorType: "effect",
          skillWeapon: "Unequipped",
          canCrit: true,
          triggeredBy: event.skillName,
        });
        enqueueOrdered(ctx.queue, {
          type: "condition",
          at: explosionAt,
          name: "Bloodstone Explosion — Bleeding",
          skillName: "Bloodstone Explosion",
          condition: "Bleeding",
          duration: 6,
          stacks: 6,
          source: "Relic",
          sourceId: "relic.bloodstone",
          actorType: "effect",
          triggeredBy: event.skillName,
        });
      },
      strikeMultiplier: timedStrikeBuff(1.07, isGw2PlayerActorEvent),
    }),

    Brawler: defineRelic({
      createState: () => ({ readyAt: 0, buffUntil: 0 }),
      boon(ctx, state, event) {
        const kind = String(event?.kind || "").toLowerCase();
        if (
          (kind !== "protection" && kind !== "resolution") ||
          !isGw2PlayerActorEvent(event) ||
          !(Number(event.duration) > 0) ||
          !(Number(event.stacks ?? 1) > 0) ||
          !isInternalCooldownReady(event.at, state.readyAt)
        ) {
          return;
        }

        state.readyAt = event.at + 8;
        state.buffUntil = event.at + 4;
        ctx.recordProc(
          "relic",
          "Relic of the Brawler",
          event.at,
          event.skillName,
          "activated",
        );
      },
      strikeMultiplier: timedStrikeBuff(1.1),
    }),

    Claw: defineRelic({
      createState: () => ({ buffUntil: 0 }),
      control(ctx, state, event) {
        if (!isGw2PlayerActorEvent(event)) return;
        recordTimedBuffProc(ctx, state, event, {
          duration: 8,
          name: "Relic of the Claw",
        });
      },
      strikeMultiplier: timedStrikeBuff(1.07),
    }),

    Dragonhunter: defineRelic({
      createState: () => ({ buffUntil: 0 }),
      afterHit(ctx, state, event, skill) {
        if (
          !isGw2PlayerActorEvent(event) ||
          !skill?.categories?.includes("Trap")
        ) {
          return;
        }
        recordTimedBuffProc(ctx, state, event, {
          duration: 5,
          name: "Relic of the Dragonhunter",
        });
      },
      conditionDurationBonus(_ctx, state, at) {
        return Number(state.buffUntil || 0) > at ? 0.1 : 0;
      },
      strikeMultiplier: timedStrikeBuff(1.1),
    }),

    Eagle: defineRelic({
      strikeMultiplier(ctx) {
        const targetHealth = Number(ctx.config.target?.health || 0);
        return targetHealth > 0 &&
          ctx.totals.strike + ctx.totals.condition >= targetHealth * 0.5
          ? 1.1
          : 1;
      },
    }),

    Fireworks: defineRelic({
      createState: () => ({ buffUntil: 0 }),
      afterHit(ctx, state, event, skill) {
        if (
          !isGw2PlayerActorEvent(event) ||
          (skill?.type !== "Weapon" &&
            !skill?.shroud &&
            event.skillWeapon !== "Profession mechanic") ||
          Number(skill?.cooldown || 0) < 20
        ) {
          return;
        }
        recordTimedBuffProc(ctx, state, event, {
          duration: 6,
          name: "Relic of Fireworks",
        });
      },
      strikeMultiplier: timedStrikeBuff(1.07),
    }),

    Fractal: defineRelic({
      createState: () => ({ readyAt: 0 }),
      condition(
        ctx,
        state,
        application,
        { activeConditionStackCount, applyCondition },
      ) {
        if (
          application?.condition !== "Bleeding" ||
          !isInternalCooldownReady(application.at, state.readyAt) ||
          activeConditionStackCount(ctx, "Bleeding", application.at) < 6
        ) {
          return;
        }

        // The triggering bleed is already in conditionState, so reaching six
        // stacks on this application is sufficient.
        state.readyAt = application.at + 20;
        ctx.recordProc(
          "relic",
          "Relic of the Fractal",
          application.at,
          application.skillName,
        );
        applyCondition(ctx, {
          type: "condition",
          at: application.at,
          name: "Relic of the Fractal — Burning",
          skillName: "Relic of the Fractal",
          condition: "Burning",
          duration: 8,
          stacks: 2,
          source: "Relic",
          sourceId: "relic.fractal",
        });
        applyCondition(ctx, {
          type: "condition",
          at: application.at,
          name: "Relic of the Fractal — Torment",
          skillName: "Relic of the Fractal",
          condition: "Torment",
          duration: 8,
          stacks: 3,
          source: "Relic",
          sourceId: "relic.fractal",
        });
      },
    }),

    Mistburn: defineRelic({
      createState: () => ({ readyAt: 0 }),
      materializeBoon(ctx, state, event) {
        const kind = String(event.kind || "").toLowerCase();
        if (
          kind !== "might" ||
          !isGw2PlayerActorEvent(event) ||
          event.recipients === "allies" ||
          !(Number(event.duration) > 0) ||
          !(Number(event.stacks ?? 1) > 0) ||
          !isInternalCooldownReady(event.at, state.readyAt)
        ) {
          return;
        }

        state.readyAt = event.at + 1;
        ctx.emitDerived(event, {
          type: "buff",
          at: event.at,
          name: "Relic of Mistburn - Might",
          skillName: "Relic of Mistburn",
          kind: "might",
          duration: 8,
          stacks: 1,
          source: "Relic",
          sourceId: "relic.mistburn",
          actorType: "effect",
        });
      },
      boon(ctx, _state, event) {
        if (event.type !== "buff" || event.sourceId !== "relic.mistburn") {
          return;
        }
        ctx.recordProc(
          "relic",
          "Relic of Mistburn",
          event.at,
          event.triggeredBy || event.skillName,
        );
      },
      criticalChanceBonus(_ctx, _state, event, mightStacks) {
        return isGw2PlayerActorEvent(event) && mightStacks >= 10 ? 0.1 : 0;
      },
    }),

    "Mist Stranger": defineRelic({
      damageResolved(ctx, _state, event) {
        if (!isGw2PlayerActorEvent(event)) return;
        const siphon = 105 * Number(event.hits || 1);
        ctx.totals.strike += siphon;
        ctx.addBreakdown(
          "Relic of the Mist Stranger",
          siphon,
          "strikeDamage",
          event.hits,
        );
        ctx.resolved.push({
          type: "damage",
          at: event.at,
          name: "Relic of the Mist Stranger",
          skillName: "Relic of the Mist Stranger",
          triggeredBy: event.skillName,
          coefficient: 0,
          hits: event.hits,
          source: "Relic",
          damage: siphon,
        });
        ctx.recordProc(
          "relic",
          "Relic of the Mist Stranger",
          event.at,
          event.skillName,
        );
      },
    }),

    Peitha: defineRelic({
      createState: () => ({ readyAt: 0, buffFrom: 0, buffUntil: 0 }),
      peitha(ctx, state, event, applyCondition) {
        const triggerAt = event.at;
        if (!isInternalCooldownReady(triggerAt, state.readyAt)) return;
        state.readyAt = triggerAt + 4;
        const combatStart = Number(ctx.combatStartTime ?? -Infinity);
        const impactAt =
          triggerAt < combatStart
            ? combatStart
            : triggerAt + Math.max(0, Number(event.projectileDelay || 0));
        state.buffFrom = impactAt;
        state.buffUntil = impactAt + 4;
        ctx.recordProc("relic", "Relic of Peitha", impactAt, event.skillName);
        applyCondition(ctx, {
          type: "condition",
          at: impactAt,
          name: "Relic of Peitha — Torment",
          skillName: "Relic of Peitha",
          condition: "Torment",
          duration: 7,
          stacks: 2,
          source: "Relic",
        });
      },
      strikeMultiplier: timedStrikeBuff(1.1),
    }),

    Shackles: defineRelic({
      createState: () => ({ readyAt: 0 }),
      materializeCondition(ctx, state, application) {
        const actorType = gw2EventActorType(application);
        if (
          application?.condition !== "Immobilized" ||
          (actorType !== GW2_EVENT_ACTOR_TYPES.PLAYER &&
            actorType !== GW2_EVENT_ACTOR_TYPES.SUMMON) ||
          !isInternalCooldownReady(application.at, state.readyAt)
        ) {
          return;
        }

        state.readyAt = application.at + 10;
        ctx.emitDerived(application, {
          type: "proc",
          procType: "relic",
          at: application.at,
          name: "Relic of the Shackles",
          sourceSkill: application.skillName,
          detail: "tethered",
          source: "Relic",
          sourceId: "relic.shackles",
          actorType: "effect",
        });
        ctx.emitDerived(application, {
          type: "damage",
          at: application.at + 5,
          name: "Relic of the Shackles",
          skillName: "Relic of the Shackles",
          coefficient: 3,
          hits: 1,
          hitIndex: 1,
          totalHits: 1,
          source: "Relic",
          sourceId: "relic.shackles",
          actorType: "effect",
          skillWeapon: "Unequipped",
          canCrit: true,
          triggeredBy: application.skillName,
        });
        ctx.emitDerived(application, {
          type: "control",
          at: application.at + 5,
          name: "Relic of the Shackles",
          skillName: "Relic of the Shackles",
          controlKind: "stun",
          duration: 1,
          source: "Relic",
          sourceId: "relic.shackles",
          actorType: "effect",
          triggeredBy: application.skillName,
        });
      },
      damageResolved(ctx, _state, event) {
        if (
          event?.type !== "damage" ||
          event.sourceId !== "relic.shackles" ||
          event.skillName !== "Relic of the Shackles"
        ) {
          return;
        }
        ctx.recordProc(
          "relic",
          "Relic of the Shackles",
          event.at,
          event.triggeredBy,
          "damage",
        );
      },
    }),

    Thief: defineRelic({
      createState: () => ({ stacks: 0, expiresAt: 0 }),
      afterHit(ctx, state, event, skill) {
        if (
          !isGw2PlayerActorEvent(event) ||
          skill?.type !== "Weapon" ||
          !(Number(skill.cooldown || 0) > 0 || skill.resource)
        ) {
          return;
        }
        if (Number(state.expiresAt || 0) <= event.at) state.stacks = 0;
        state.stacks = Math.min(5, Number(state.stacks || 0) + 1);
        state.expiresAt = event.at + 6;
        ctx.recordProc(
          "relic",
          "Relic of the Thief",
          event.at,
          event.skillName,
          `${state.stacks}/5 stacks`,
        );
      },
      strikeMultiplier(_ctx, state, event) {
        return Number(state.stacks || 0) > 0 &&
          Number(state.expiresAt || 0) > event.at
          ? 1 + Number(state.stacks || 0) * 0.01
          : 1;
      },
    }),

    Thorns: defineRelic({
      timeline(ctx, _state, _events, rotationEndTime) {
        for (
          let at = 3, stacks = 1;
          at <= rotationEndTime + EPSILON && stacks <= 10;
          at += 5, stacks += 1
        ) {
          ctx.recordProc(
            "relic",
            "Relic of Thorns",
            at,
            "Incoming enemy hit",
            `${stacks}/10 stacks`,
          );
        }
      },
    }),
  });

/**
 * Creates the selected relic runtime. Rules are immutable and shared; mutable
 * state is created independently for each simulation.
 *
 * @param {unknown} name
 * @returns {Readonly<Gw2RelicRuntime>}
 */
export function createRelicRuntime(name: unknown): Readonly<Gw2RelicRuntime> {
  const selectedName = String(name || "");
  const rules = RELIC_RULES[selectedName] || STATELESS_RELIC;
  const state = rules.createState?.() || {};
  return Object.freeze({
    name: selectedName,
    rules,
    state,
  });
}

/** Creates a rule-owned historical runtime for queries without live state. */
export function createRelicTimelineRuntime(
  name: unknown,
  events: readonly SimulationEvent[],
): Readonly<Gw2RelicRuntime> {
  const runtime = createRelicRuntime(name);
  runtime.state.timelineEvents = events;
  runtime.state.timelineLength = -1;
  return runtime;
}

/**
 * @param {{readonly relic?: Gw2RelicRuntime} | null | undefined} ctx
 * @param {keyof Gw2RelicRule} hook
 * @param {unknown[]} args
 */
function invokeRelicHook(
  ctx: Gw2RelicRuntimeContext | null | undefined,
  hook: keyof Gw2RelicRule,
  ...args: unknown[]
): unknown {
  const relic = ctx?.relic;
  if (!ctx || !relic) return undefined;
  const handler = relic.rules[hook];
  if (typeof handler !== "function") return undefined;
  const dynamicHandler = handler as unknown as (
    context: unknown,
    state: Gw2RelicState,
    ...values: unknown[]
  ) => unknown;
  return dynamicHandler(ctx, relic.state, ...args);
}

/**
 * Calculates the strike multiplier supplied by the selected relic.
 */
export function relicStrikeMultiplier(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
): number {
  return Number(invokeRelicHook(ctx, "strikeMultiplier", event) ?? 1);
}

/** Materializes boon applications created by the selected relic. */
export function materializeBoonRelics(
  ctx: Gw2RelicMaterializerContext,
  relic: Gw2RelicRuntime,
  event: SimulationEvent,
): void {
  const handler = relic.rules.materializeBoon;
  if (typeof handler !== "function") return;
  handler(ctx, relic.state, event);
}

/** Materializes condition-triggered effects created by the selected relic. */
export function materializeConditionRelics(
  ctx: Gw2RelicMaterializerContext,
  relic: Gw2RelicRuntime,
  event: SimulationEvent,
): void {
  const handler = relic.rules.materializeCondition;
  if (typeof handler !== "function") return;
  handler(ctx, relic.state, event);
}

/** Returns the selected relic's additive critical-strike chance bonus. */
export function relicCriticalChanceBonus(
  ctx: Gw2RelicRuntimeContext | null | undefined,
  event: SimulationEvent,
  mightStacks: number,
): number {
  return Number(
    invokeRelicHook(ctx, "criticalChanceBonus", event, mightStacks) ?? 0,
  );
}

/**
 * Applies the selected relic's boon trigger, if any.
 */
export function handleBoonRelics(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
): void {
  invokeRelicHook(ctx, "boon", event);
}

/**
 * Applies selected relic triggers after a successful blast combo.
 */
export function handleBlastComboRelic(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
): void {
  invokeRelicHook(ctx, "blastCombo", event);
}

/**
 * Applies effects that occur after a damage event resolves.
 */
export function handleRelicDamageResolved(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
): void {
  invokeRelicHook(ctx, "damageResolved", event);
}

/**
 * Applies selected relic triggers that inspect the triggering skill after hit.
 */
export function handleRelicsAfterHit(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
  skill: Skill | null | undefined,
): void {
  invokeRelicHook(ctx, "afterHit", event, skill);
}

/**
 * Applies selected relic triggers after a condition is recorded.
 */
export function handleConditionRelics(
  ctx: Gw2RelicContext,
  application: SimulationEvent,
  conditionHelpers: Gw2ConditionHelpers,
): void {
  invokeRelicHook(ctx, "condition", application, conditionHelpers);
}

/**
 * Returns the selected relic's additive condition-duration bonus.
 */
export function relicConditionDurationBonus(
  ctx: Gw2RelicRuntimeContext | null | undefined,
  at: number,
): number {
  return Number(invokeRelicHook(ctx, "conditionDurationBonus", at) ?? 0);
}

/** Applies the selected relic's weakness/vulnerability trigger, if any. */
export function handleWeaknessVulnerabilityRelic(
  ctx: Gw2RelicRuntimeContext,
  event: SimulationEvent,
): void {
  invokeRelicHook(ctx, "weaknessVulnerability", event);
}

/**
 * Applies the selected relic's control trigger, if any.
 */
export function handleControlRelics(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
  conditionHelpers: Gw2ConditionHelpers,
): void {
  invokeRelicHook(ctx, "control", event, conditionHelpers);
}

/**
 * Applies the selected relic's explicit Peitha-event trigger, if any.
 */
export function handlePeithaRelic(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
  applyCondition: Gw2ApplyCondition,
): void {
  invokeRelicHook(ctx, "peitha", event, applyCondition);
}

/**
 * Records passive proc timelines for relics that do not need resolver state.
 */
export function recordPassiveRelicTimeline(
  ctx: Gw2RelicContext,
  events: readonly SimulationEvent[],
  rotationEndTime: number,
): void {
  invokeRelicHook(ctx, "timeline", events, rotationEndTime);
}
