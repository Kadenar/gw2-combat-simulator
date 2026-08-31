import type { ScheduledTask, SchedulerContext, SchedulerRecord, SimulationEvent } from '#gw2/platform/engine/types.js';
import { isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { createGw2CombatQuery, selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';
import {
  materializeBoonRelics,
  materializeConditionRelics,
  materializeWeaknessVulnerabilityRelic
} from '#gw2/platform/scheduler/relic-materializer.js';
import { relicConditionDurationBonus } from '#gw2/platform/equipment/relics/query.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2TriggerMaterializer } from '#gw2/platform/scheduler/types.js';
import { isSchedulerSigilPrediction } from '#gw2/platform/equipment/sigils/proc-events.js';
import { createGw2CombatObserver } from '#gw2/platform/scheduler/combat-observer.js';
import { hasStochasticCriticalFood, resolveCriticalTrigger } from '#gw2/platform/scheduler/critical-facts.js';
import {
  createMaterializerState,
  type MaterializerProfessionState
} from '#gw2/platform/scheduler/materializer-state.js';
import { createSigilProcEngine, sigilCapabilities } from '#gw2/platform/scheduler/sigil-proc-engine.js';

interface CreateGw2TriggerMaterializerOptions {
  readonly traits?: ReadonlySet<string | number> | null;
}

type MaterializerCapability =
  'combatTracking' | 'buffFacts' | 'criticalFacts' | 'procSigils' | 'relicTriggers' | 'swapSigils' | 'weaponFacts';

// This is the single source of truth for which canonical event types the
// materializer observes and why each one matters.
const EVENT_REQUIRED_CAPABILITY: Readonly<Record<string, MaterializerCapability>> = Object.freeze({
  combat_start: 'combatTracking',
  damage: 'combatTracking',
  condition: 'combatTracking',
  control: 'combatTracking',
  blind: 'combatTracking',
  buff: 'buffFacts',
  weapon_set: 'weaponFacts',
  sigil_swap: 'swapSigils',
  weakness_vulnerability: 'relicTriggers'
});

export const GW2_MATERIALIZE_EVENT_TASK = 'platform.gw2.materialize-event';

// Materializer work runs before ordinary same-time profession tasks but after
// core cast completion tasks. Derived events still receive causal event order.
const MATERIALIZER_TASK_PRIORITY = -60;

/**
 * Chronologically observes shared GW2 facts and delegates trigger effects
 * before resolver handoff. Numeric damage remains resolver-owned.
 */
export function createGw2TriggerMaterializer(
  config: Gw2Config = {},
  { traits = null }: CreateGw2TriggerMaterializerOptions = {}
): Readonly<Gw2TriggerMaterializer> {
  const sigilSupport = sigilCapabilities(config);
  const state = createMaterializerState(config, traits, sigilSupport.critical || hasStochasticCriticalFood(config));
  const observer = createGw2CombatObserver(state);
  const sigils = createSigilProcEngine(config, state);

  const capabilityEnabled: Readonly<Record<MaterializerCapability, () => boolean>> = Object.freeze({
    combatTracking: () => true,
    buffFacts: () => state.criticalFactsRequired || typeof state.relic.rules.materializeBoon === 'function',
    criticalFacts: () => state.criticalFactsRequired,
    procSigils: () => sigilSupport.anyProc,
    relicTriggers: () => typeof state.relic.rules.weaknessVulnerability === 'function',
    swapSigils: () => sigilSupport.swap,
    weaponFacts: () => true
  });

  const processEvent = (context: SchedulerContext, event: SimulationEvent): void => {
    if (isSchedulerSigilPrediction(event)) return;
    observer.observe(context, event);

    switch (event.type) {
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
        if (!state.combatActive) {
          if (state.random.stochastic) {
            resolveCriticalTrigger(context, event, state);
          }

          break;
        }

        const criticalCause = resolveCriticalTrigger(context, event, state);
        if (criticalCause) {
          sigils.materialize('crit', context, event, criticalCause);
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
      case 'weakness_vulnerability':
        if (!context.hasExplicitCombatStart || context.combatStartTime != null) {
          materializeWeaknessVulnerabilityRelic(
            {
              relic: state.relic,
              combatStartTime: context.hasExplicitCombatStart ? context.combatStartTime : null
            },
            event
          );
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
      state.profession = context.state.profession as MaterializerProfessionState;
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
      const required = EVENT_REQUIRED_CAPABILITY[event.type];
      if (!required || !capabilityEnabled[required]()) return;
      // Deferring avoids recursive mutation inside the scheduler's observation
      // callback and preserves chronology.
      context.tasks.schedule({
        type: GW2_MATERIALIZE_EVENT_TASK,
        at: Math.max(context.state.time, event.at),
        priority: MATERIALIZER_TASK_PRIORITY,
        payload: { event }
      });
    },
    handleTask(context, task: ScheduledTask<SchedulerRecord>) {
      processEvent(context, task.payload?.event as SimulationEvent);
    },
    critical(event) {
      return state.query!.critical(event, event.at, state);
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
