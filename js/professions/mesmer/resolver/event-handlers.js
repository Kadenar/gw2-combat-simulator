import { EPSILON } from "../../../platform/engine/clock.js";
import {
  handleCriticalTraits,
  triggerIneptitude,
} from "../mechanics/specific/trait-rules.js";
import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";

const noop = () => {};

/**
 * Mesmer reactions to standard GW2 events. Common damage, condition, sigil,
 * relic, control, and weapon-swap behavior lives in platform/gw2.
 */
export function handleMesmerDamageEvent(
  ctx,
  event,
  { hitContext, applyCondition } = {},
) {
  if (!hitContext || typeof applyCondition !== "function") return;
  handleCriticalTraits(ctx, event, hitContext, applyCondition);
}

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

export function handleMesmerConditionEvent(
  ctx,
  _event,
  { application } = {},
) {
  if (
    !application
    || application.condition !== "Bleeding"
    || !ctx.traits.has(TRAIT.BLOODSONG)
    || application.stacks <= 0
  ) return;

  ctx.profession.bloodsongProgress += application.stacks;
  while (ctx.profession.bloodsongProgress >= 5 - EPSILON) {
    ctx.profession.bloodsongProgress -= 5;
  }
}

export const mesmerResolverEventReactions = Object.freeze({
  damage: handleMesmerDamageEvent,
  condition: handleMesmerConditionEvent,
  control: handleMesmerControlEvent,
  blind: handleMesmerBlindEvent,
});

/**
 * Exclusive Mesmer event types emitted by the existing Mesmer scheduler.
 * They are timeline/reporting signals; read-only resolver queries index them.
 */
export const mesmerResolverEventHandlers = Object.freeze({
  "mesmer.phantasm-summoned": noop,
  "mesmer.phantasm-resummoned": noop,
  "mesmer.phantasm-attack": noop,
  "mesmer.instrument": noop,
});
