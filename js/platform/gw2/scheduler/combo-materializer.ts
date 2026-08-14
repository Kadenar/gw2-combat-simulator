import { createSimulationRandom } from "../../engine/simulation-random.js";
import {
  createGw2ComboRuntimeState,
  registerComboField,
  resolveComboAttempt,
} from "../combo-events.js";
import { materializeComboOutcome } from "../combo-definitions.js";
import {
  gw2BoonDurationMultiplier,
  gw2SigilSet,
  gw2StatsForWeaponSet,
} from "../runtime-rules.js";

import type {
  ScheduledTask,
  SchedulerContext,
  SchedulerRecord,
  SimulationEvent,
} from "../../engine/types.js";
import type {
  ComboEvent,
  ComboFieldEvent,
  ComboFinisherEvent,
  Gw2Config,
} from "../types.js";

export const GW2_COMBO_MATERIALIZE_EVENT_TASK =
  "platform.gw2.materialize-combo-event";

const COMBO_TASK_PRIORITY = -59;

function taskPriority(event: SimulationEvent): number {
  const eventPriority = Number(event.priority || 0);
  return (
    COMBO_TASK_PRIORITY +
    (Number.isFinite(eventPriority) ? eventPriority / 1_000_000 : 0)
  );
}

/** Chronologically predicts combo results for scheduler facts and reactions. */
export function createGw2ComboMaterializer(config: Gw2Config = {}) {
  const state = createGw2ComboRuntimeState();
  const random = createSimulationRandom(config.randomness);

  const materializer = {
    state,

    onEventScheduled(context: SchedulerContext, event: SimulationEvent): void {
      if (event.type !== "combo_field" && event.type !== "combo_finisher") {
        return;
      }
      context.tasks.schedule({
        type: GW2_COMBO_MATERIALIZE_EVENT_TASK,
        at: Math.max(context.state.time, event.at),
        priority: taskPriority(event),
        payload: { event },
      });
    },

    handleTask(
      context: SchedulerContext,
      task: ScheduledTask<SchedulerRecord>,
    ): void {
      const original = task.payload?.event as SimulationEvent;
      const event =
        context.events.find(
          (candidate) =>
            candidate.type === original.type &&
            candidate.__order === original.__order,
        ) || original;
      if (event.type === "combo_field") {
        registerComboField(state, event as ComboFieldEvent);
        return;
      }
      if (event.type !== "combo_finisher") return;
      const combos = resolveComboAttempt(state, event as ComboFinisherEvent, {
        stochastic: random.stochastic,
        roll: random.roll,
        warn(message) {
          context.warnings.push(message);
        },
      });
      for (const combo of combos) {
        const predictedCombo = context.emitDerived(event, {
          ...combo,
          schedulerPrediction: "combo-result",
        }) as ComboEvent;
        for (const outcome of materializeComboOutcome(predictedCombo)) {
          const boonDuration =
            outcome.type === "buff" && outcome.fixedDuration !== true
              ? Number(outcome.duration || 0) *
                gw2BoonDurationMultiplier(
                  String(outcome.kind || outcome.name || ""),
                  gw2StatsForWeaponSet(config, context.state.activeWeaponSet),
                  gw2SigilSet(config, context.state.activeWeaponSet),
                )
              : outcome.duration;
          context.emitDerived(predictedCombo, {
            ...outcome,
            ...(boonDuration == null ? {} : { duration: boonDuration }),
            schedulerPrediction: "combo-result",
          });
        }
      }
    },
  };

  return Object.freeze(materializer);
}
