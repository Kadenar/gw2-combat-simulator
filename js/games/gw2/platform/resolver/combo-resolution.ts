import { gw2Time } from '#gw2/platform/combat/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { comboOutcomeRequests } from '#gw2/platform/combos/definitions.js';
import type { Gw2ComboController } from '#gw2/platform/combos/resolution.js';
import type { ComboFieldEvent, ComboFinisherEvent } from '#gw2/platform/combos/types.js';
import { ACTOR, AURA, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEventHandlers, Gw2ResolverReactionRegistry } from '#gw2/platform/resolver/types.js';

const DARK_AURA_SOURCE = 'aura.dark';
const DARK_AURA_ICD = 1;

/** A damaging field hits as soon as Dark Aura can retaliate. Overlapping grants share its cooldown. */
function scheduleDarkAuraTorment(context: Gw2ResolverRuntime, aura: Gw2ResolverEvent): void {
  if (aura.aura !== AURA.DARK || context.config.professionAssumptions?.inDamagingField !== true) return;

  // A blast grants the player an area aura even when a companion finishes the combo.
  if (aura.actorType === ACTOR.SUMMON && aura.finisherType !== COMBO_FINISHER.BLAST) return;

  const expiresAt = gw2EffectExpiresAt(aura.at, aura.duration ?? 0);
  let at = Math.max(aura.at, context.procs.deadline(DARK_AURA_SOURCE));
  while (at < expiresAt) {
    context.effects.emit({
      kind: 'packet',
      cause: aura,
      proc: true,
      event: {
        type: 'condition',
        at,
        source: AURA.DARK,
        sourceId: DARK_AURA_SOURCE,
        actorType: ACTOR.PLAYER,
        name: AURA.DARK,
        skillName: AURA.DARK,
        triggeredBy: aura.skillName,
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 2
      }
    });
    at = gw2Time(at + DARK_AURA_ICD);
    context.procs.setDeadline(DARK_AURA_SOURCE, at);
  }
}

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

      scheduleDarkAuraTorment(context, event);
      reactions.dispatch('aura.applied', context, event, undefined);
    }
  });
}
