import {
  triggerIneptitudeFromBlind,
  triggerIneptitudeFromInterrupt,
} from "../mechanics/specific/trait-rules.js";
import type {
  MesmerApplyCondition,
  MesmerResolverContext,
  MesmerResolverEvent,
} from "../types.js";

const noop = (): void => {};

interface MesmerResolverReactionDetails {
  readonly applyCondition?: MesmerApplyCondition;
}

/**
 * Mesmer reactions left in numeric resolution. Critical bleeding and
 * Bloodsong are scheduler-owned because they can change later castability.
 */
export function handleMesmerControlEvent(
  ctx: MesmerResolverContext,
  event: MesmerResolverEvent,
  { applyCondition }: MesmerResolverReactionDetails = {},
): void {
  if (
    !ctx.config.target?.activatingSkills ||
    typeof applyCondition !== "function"
  )
    return;
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

export const mesmerResolverEventReactions = Object.freeze({
  control: handleMesmerControlEvent,
  blind: handleMesmerBlindEvent,
});

export const mesmerResolverEventHandlers = Object.freeze({
  "mesmer.phantasm-summoned": noop,
  "mesmer.phantasm-resummoned": noop,
  "mesmer.phantasm-attack": noop,
  "mesmer.instrument": noop,
});
