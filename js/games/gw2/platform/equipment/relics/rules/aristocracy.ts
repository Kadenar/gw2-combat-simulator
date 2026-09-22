/** Aristocracy relic rules. */
import { EPSILON, isInternalCooldownReady, isTimeInWindow } from '#kernel/core/clock.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  defineRelic,
  compareTimelineEvents,
  explicitCombatStartTime
} from '#gw2/platform/equipment/relics/rules/shared.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2RelicState } from '#gw2/platform/equipment/relics/types.js';

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
}

function createAristocracyState(): AristocracyState {
  return {
    readyAt: 0,
    stacks: 0,
    expiresAt: 0,
    activations: []
  };
}

/** Only real landed player applications and explicitly player-owned effects can grant stacks. */
function isAristocracyApplication(event: SimulationEvent): boolean {
  return (
    event.type === 'condition' &&
    !missesTarget(event) &&
    (isGw2PlayerActorEvent(event) || (event.actorType === 'effect' && event.ownerActorType === 'player')) &&
    (event.condition === 'Weakness' || event.condition === 'Vulnerability') &&
    Number(event.stacks) > 0 &&
    Number(event.duration) > 0
  );
}

function applyAristocracyTrigger(state: AristocracyState, event: SimulationEvent): AristocracyActivation | null {
  if (!isAristocracyApplication(event) || !isInternalCooldownReady(event.at, state.readyAt)) {
    return null;
  }

  if (event.at >= state.expiresAt) state.stacks = 0;
  state.stacks = Math.min(ARISTOCRACY_MAX_STACKS, state.stacks + 1);
  state.expiresAt = gw2EffectExpiresAt(event.at, ARISTOCRACY_DURATION);
  state.readyAt = event.at + ARISTOCRACY_INTERNAL_COOLDOWN;
  const activation = {
    at: event.at,
    expiresAt: state.expiresAt,
    stacks: state.stacks,
    event
  };
  state.activations.push(activation);
  return activation;
}

function replayAristocracyTimeline(events: readonly SimulationEvent[], combatStartTime: number): AristocracyState {
  const state = createAristocracyState();
  const ordered = [...events]
    .filter((event) => isAristocracyApplication(event) && event.at >= combatStartTime - EPSILON)
    .sort(compareTimelineEvents);
  for (const event of ordered) applyAristocracyTrigger(state, event);
  return state;
}

function syncAristocracyTimeline(state: AristocracyState): void {
  const events = state.timelineEvents;
  if (!events || state.timelineLength === events.length) return;
  const replay = replayAristocracyTimeline(events, explicitCombatStartTime(events));
  state.readyAt = replay.readyAt;
  state.stacks = replay.stacks;
  state.expiresAt = replay.expiresAt;
  state.activations = replay.activations;
  state.timelineLength = events.length;
}

// syncAristocracyTimeline replays only when the event array has grown since the
// last call — this lazily keeps historical query state in sync with new events.
function aristocracyActivationAt(state: AristocracyState, at: number): AristocracyActivation | null {
  syncAristocracyTimeline(state);
  for (let index = state.activations.length - 1; index >= 0; index -= 1) {
    const activation = state.activations[index];
    // A triggering application cannot benefit from its own same-time stack.
    if (activation.at >= at) continue;
    return isTimeInWindow(at, activation.at, activation.expiresAt) ? activation : null;
  }

  return null;
}

export const aristocracy = defineRelic({
  createState: createAristocracyState,
  // Scheduler state and resolver state consume the same condition fact independently.
  materializeCondition(ctx, state, event) {
    if (ctx.hasExplicitCombatStart && ctx.combatStartTime == null) return;
    if (ctx.combatStartTime != null && event.at < ctx.combatStartTime - EPSILON) return;
    applyAristocracyTrigger(state as AristocracyState, event);
  },
  condition(ctx, state, event) {
    if (ctx.combatStartTime != null && event.at < ctx.combatStartTime - EPSILON) return;
    applyAristocracyTrigger(state as AristocracyState, event);
  },
  timeline(ctx, _state, events) {
    const replay = replayAristocracyTimeline(events, ctx.combatStartTime ?? -Infinity);
    for (const activation of replay.activations) {
      ctx.recordProc(
        'relic',
        'Relic of Aristocracy',
        activation.at,
        activation.event.skillName,
        `${activation.stacks}/${ARISTOCRACY_MAX_STACKS} stacks`,
        '',
        null,
        activation.expiresAt,
        { stacks: activation.stacks, maximumStacks: ARISTOCRACY_MAX_STACKS }
      );
    }
  },
  conditionDurationBonus(_ctx, state, at) {
    const activation = aristocracyActivationAt(state as AristocracyState, at);
    return activation ? activation.stacks * ARISTOCRACY_BONUS_PER_STACK : 0;
  }
});
