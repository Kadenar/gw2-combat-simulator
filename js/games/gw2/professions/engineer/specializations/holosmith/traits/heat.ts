import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { EngineerConfig, EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** The selected trait owns capacity before initial heat is clamped. */
export function enhancedCapacityMaximumHeat(config: EngineerConfig, balanceContext: unknown): number {
  return hasTrait(selectedEngineerTraits(config), TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ? balanceNumberFromContext(balanceContext, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT, 'maximumStacks')
    : HOLOSMITH_HEAT.baseMaximum;
}

/** Capture ECSU selection together with heat before delayed skill packets are authored. */
export function enhancedCapacitySelected(config: EngineerConfig): boolean {
  return hasTrait(config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
}

/** Delayed packets use captured selection and heat when deciding whether ECSU upgrades their skill tier. */
export function enhancedCapacityHeatTier(heat: number, selected: boolean, balanceContext: unknown): boolean {
  return selected && heat > balanceNumberFromContext(balanceContext, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT, 'threshold');
}

/** Light Density Amplifier owns its passive heat increase in its trait balance. */
export function lightDensityHeatPerSecond(context: EngineerRuntime<HolosmithSkill>): number {
  return hasTrait(context.traits, TRAIT.LIGHT_DENSITY_AMPLIFIER)
    ? balanceNumberFromContext(context, TRAIT.LIGHT_DENSITY_AMPLIFIER, 'resourceGain')
    : 0;
}

/** PBM retains heat outside Forge until overheat, including when a dodge attempts to vent it. */
export function preservesPhotonicHeat(context: EngineerRuntime<HolosmithSkill>): boolean {
  return hasTrait(context.traits, TRAIT.PHOTONIC_BLASTING_MODULE) && !holosmithState.from(context).overheated;
}

// Overheating admits a blast with a fixed delivery delay, independent of its balance payload.
export const PHOTONIC_BLAST_DELAY_SECONDS = 1.56;

/** PBM supplies its delayed blast timestamp and toolbelt penalty before overheat state changes. */
export function photonicOverheatTiming(
  context: EngineerRuntime<HolosmithSkill>,
  at: number
): { at: number; cooldown: number } | undefined {
  if (!hasTrait(context.traits, TRAIT.PHOTONIC_BLASTING_MODULE)) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.PHOTONIC_BLASTING_MODULE);
  return {
    at: at + PHOTONIC_BLAST_DELAY_SECONDS,
    cooldown: balanceProfileNumber(profile, 'cooldown')
  };
}
