import { enqueueOrdered } from "../../engine/event-queue.js";
import { materializeComboOutcome } from "../combo-definitions.js";
import { registerComboField, resolveComboAttempt } from "../combo-events.js";
import { gw2BoonDurationMultiplier, gw2SigilSet } from "../runtime-rules.js";

import type {
  ComboEvent,
  ComboFieldEvent,
  ComboFinisherEvent,
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverReactionRegistry,
  Gw2ResolverRuntime,
} from "../types.js";

/** Resolver-authoritative registration, binding, chance, and materialization. */
export function createGw2ComboResolution({
  reactions,
}: {
  readonly reactions: Gw2ResolverReactionRegistry;
}): Gw2ResolverEventHandlers {
  return Object.freeze({
    combo_field(context, event) {
      registerComboField(context.combo, event as ComboFieldEvent);
    },

    combo_finisher(context, event) {
      const combos = resolveComboAttempt(
        context.combo,
        event as ComboFinisherEvent,
        {
          stochastic: context.random.stochastic,
          roll: context.random.roll,
          warn(message) {
            context.warnings.push(message);
          },
        },
      );
      for (const combo of combos) {
        enqueueOrdered(context.queue, combo as Gw2ResolverEvent);
        for (const outcome of materializeComboOutcome(combo)) {
          if (outcome.type === "buff" && outcome.fixedDuration !== true) {
            const stats = context.query.statsAt(
              combo.at,
              combo as Gw2ResolverEvent,
              context,
            );
            enqueueOrdered(context.queue, {
              ...outcome,
              duration:
                Number(outcome.duration || 0) *
                gw2BoonDurationMultiplier(
                  String(outcome.kind || outcome.name || ""),
                  stats,
                  gw2SigilSet(context.config, context.activeWeaponSet),
                ),
            } as Gw2ResolverEvent);
          } else {
            enqueueOrdered(context.queue, outcome as Gw2ResolverEvent);
          }
        }
      }
    },

    combo(context, event) {
      context.resolved.push(event);
      reactions.dispatch("combo.resolved", context, event);
      if ((event as ComboEvent).finisherType === "Blast") {
        reactions.dispatch("blast-combo.resolved", context, event);
      }
    },

    aura(context: Gw2ResolverRuntime, event: Gw2ResolverEvent) {
      context.resolved.push(event);
      reactions.dispatch("aura.applied", context, event);
    },
  });
}
