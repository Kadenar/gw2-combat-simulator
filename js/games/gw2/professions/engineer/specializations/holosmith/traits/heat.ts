import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerConfig } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';
import { HOLOSMITH_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';

/** Emit one Might pulse after the caller has accepted its heat threshold or scheduled lifetime. */
export function emitEnhancedCapacityMight(context: EngineerRuntime, at: number): void {
  const enhancedCapacityProfile = requireBalanceProfileFromContext(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  const boon = requireEffect(enhancedCapacityProfile, 'boon', 'might');
  if (boon) {
    emitEngineerEvent(context, 'buff', {
      at,
      source: 'Trait',
      sourceId: TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
      actorType: 'player',
      name: 'Enhanced Capacity Storage Unit — might',
      kind: String(boon.boon).toLowerCase(),
      duration: boon.duration,
      stacks: Number(boon.stacks)
    });
  }
}

/** Crossing the threshold grants the first pulse immediately and starts the existing scheduled cadence. */
export function triggerInstantEnhancedCapacityMight(context: EngineerRuntime, at: number, previousHeat: number): void {
  const state = holosmithState.from(context);
  if (
    !hasTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) ||
    previousHeat > HOLOSMITH_HEAT.enhancedCapacityThreshold ||
    state.heat <= HOLOSMITH_HEAT.enhancedCapacityThreshold
  )
    return;
  emitEnhancedCapacityMight(context, at);
  const enhancedCapacityProfile = requireBalanceProfileFromContext(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  const next = at + balanceProfileNumber(enhancedCapacityProfile, 'pulseInterval');
  state.enhancedCapacityMightAt = next;
  context.schedule('engineer.enhanced-capacity-might', next, undefined, undefined, -200);
}

/** Queue the blast before Burning at the accepted overheat deadline, preserving independent packet ownership. */
export function emitPhotonicBlastingModuleEffects(context: EngineerRuntime, effectAt: number): void {
  const photonicBlastingModuleProfile = requireBalanceProfileFromContext(context, TRAIT.PHOTONIC_BLASTING_MODULE);
  const strike = requireEffect(photonicBlastingModuleProfile, 'strike', 'Photonic Blasting Module');
  const condition = requireEffect(photonicBlastingModuleProfile, 'condition', 'Burning');
  // The explosion owns the blast finisher and resolves before its same-time condition packet.
  if (strike) {
    emitEngineerEvent(context, 'damage', {
      at: effectAt,
      source: 'Trait',
      sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
      actorType: 'player',
      skillName: 'Photonic Blasting Module',
      name: 'Photonic Blasting Module',
      coefficient: effectNumber(photonicBlastingModuleProfile, strike, 'coefficient'),
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: 'Unequipped',
      explosion: true,
      comboFinishers: [
        {
          ownerId: 'engineer',
          finisherType: 'Blast',
          ambiguousFieldSelection: 'oldest'
        }
      ]
    });
  }

  // Burning shares the delayed PBM timestamp but remains a separate canonical effect application.
  if (condition) {
    emitEngineerEvent(context, 'condition', {
      at: effectAt,
      source: 'Trait',
      sourceId: TRAIT.PHOTONIC_BLASTING_MODULE,
      skillName: 'Photonic Blasting Module',
      name: 'Photonic Blasting Module — Burning',
      condition: String(condition.condition),
      stacks: Number(condition.stacks),
      duration: Number(condition.duration)
    });
  }
}

/** Seed the Might task before passive cooling begins in preheated simulations. */
export function initializeEnhancedCapacityMight(context: EngineerRuntime): void {
  const state = holosmithState.from(context);
  if (
    hasTrait(context.config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) &&
    state.heat > HOLOSMITH_HEAT.enhancedCapacityThreshold
  ) {
    state.enhancedCapacityMightAt = context.time;
    context.schedule('engineer.enhanced-capacity-might', context.time, undefined, undefined, -200);
  }
}

/** Structural ECSU capacity is selected before initial heat is clamped. */
export function enhancedCapacityMaximumHeat(config: EngineerConfig): number {
  return hasTrait(selectedEngineerTraits(config), TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ? HOLOSMITH_HEAT.enhancedCapacityMaximum
    : HOLOSMITH_HEAT.baseMaximum;
}

/** Capture ECSU selection together with heat before delayed skill packets are authored. */
export function enhancedCapacitySelected(config: EngineerConfig): boolean {
  return hasTrait(config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
}

/** Delayed packets use captured selection and heat when deciding whether ECSU upgrades their skill tier. */
export function enhancedCapacityHeatTier(heat: number, selected: boolean): boolean {
  return selected && heat > HOLOSMITH_HEAT.enhancedCapacityThreshold;
}

/** Light Density Amplifier uses the existing shared heat-profile patch key. */
export function lightDensityHeatPerSecond(context: EngineerRuntime): number {
  return hasTrait(context.config, TRAIT.LIGHT_DENSITY_AMPLIFIER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.heat), 'resourceGain')
    : 0;
}

/** PBM retains heat outside Forge until overheat, including when a dodge attempts to vent it. */
export function preservesPhotonicHeat(context: EngineerRuntime): boolean {
  return hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE) && !holosmithState.from(context).overheated;
}

/** PBM supplies its delayed blast timestamp and toolbelt penalty before overheat state changes. */
export function photonicOverheatTiming(
  context: EngineerRuntime,
  at: number
): { at: number; cooldown: number } | undefined {
  if (!hasTrait(context.config, TRAIT.PHOTONIC_BLASTING_MODULE)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.PHOTONIC_BLASTING_MODULE);
  return {
    at: at + balanceProfileNumber(profile, 'initialDelay'),
    cooldown: balanceProfileNumber(profile, 'cooldown')
  };
}
