import {
  triggerIneptitude,
} from "../mechanics/specific/trait-rules.js";

const noop = () => {};

/**
 * Mesmer reactions left in numeric resolution. Critical bleeding and
 * Bloodsong are scheduler-owned because they can change later castability.
 */
export function handleMesmerControlEvent(
  ctx,
  event,
  { applyCondition } = {},
) {
  if (
    !ctx.config.target?.activatingSkills
    || typeof applyCondition !== "function"
  ) return;
  triggerIneptitude(
    ctx,
    event,
    "interrupt → blind → confusion",
    applyCondition,
  );
}

export function handleMesmerBlindEvent(
  ctx,
  event,
  { applyCondition } = {},
) {
  if (typeof applyCondition !== "function") return;
  triggerIneptitude(ctx, event, "blind → confusion", applyCondition);
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
