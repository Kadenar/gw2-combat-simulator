import {
  triggerIneptitudeFromBlind,
  triggerIneptitudeFromInterrupt,
} from "./traits.js";
import type {
  MesmerApplyCondition,
  MesmerResolverContext,
  MesmerResolverEvent,
} from "../types.js";

const noop = (): void => {};

interface MesmerResolverReactionDetails {
  readonly applyCondition?: MesmerApplyCondition;
}

export function handleMesmerControlEvent(
  ctx: MesmerResolverContext,
  event: MesmerResolverEvent,
  { applyCondition }: MesmerResolverReactionDetails = {},
): void {
  if (
    !ctx.config.target?.activatingSkills ||
    typeof applyCondition !== "function"
  ) {
    return;
  }
  triggerIneptitudeFromInterrupt(ctx, event, applyCondition);
}

export function handleMesmerBlindEvent(
  ctx: MesmerResolverContext,
  event: MesmerResolverEvent,
  { applyCondition }: MesmerResolverReactionDetails = {},
): void {
  if (typeof applyCondition !== "function") return;
  triggerIneptitudeFromBlind(ctx, event, applyCondition);
}

export const mesmerCoreEventReactions = Object.freeze({
  control: handleMesmerControlEvent,
  blind: handleMesmerBlindEvent,
});

export const mesmerCoreEventHandlers = Object.freeze({
  "mesmer.phantasm-summoned": noop,
  "mesmer.phantasm-attack": noop,
});
