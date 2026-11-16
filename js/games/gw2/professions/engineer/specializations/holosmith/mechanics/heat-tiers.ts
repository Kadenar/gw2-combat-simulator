/** Captures heat tiers for delayed packets and reads their admitted factors at impact. */
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { BalanceSource } from '#gw2/platform/skills/balance-profiles.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import type { HolosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import {
  enhancedCapacityHeatTier,
  enhancedCapacitySelected
} from '#gw2/professions/engineer/specializations/holosmith/traits/heat.js';
import type { EngineerConfig, EngineerResolverEvent, EngineerRuntimeState } from '#gw2/professions/engineer/types.js';

type HolosmithHeatTier = 'base' | 'high' | 'enhanced';

interface HolosmithHeatSnapshot {
  readonly heat: number;
  readonly enhancedCapacitySelected: boolean;
}

// Custom event payloads and resolver-stage results retain their handler-owned fields.
interface HolosmithEventFields {
  readonly extraBlades?: number;
  readonly holosmithActivationHeat?: number;
  readonly holosmithEnhancedCapacitySelected?: boolean;
  readonly solarFocusingLens?: boolean;
}

export type HolosmithResolverEvent = EngineerResolverEvent & HolosmithEventFields;

/** Reads the custom payload and resolver-stage fields owned by Holosmith handlers. */
export function holosmithEventFields(event: unknown): HolosmithEventFields {
  return event && typeof event === 'object' ? event : {};
}

/** Captured skill factors adjust base condition duration before ordinary duration bonuses are capped. */
export function holosmithEventConditionBaseDurationFactor(context: Gw2ModifierContext): number {
  const factor = context.event?.metadata?.holosmithConditionBaseDurationFactor ?? 1;
  return Math.max(0, factor);
}

/** Captures activation heat and ECSU selection so delayed packets retain their original tier. */
export function snapshotHolosmithHeat(
  state: Pick<HolosmithState, 'heat'>,
  config: EngineerConfig
): HolosmithHeatSnapshot {
  return Object.freeze({
    heat: state.heat.value,
    enhancedCapacitySelected: enhancedCapacitySelected(config)
  });
}

/** Reconstructs a cast-time heat snapshot from the custom event payload. */
export function holosmithHeatSnapshotFromEvent(event: unknown): HolosmithHeatSnapshot {
  const fields = holosmithEventFields(event);
  return Object.freeze({
    heat: fields.holosmithActivationHeat || 0,
    enhancedCapacitySelected: fields.holosmithEnhancedCapacitySelected === true
  });
}

/** Classifies a heat snapshot into base, high, or ECSU-enhanced skill tiers. */
export function holosmithHeatTier(snapshot: HolosmithHeatSnapshot, source: BalanceSource): HolosmithHeatTier {
  if (enhancedCapacityHeatTier(snapshot.heat, snapshot.enhancedCapacitySelected, source)) {
    return 'enhanced';
  }

  return snapshot.heat > HOLOSMITH_HEAT.highThreshold ? 'high' : 'base';
}

/** Resolves a skill's strike multiplier for a captured heat tier. */
export function holosmithSkillStrikeFactor(
  source: BalanceSource,
  skillId: SkillId,
  snapshot: HolosmithHeatSnapshot
): number {
  const tier = holosmithHeatTier(snapshot, source);

  if (tier === 'enhanced') {
    return skillNumber(requireSkill(source, skillId), 'enhancedStrikeFactor');
  }

  return tier === 'high' ? skillNumber(requireSkill(source, skillId), 'highStrikeFactor') : 1;
}

/** Reads an event's captured strike factor or evaluates its skill against current heat as a fallback. */
export function holosmithEventStrikeFactor(
  context: Gw2ModifierContext,
  event: Pick<SimulationEventBase, 'metadata'>,
  fallback = 1
): number {
  const metadata = event.metadata;
  const capturedFactor = metadata?.holosmithStrikeFactor;

  if (capturedFactor != null) return Math.max(0, capturedFactor);

  if (metadata?.holosmithStrikeSkillId == null) return fallback;

  return holosmithSkillStrikeFactor(
    context.catalog,
    metadata.holosmithStrikeSkillId,
    snapshotHolosmithHeat(
      holosmithState.from(context.runtime!.profession as EngineerRuntimeState),
      context.config || {}
    )
  );
}
