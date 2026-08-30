import {
  triggerIneptitudeFromBlind,
  triggerIneptitudeFromInterrupt
} from '#gw2/content/professions/mesmer/core/traits/index.js';
import type { MesmerResolverContext, MesmerResolverEvent } from '#gw2/content/professions/mesmer/types.js';

const noop = (): void => {};

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

export const mesmerCoreEventHandlers = Object.freeze({
  'mesmer.phantasm-summoned': noop,
  'mesmer.phantasm-attack': noop
});
