import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/engine/resolution/handler-registry.js';
import {
  triggerIneptitudeFromBlind,
  triggerIneptitudeFromInterrupt
} from '#gw2/professions/mesmer/core/traits/index.js';
import type { MesmerResolverContext, MesmerResolverEvent } from '#gw2/professions/mesmer/types.js';

export function handleMesmerControlEvent(ctx: MesmerResolverContext, event: MesmerResolverEvent): void {
  if (!ctx.config.target?.activatingSkills) {
    return;
  }

  triggerIneptitudeFromInterrupt(ctx, event);
}

export function handleMesmerBlindEvent(ctx: MesmerResolverContext, event: MesmerResolverEvent): void {
  triggerIneptitudeFromBlind(ctx, event);
}

export const mesmerCoreEventReactions = Object.freeze({
  control: handleMesmerControlEvent,
  blind: handleMesmerBlindEvent
});

/** Phantasm markers remain observable without applying resolver mutations. */
export const mesmerCoreEventHandlers = Object.freeze({
  'mesmer.phantasm-summoned': OBSERVABLE_EVENT_HANDLER,
  'mesmer.phantasm-attack': OBSERVABLE_EVENT_HANDLER
});
