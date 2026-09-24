import type { Gw2RelicMaterializerContext, Gw2RelicRuntime } from '#gw2/platform/equipment/relics/types.js';
import type { CriticalSigilDiagnostics } from '#gw2/platform/equipment/sigils/diagnostics.js';
import { EPSILON } from '#kernel/core/clock.js';
import type { ScheduledTask, SchedulerContext } from '#gw2/platform/execution/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { isPrecombatTargetEffect, missesTarget } from '#gw2/platform/combat/state/targets.js';
import { createGw2CombatQuery } from '#gw2/platform/combat/query/combat-query.js';
import { selectedGw2TraitValues } from '#gw2/platform/combat/state/traits.js';
import { relicConditionDurationBonus } from '#gw2/platform/equipment/relics/query.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2TriggerMaterializer, MaterializeEventTaskPayload } from '#gw2/platform/execution/gw2-policy/types.js';
import { isSchedulerSigilPrediction } from '#gw2/platform/equipment/sigils/proc-events.js';
import { createGw2CombatObserver } from '#gw2/platform/execution/gw2-policy/combat-observer.js';
import {
  hasStochasticCriticalFood,
  sampleScheduledCritical
} from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { createMaterializerState } from '#gw2/platform/execution/gw2-policy/materializer-state.js';
import { createSigilProcEngine, sigilCapabilities } from '#gw2/platform/execution/gw2-policy/sigil-proc-engine.js';

interface CreateGw2TriggerMaterializerOptions {
  readonly sigilDiagnostics?: CriticalSigilDiagnostics;
  readonly traits?: ReadonlySet<string | number> | null;
}

type MaterializerCapability = 'combatTracking' | 'buffFacts' | 'swapSigils' | 'weaponFacts' | 'relicActions';

// This is the single source of truth for which canonical event types the
// materializer observes and why each one matters.
const EVENT_REQUIRED_CAPABILITY: Readonly<Record<string, MaterializerCapability>> = Object.freeze({
  action: 'relicActions',
  combat_start: 'combatTracking',
  damage: 'combatTracking',
  condition: 'combatTracking',
  control: 'combatTracking',
  blind: 'combatTracking',
  buff: 'buffFacts',
  boon_extension: 'buffFacts',
  weapon_set: 'weaponFacts',
  sigil_swap: 'swapSigils'
});

export const GW2_MATERIALIZE_EVENT_TASK = 'platform.gw2.materialize-event';

// Materializer work runs before ordinary same-time profession tasks but after
// core cast completion tasks. Derived events still receive causal event order.
const MATERIALIZER_TASK_PRIORITY = -60;

/** Match resolver event precedence inside the shared fact/combination task band. */
export function gw2MaterializerTaskPriority(event: SimulationEvent): number {
  const priority = Number(event.priority || 0);
  return MATERIALIZER_TASK_PRIORITY + (Number.isFinite(priority) ? priority / 1_000_000 : 0);
}

/**
 * Chronologically observes shared GW2 facts and delegates trigger effects
 * before resolver handoff. Numeric damage remains resolver-owned.
 */
