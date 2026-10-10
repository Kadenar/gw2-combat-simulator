import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerConfig } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { selectedEngineerTraits } from '#gw2/professions/engineer/core/state.js';

/** The selected trait owns capacity before initial heat is clamped. */
export function enhancedCapacityMaximumHeat(config: EngineerConfig, balanceContext: unknown): number {
  return hasTrait(selectedEngineerTraits(config), TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT),
        'maximumStacks'
      )
    : HOLOSMITH_HEAT.baseMaximum;
}

/** Capture ECSU selection together with heat before delayed skill packets are authored. */
export function enhancedCapacitySelected(config: EngineerConfig): boolean {
  return hasTrait(config, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
}

/** Delayed packets use captured selection and heat when deciding whether ECSU upgrades their skill tier. */
export function enhancedCapacityHeatTier(heat: number, selected: boolean, balanceContext: unknown): boolean {
  return (
    selected &&
    heat >
      balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT),
        'threshold'
      )
  );
}

/** Light Density Amplifier owns its passive heat increase in its trait balance. */
export function lightDensityHeatPerSecond(context: EngineerRuntime<HolosmithSkill>): number {
  return hasTrait(context.traits, TRAIT.LIGHT_DENSITY_AMPLIFIER)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LIGHT_DENSITY_AMPLIFIER), 'resourceGain')
    : 0;
}

/** PBM retains heat outside Forge until overheat, including when a dodge attempts to vent it. */
export function preservesPhotonicHeat(context: EngineerRuntime<HolosmithSkill>): boolean {
  return hasTrait(context.traits, TRAIT.PHOTONIC_BLASTING_MODULE) && !holosmithState.from(context).overheated;
}

/** PBM supplies its delayed blast timestamp and toolbelt penalty before overheat state changes. */
export function photonicOverheatTiming(
  context: EngineerRuntime<HolosmithSkill>,
  at: number
): { at: number; cooldown: number } | undefined {
  if (!hasTrait(context.traits, TRAIT.PHOTONIC_BLASTING_MODULE)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.PHOTONIC_BLASTING_MODULE);
  return {
    at: at + balanceProfileNumber(profile, 'initialDelay'),
    cooldown: balanceProfileNumber(profile, 'cooldown')
  };
}
