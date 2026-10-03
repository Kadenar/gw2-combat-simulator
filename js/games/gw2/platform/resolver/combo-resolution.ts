import { materializeComboOutcome } from '#gw2/platform/combos/definitions.js';
import { registerComboField, resolveComboAttempt } from '#gw2/platform/combos/events.js';

import type { ComboFieldEvent, ComboFinisherEvent } from '#gw2/platform/combos/types.js';
import type {
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverReactionRegistry
} from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';

/** Resolver-authoritative registration, binding, chance, and materialization. */
export function createGw2ComboResolution({
  reactions
}: {
  readonly reactions: Gw2ResolverReactionRegistry;
}): Gw2ResolverEventHandlers {
  return Object.freeze({
    combo_field(context, event) {
      registerComboField(context.combo, event as ComboFieldEvent);
    },

    combo_finisher(context, event) {
      const combos = resolveComboAttempt(context.combo, event as ComboFinisherEvent, {
        roll: context.random.roll,
        warn(message) {
          context.warnings.push(message);
        }
      });
      for (const combo of combos) {
        context.effects.emit({ kind: 'packet', event: combo });
        for (const outcome of materializeComboOutcome(combo)) {
          context.effects.emit({ kind: 'packet', durationContext: combo, event: outcome });
        }
      }
    },

    combo(context, event) {
      if (context.reporting) context.resolved.push(event);
      reactions.dispatch('combo.resolved', context, event);
    },

    aura(context: Gw2ResolverRuntime, event: Gw2ResolverEvent) {
      if (context.reporting) context.resolved.push(event);
      reactions.dispatch('aura.applied', context, event);
    }
  });
}
