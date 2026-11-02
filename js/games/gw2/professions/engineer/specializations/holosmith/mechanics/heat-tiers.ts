import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { skillNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
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

// Holosmith event metadata stays local to the specialization while its packets
// travel through the shared live queue.
interface HolosmithEventMetadata {
  readonly extraBlades?: number;
  readonly holosmithActivationHeat?: number;
  readonly holosmithConditionBaseDurationFactor?: number;
  readonly holosmithEnhancedCapacitySelected?: boolean;
  readonly holosmithStrikeFactor?: number;
  readonly holosmithStrikeSkillId?: SkillId;
  readonly solarFocusingLens?: boolean;
}

export type HolosmithResolverEvent = EngineerResolverEvent & HolosmithEventMetadata;

/** Safely exposes Holosmith metadata fields carried by an otherwise generic event. */
export function holosmithEventMetadata(event: unknown): HolosmithEventMetadata {
  return event && typeof event === 'object' ? event : {};
}

/** Captured skill factors adjust base condition duration before ordinary duration bonuses are capped. */
export function holosmithEventConditionBaseDurationFactor(context: Gw2ModifierContext): number {
  const factor = holosmithEventMetadata(context.event).holosmithConditionBaseDurationFactor ?? 1;
  return Number.isFinite(factor) ? Math.max(0, factor) : 1;
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

/** Reconstructs a cast-time heat snapshot from event metadata at resolution time. */
export function holosmithHeatSnapshotFromEvent(event: unknown): HolosmithHeatSnapshot {
  const metadata = holosmithEventMetadata(event);
  return Object.freeze({
    heat: metadata.holosmithActivationHeat || 0,
    enhancedCapacitySelected: metadata.holosmithEnhancedCapacitySelected === true
  });
}

/** Classifies a heat snapshot into base, high, or ECSU-enhanced skill tiers. */
export function holosmithHeatTier(snapshot: HolosmithHeatSnapshot, context: unknown): HolosmithHeatTier {
  if (enhancedCapacityHeatTier(snapshot.heat, snapshot.enhancedCapacitySelected, context)) {
    return 'enhanced';
  }

  return snapshot.heat > HOLOSMITH_HEAT.highThreshold ? 'high' : 'base';
}

/** Resolves a skill's strike multiplier for a captured heat tier. */
export function holosmithSkillStrikeFactor(
  context: unknown,
  skillId: SkillId,
  snapshot: HolosmithHeatSnapshot
): number {
  const tier = holosmithHeatTier(snapshot, context);

  if (tier === 'enhanced') {
    return skillNumberFromContext(context, skillId, 'enhancedStrikeFactor');
  }

  return tier === 'high' ? skillNumberFromContext(context, skillId, 'highStrikeFactor') : 1;
}

/** Reads an event's captured strike factor or evaluates its skill against current heat as a fallback. */
export function holosmithEventStrikeFactor(context: Gw2ModifierContext, event: unknown, fallback = 1): number {
  const metadata = holosmithEventMetadata(event);
  const capturedFactor = Number(metadata.holosmithStrikeFactor);

  if (Number.isFinite(capturedFactor)) return Math.max(0, capturedFactor);

  if (metadata.holosmithStrikeSkillId == null) return fallback;

  return holosmithSkillStrikeFactor(
    context,
    metadata.holosmithStrikeSkillId,
    snapshotHolosmithHeat(
      holosmithState.from(context.runtime!.profession as EngineerRuntimeState),
      context.config || {}
    )
  );
}
