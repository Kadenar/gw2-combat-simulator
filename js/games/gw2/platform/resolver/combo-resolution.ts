import { comboOutcomeRequests } from '#gw2/platform/combos/definitions.js';
import type { Gw2ComboController } from '#gw2/platform/combos/resolution.js';
import type { ComboFieldEvent, ComboFinisherEvent } from '#gw2/platform/combos/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEventHandlers, Gw2ResolverReactionRegistry } from '#gw2/platform/resolver/types.js';

/** Dispatch combo operations at their existing phases while the combo controller retains fields and attempt claims. */
export function createGw2ComboResolution({
  controller,
  reactions
}: {
  readonly controller: Gw2ComboController;
  readonly reactions: Gw2ResolverReactionRegistry;
}): Gw2ResolverEventHandlers {
  return Object.freeze({
    combo_field(_context, event) {
      controller.register(event as ComboFieldEvent);
    },

    combo_finisher(context, event) {
      const combos = controller.resolve(event as ComboFinisherEvent, { roll: context.random.roll });
      for (const combo of combos) {
        context.effects.emit({ kind: 'packet', event: combo });
        // Outcome requests keep boon lineage with profile expansion and retain the finisher's duration context.
        for (const request of comboOutcomeRequests(combo)) context.effects.emit(request);
      }
    },

    combo(context, event) {
      if (context.retainsResolved(event)) context.resolved.push(event);

      reactions.dispatch('combo.resolved', context, event, undefined);
    },

    aura(context: Gw2ResolverRuntime, event: Gw2ResolverEvent) {
      if (context.retainsResolved(event)) context.resolved.push(event);

      reactions.dispatch('aura.applied', context, event, undefined);
    }
  });
}