export function createGw2TriggerMaterializer(
  config: Gw2Config = {},
  { traits = null, sigilDiagnostics }: CreateGw2TriggerMaterializerOptions = {}
): Readonly<Gw2TriggerMaterializer> {
  const sigilSupport = sigilCapabilities(config);
  const state = createMaterializerState(config, traits, sigilSupport.critical || hasStochasticCriticalFood(config));
  const observer = createGw2CombatObserver(state);
  const sigils = createSigilProcEngine(config, state, sigilDiagnostics);
  const criticalFacts = new WeakMap<SimulationEvent, ReturnType<NonNullable<typeof state.query>['critical']>>();

  const capabilityEnabled: Readonly<Record<MaterializerCapability, () => boolean>> = Object.freeze({
    combatTracking: () => true,
    buffFacts: () => state.criticalFactsRequired || typeof state.relic.rules.materializeBoon === 'function',
    swapSigils: () => sigilSupport.swap,
    weaponFacts: () => true,
    relicActions: () => typeof state.relic.rules.materializeAction === 'function'
  });

  const processEvent = (context: SchedulerContext, event: SimulationEvent): void => {
    // Missed hostile packets cannot establish combat facts or spend hit-dependent procs.
    if (missesTarget(event) || event.cancelled === true) return;
    // Rejected target effects cannot seed conditions, consume random rolls or trigger equipment during setup.
    if (
      context.hasExplicitCombatStart &&
      (context.combatStartTime == null || event.at < context.combatStartTime) &&
      isPrecombatTargetEffect(event)
    )
      return;
    if (isSchedulerSigilPrediction(event)) {
      // Predicted conditions supply scheduling facts, never recursive equipment reactions.
      if (event.type === 'condition') observer.observe(context, event);
      return;
    }

    observer.observe(context, event);

    switch (event.type) {
      case 'action':
        materializeActionRelics(context, state.relic, event);
        break;
      case 'buff':
        // Generic buffs share the timed-status event without counting as boons
        // for relic triggers.
        if (isStandardBoon(event.kind || event.boon)) {
          materializeBoonRelics(context, state.relic, event);
        }

        break;
      case 'condition':
        materializeConditionRelics(context, state.relic, event);
        break;
      case 'damage': {
        // Trigger decisions and later same-time trait tasks share this hit's pre-reaction critical chance.
        const critical =
          state.criticalFactsRequired && Number.isFinite(event.eventOrder)
            ? state.query!.critical(event, event.at, state)
            : undefined;
        if (critical) criticalFacts.set(event, critical);

        const canonical = sampleScheduledCritical(context, event, state, critical);
        if (!state.combatActive) break;
        if (sigilSupport.critical && critical) {
          sigils.materializeCritical(context, canonical, critical);
        }

        sigils.consumeDoom(context, event);
        if (sigilSupport.strike && isGw2PlayerActorEvent(event) && Number(event.coefficient) > 0) {
          sigils.materialize('strike', context, event);
        }

        break;
      }

      case 'control':
        if (state.combatActive) {
          sigils.materialize('control', context, event);
        }

        break;
      case 'weapon_set':
      case 'sigil_swap':
        if (state.combatActive) {
          sigils.materialize('swap', context, event);
        }

        break;
      default:
        break;
    }
  };

  const materializer: Gw2TriggerMaterializer = {
    state,
    initialize(context) {
      state.traits = traits || selectedGw2TraitValues(config, context.profession.catalog);
      state.state = context.state;
      state.activeWeaponSet = context.state.activeWeaponSet;
      state.query = createGw2CombatQuery({
        profession: context.profession,
        config,
        events: context.events,
        traits: state.traits,
        conditionDurationBonus: relicConditionDurationBonus
      });
    },
    onEventScheduled(context, event) {
      // A chronological trait task emits predictions after its hit's facts; expose them before the next same-time hit.
      if (
        (event.schedulerBoonPrediction === true || (isSchedulerSigilPrediction(event) && event.type === 'condition')) &&
        event.at <= context.state.time + EPSILON
      ) {
        observer.observe(context, event);
        return;
      }

      const required = EVENT_REQUIRED_CAPABILITY[event.type];
      if (!required || !capabilityEnabled[required]()) return;
      // Resolve the current event at execution time so deferred facts include intervening replacements.
      context.tasks.schedule({
        type: GW2_MATERIALIZE_EVENT_TASK,
        at: Math.max(context.state.time, event.at),
        priority: gw2MaterializerTaskPriority(event),
        payload: { eventOrder: event.eventOrder }
      });
    },
    handleTask(context, task: ScheduledTask<MaterializeEventTaskPayload>) {
      const event = context.eventByOrder(Number(task.payload?.eventOrder));
      if (!event) throw new TypeError('Materializer task requires a scheduled event.');
      processEvent(context, event);
    },
    onEventReplaced(previous, replacement) {
      state.query!.timeline.onEventReplaced(previous, replacement);
      // Canonical replacements retain observed facts; hypothetical copies still query their own timestamp.
      const critical = criticalFacts.get(previous);
      if (critical) criticalFacts.set(replacement, critical);
    },
    critical(event) {
      return criticalFacts.get(event) ?? state.query!.critical(event, event.at, state);
    },
    rollRandom(probability, stream) {
      return state.random.roll(probability, stream);
    },
    isCombatActive() {
      return state.combatActive;
    },
    combatBeganAt() {
      return state.combatBeganAt;
    },
    requireCriticalFacts() {
      state.criticalFactsRequired = true;
    }
  };
  return Object.freeze(materializer);
}

/** Materializes boon applications created by the selected relic. */
function materializeBoonRelics(ctx: Gw2RelicMaterializerContext, relic: Gw2RelicRuntime, event: SimulationEvent): void {
  if (!isStandardBoon(event.kind || event.boon)) return;
  const handler = relic.rules.materializeBoon;
  if (typeof handler !== 'function') return;
  handler(ctx, relic.state, event);
}

/** Materializes activation-triggered facts created by the selected relic from the activation's catalog skill. */
function materializeActionRelics(context: SchedulerContext, relic: Gw2RelicRuntime, event: SimulationEvent): void {
  const handler = relic.rules.materializeAction;
  if (typeof handler !== 'function') return;
  handler(context, relic.state, event, skillForEvent(context.catalog, event));
}

/** Materializes condition-triggered effects created by the selected relic. */
function materializeConditionRelics(
  ctx: Gw2RelicMaterializerContext,
  relic: Gw2RelicRuntime,
  event: SimulationEvent
): void {
  const handler = relic.rules.materializeCondition;
  if (typeof handler !== 'function') return;
  handler(ctx, relic.state, event);
}
