import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import {
  enhancedCapacityHeatTier,
  enhancedCapacitySelected
} from '#gw2/professions/engineer/specializations/holosmith/traits/heat.js';

import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import type { EngineerConfig, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

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
  readonly holosmithStrikeProfileId?: SkillId;
  readonly solarFocusingLens?: boolean;
}

export type HolosmithResolverEvent = EngineerResolverEvent & HolosmithEventMetadata;

/** Safely exposes Holosmith metadata fields carried by an otherwise generic event. */
export function holosmithEventMetadata(event: unknown): HolosmithEventMetadata {
  return event && typeof event === 'object' ? event : {};
}

/** Captures activation heat and ECSU selection so delayed packets retain their original tier. */
export function snapshotHolosmithHeat(context: unknown): HolosmithHeatSnapshot {
  const source = context as { readonly config?: EngineerConfig };
  return Object.freeze({
    heat: holosmithState.from(context).heat || 0,
    enhancedCapacitySelected: enhancedCapacitySelected(source.config || {})
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
export function holosmithHeatTier(snapshot: HolosmithHeatSnapshot): HolosmithHeatTier {
  if (enhancedCapacityHeatTier(snapshot.heat, snapshot.enhancedCapacitySelected)) {
    return 'enhanced';
  }

  return snapshot.heat > HOLOSMITH_HEAT.highThreshold ? 'high' : 'base';
}

/** Resolves a profile's strike multiplier for a captured heat tier. */
export function holosmithProfileStrikeFactor(
  context: unknown,
  profileId: SkillId,
  snapshot: HolosmithHeatSnapshot
): number {
  const tier = holosmithHeatTier(snapshot);
  if (tier === 'enhanced') {
    const profile = requireBalanceProfileFromContext(context, profileId);
    return balanceProfileNumber(profile, 'enhancedStrikeFactor');
  }

  return tier === 'high'
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, profileId), 'highStrikeFactor')
    : 1;
}

/** Reads an event's captured strike factor or evaluates its profile against current heat as a fallback. */
export function holosmithEventStrikeFactor(context: unknown, event: unknown, fallback = 1): number {
  const metadata = holosmithEventMetadata(event);
  const capturedFactor = Number(metadata.holosmithStrikeFactor);
  if (Number.isFinite(capturedFactor)) return Math.max(0, capturedFactor);
  if (metadata.holosmithStrikeProfileId == null) return fallback;

  return holosmithProfileStrikeFactor(context, metadata.holosmithStrikeProfileId, snapshotHolosmithHeat(context));
}
