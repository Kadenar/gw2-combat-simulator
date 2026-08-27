import { holosmithState } from './state.js';
import { engineerBalanceValue } from '../../core/profiles.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { HOLOSMITH_HEAT } from './mechanics.js';
import type { SkillId } from '../../../../platform/engine/types.js';
import type {
  EngineerConfig,
  EngineerResolverEvent,
  EngineerSchedulerContext,
  EngineerSimulationEvent
} from '../../types.js';

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

const PRISMATIC_SINGULARITY_STRIKE_PROFILE = PROFILE.prismaticSingularityHeatTier;

// Captures heat once while a cast is being materialized so delayed packets cannot
// silently change tier when later heat updates are resolved.
export function snapshotHolosmithHeat(context: unknown): HolosmithHeatSnapshot {
  const source = context as { readonly config?: EngineerConfig };
  return Object.freeze({
    heat: Number(holosmithState.from(context).heat || 0),
    enhancedCapacitySelected: hasTrait(source.config || {}, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
  });
}

export function holosmithHeatSnapshotFromEvent(event: unknown): HolosmithHeatSnapshot {
  const metadata = holosmithEventMetadata(event);
  return Object.freeze({
    heat: Number(metadata.holosmithActivationHeat || 0),
    enhancedCapacitySelected: metadata.holosmithEnhancedCapacitySelected === true
  });
}

export function holosmithHeatTier(snapshot: HolosmithHeatSnapshot): HolosmithHeatTier {
  if (snapshot.enhancedCapacitySelected && snapshot.heat > HOLOSMITH_HEAT.enhancedCapacityThreshold) {
    return 'enhanced';
  }

  return snapshot.heat > HOLOSMITH_HEAT.highThreshold ? 'high' : 'base';
}

export function holosmithProfileStrikeFactor(
  context: unknown,
  profileId: SkillId,
  snapshot: HolosmithHeatSnapshot
): number {
  const tier = holosmithHeatTier(snapshot);

  if (tier === 'enhanced') {
    return engineerBalanceValue(context, profileId, 'enhancedStrikeFactor', 1);
  }

  return tier === 'high' ? engineerBalanceValue(context, profileId, 'highStrikeFactor', 1) : 1;
}

export function holosmithEventStrikeFactor(context: unknown, event: unknown, fallback = 1): number {
  const metadata = holosmithEventMetadata(event);
  const capturedFactor = Number(metadata.holosmithStrikeFactor);

  if (Number.isFinite(capturedFactor)) return Math.max(0, capturedFactor);

  if (metadata.holosmithStrikeProfileId == null) return fallback;

  return holosmithProfileStrikeFactor(context, metadata.holosmithStrikeProfileId, snapshotHolosmithHeat(context));
}

function strikeProfileForEvent(event: EngineerSimulationEvent): SkillId | undefined {
  const skillId = event.skillId ?? event.sourceId;

  if (String(skillId) === String(ID.PRISMATIC_SINGULARITY)) {
    return event.damageKind === 'explosion' ? PRISMATIC_SINGULARITY_STRIKE_PROFILE : undefined;
  }

  return HEAT_STRIKE_PROFILES.get(String(skillId));
}

// Delayed custom effects capture activation heat, while direct strikes carry a
// profile identity so the resolver can preserve their existing hit-time tier.
export function decorateHolosmithHeatEvent(context: EngineerSchedulerContext, event: EngineerSimulationEvent): void {
  const holosmithEvent = event as HolosmithSimulationEvent;
  const snapshot = snapshotHolosmithHeat(context);
  const activation = {
    holosmithActivationHeat: snapshot.heat,
    holosmithEnhancedCapacitySelected: snapshot.enhancedCapacitySelected
  };

  if (event.type === 'engineer.radiant-arc-quickness') {
    const tier = holosmithHeatTier(snapshot);
    const field = tier === 'enhanced' ? 'enhancedDuration' : tier === 'high' ? 'highDuration' : 'baseDuration';
    const fallback = tier === 'enhanced' ? 6 : tier === 'high' ? 4 : 2;
    context.replaceEvent(event, {
      ...activation,
      duration: engineerBalanceValue(context, PROFILE.radiantArcHeatTier, field, fallback)
    });
    return;
  }

  if (event.type === 'engineer.refraction-cutter-extra-blades') {
    const tier = holosmithHeatTier(snapshot);
    const field = tier === 'enhanced' ? 'enhancedExtraBlades' : tier === 'high' ? 'highExtraBlades' : 'baseExtraBlades';
    const fallback = tier === 'enhanced' ? 4 : tier === 'high' ? 2 : 0;
    context.replaceEvent(event, {
      ...activation,
      extraBlades: engineerBalanceValue(context, PROFILE.refractionCutterHeatTier, field, fallback)
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

  if (event.type !== 'damage' || event.actorType !== 'player') return;
  const profileId = strikeProfileForEvent(holosmithEvent);

  if (profileId == null) return;
  context.replaceEvent(holosmithEvent, {
    holosmithStrikeProfileId: profileId
  });
}
