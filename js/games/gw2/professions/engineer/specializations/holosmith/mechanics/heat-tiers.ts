import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type {
  EngineerConfig,
  EngineerResolverEvent,
  EngineerSchedulerContext,
  EngineerSimulationEvent
} from '#gw2/professions/engineer/types.js';

export type HolosmithHeatTier = 'base' | 'high' | 'enhanced';

export interface HolosmithHeatSnapshot {
  readonly heat: number;
  readonly enhancedCapacitySelected: boolean;
}

// Holosmith event metadata stays local to the specialization while its packets
// still travel through the profession-neutral scheduler and resolver queues.
export interface HolosmithEventMetadata {
  readonly enhancedCapacityTier?: boolean;
  readonly extraBlades?: number;
  readonly holosmithActivationHeat?: number;
  readonly holosmithConditionBaseDurationFactor?: number;
  readonly holosmithEnhancedCapacitySelected?: boolean;
  readonly holosmithStrikeFactor?: number;
  readonly holosmithStrikeProfileId?: SkillId;
  readonly solarFocusingLens?: boolean;
}

export type HolosmithSimulationEvent = EngineerSimulationEvent & HolosmithEventMetadata;
export type HolosmithResolverEvent = EngineerResolverEvent & HolosmithEventMetadata;

/** Safely exposes Holosmith metadata fields carried by an otherwise generic event. */
export function holosmithEventMetadata(event: unknown): HolosmithEventMetadata {
  return (event && typeof event === 'object' ? event : {}) as HolosmithEventMetadata;
}

const HEAT_STRIKE_PROFILES: ReadonlyMap<string, SkillId> = new Map([
  [String(ID.SUN_EDGE), PROFILE.swordHeatTier],
  [String(ID.SUN_EDGE_ID_70514), PROFILE.swordHeatTier],
  [String(ID.SUN_RIPPER), PROFILE.swordHeatTier],
  [String(ID.GLEAM_SABER), PROFILE.swordHeatTier],
  [String(ID.BLADE_BURST), PROFILE.bladeBurstHeatTier],
  [String(ID.PARTICLE_ACCELERATOR), PROFILE.particleAcceleratorHeatTier]
]);

/** Captures activation heat and ECSU selection so delayed packets retain their original tier. */
export function snapshotHolosmithHeat(context: unknown): HolosmithHeatSnapshot {
  const source = context as { readonly config?: EngineerConfig };
  return Object.freeze({
    heat: Number(holosmithState.from(context).heat || 0),
    enhancedCapacitySelected: hasTrait(source.config || {}, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
  });
}

/** Reconstructs a cast-time heat snapshot from event metadata at resolution time. */
export function holosmithHeatSnapshotFromEvent(event: unknown): HolosmithHeatSnapshot {
  const metadata = holosmithEventMetadata(event);
  return Object.freeze({
    heat: Number(metadata.holosmithActivationHeat || 0),
    enhancedCapacitySelected: metadata.holosmithEnhancedCapacitySelected === true
  });
}

/** Classifies a heat snapshot into base, high, or ECSU-enhanced skill tiers. */
export function holosmithHeatTier(snapshot: HolosmithHeatSnapshot): HolosmithHeatTier {
  if (snapshot.enhancedCapacitySelected && snapshot.heat > HOLOSMITH_HEAT.enhancedCapacityThreshold) {
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
    return balanceProfileValueFromContext(context, profileId, 'enhancedStrikeFactor', 1);
  }

  return tier === 'high' ? balanceProfileValueFromContext(context, profileId, 'highStrikeFactor', 1) : 1;
}

/** Reads an event's captured strike factor or evaluates its profile against current heat as a fallback. */
export function holosmithEventStrikeFactor(context: unknown, event: unknown, fallback = 1): number {
  const metadata = holosmithEventMetadata(event);
  const capturedFactor = Number(metadata.holosmithStrikeFactor);
  if (Number.isFinite(capturedFactor)) return Math.max(0, capturedFactor);
  if (metadata.holosmithStrikeProfileId == null) return fallback;

  return holosmithProfileStrikeFactor(context, metadata.holosmithStrikeProfileId, snapshotHolosmithHeat(context));
}

/** Maps eligible direct strike packets to the balance profile that owns their heat scaling. */
function strikeProfileForEvent(event: EngineerSimulationEvent): SkillId | undefined {
  const skillId = event.skillId ?? event.sourceId;
  return HEAT_STRIKE_PROFILES.get(String(skillId));
}

/** Decorates delayed effects with activation heat and direct strikes with their heat-scaling profile. */
export function decorateHolosmithHeatEvent(context: EngineerSchedulerContext, event: EngineerSimulationEvent): void {
  const holosmithEvent = event as HolosmithSimulationEvent;
  const snapshot = snapshotHolosmithHeat(context);
  const activation = {
    holosmithActivationHeat: snapshot.heat,
    holosmithEnhancedCapacitySelected: snapshot.enhancedCapacitySelected
  };

  // Fully materialize custom-event tier values that the resolver cannot derive from a generic packet.
  if (event.type === 'engineer.radiant-arc-quickness') {
    const tier = holosmithHeatTier(snapshot);
    const field = tier === 'enhanced' ? 'enhancedDuration' : tier === 'high' ? 'highDuration' : 'baseDuration';
    const fallback = tier === 'enhanced' ? 6 : tier === 'high' ? 4 : 2;
    context.replaceEvent(event, {
      ...activation,
      duration: balanceProfileValueFromContext(context, PROFILE.radiantArcHeatTier, field, fallback)
    });
    return;
  }

  if (event.type === 'engineer.refraction-cutter-extra-blades') {
    const tier = holosmithHeatTier(snapshot);
    const field = tier === 'enhanced' ? 'enhancedExtraBlades' : tier === 'high' ? 'highExtraBlades' : 'baseExtraBlades';
    const fallback = tier === 'enhanced' ? 4 : tier === 'high' ? 2 : 0;
    context.replaceEvent(event, {
      ...activation,
      extraBlades: balanceProfileValueFromContext(context, PROFILE.refractionCutterHeatTier, field, fallback)
    });
    return;
  }

  if (
    event.type === 'engineer.laser-disk' ||
    event.type === 'engineer.launch-wall' ||
    event.type === 'engineer.prime-light-beam-field'
  ) {
    context.replaceEvent(event, activation);
    return;
  }

  // Direct player strikes defer their factor lookup until modifier resolution.
  if (event.type !== 'damage' || event.actorType !== 'player') return;
  const profileId = strikeProfileForEvent(holosmithEvent);
  if (profileId == null) return;
  context.replaceEvent(holosmithEvent, {
    holosmithStrikeProfileId: profileId
  });
}
