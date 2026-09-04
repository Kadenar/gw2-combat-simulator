/** Applies relic reactions only after resolver events have acquired chronological combat facts. */
import type { SimulationEvent } from '#gw2/platform/engine/events/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import { invokeRelicHook } from '#gw2/platform/equipment/relics/runtime.js';
import type {
  Gw2ApplyCondition,
  Gw2ConditionHelpers,
  Gw2RelicContext,
  Gw2RelicRuntimeContext
} from '#gw2/platform/equipment/relics/types.js';

/**
 * Applies the selected relic's boon trigger, if any.
 */
export function handleBoonRelics(ctx: Gw2RelicContext, event: SimulationEvent): void {
  if (!isStandardBoon(event.kind || event.boon)) return;
  invokeRelicHook(ctx, 'boon', event);
}

/** Applies selected relic triggers after a successful combo; each relic gates the eligible finisher types. */
export function handleComboRelic(ctx: Gw2RelicContext, event: SimulationEvent): void {
  invokeRelicHook(ctx, 'combo', event);
}

/**
 * Applies effects that occur after a damage event resolves.
 */
export function handleRelicDamageResolved(ctx: Gw2RelicContext, event: SimulationEvent): void {
  invokeRelicHook(ctx, 'damageResolved', event);
}

/**
 * Applies selected relic triggers that inspect the triggering skill after hit.
 */
export function handleRelicsAfterHit(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
  skill: Skill | null | undefined
): void {
  invokeRelicHook(ctx, 'afterHit', event, skill);
}

/**
 * Applies selected relic triggers after a condition is recorded.
 */
export function handleConditionRelics(
  ctx: Gw2RelicContext,
  application: SimulationEvent,
  conditionHelpers: Gw2ConditionHelpers
): void {
  invokeRelicHook(ctx, 'condition', application, conditionHelpers);
}

/** Applies the selected relic's weakness/vulnerability trigger, if any. */
export function handleWeaknessVulnerabilityRelic(ctx: Gw2RelicRuntimeContext, event: SimulationEvent): void {
  invokeRelicHook(ctx, 'weaknessVulnerability', event);
}

/**
 * Applies the selected relic's control trigger, if any.
 */
export function handleControlRelics(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
  conditionHelpers: Gw2ConditionHelpers
): void {
  invokeRelicHook(ctx, 'control', event, conditionHelpers);
}

/**
 * Applies the selected relic's explicit Peitha-event trigger, if any.
 */
export function handlePeithaRelic(
  ctx: Gw2RelicContext,
  event: SimulationEvent,
  applyCondition: Gw2ApplyCondition
): void {
  invokeRelicHook(ctx, 'peitha', event, applyCondition);
}
