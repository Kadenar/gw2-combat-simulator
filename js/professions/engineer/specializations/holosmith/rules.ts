import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { engineerEvent, engineerSpecializationState, eventSkill, playerStrike } from '../../core/rule-helpers.js';
import { holosmithCastAvailability } from './availability.js';
import {
  advancePhotonForgeState,
  handleHolosmithKitEquip,
  handlePhotonForgeHeat,
  observeHolosmithScheduledEvent,
  triggerThermalReleaseValve
} from './photon-forge.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type { EngineerCastContext, EngineerSkill } from '../../types.js';

// skill.id === -5 is the synthetic dodge skill; TRV fires at dodge start (context.start), not end.
function handleHolosmithAfterCast(context: EngineerCastContext, skill: EngineerSkill): void {
  handleHolosmithKitEquip(context, skill);
  if (skill.id === -5) {
    triggerThermalReleaseValve(context, skill, context.start);
  }
}

export const holosmithSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: 'engineer.holosmith-events',
    order: 30,
    handler: observeHolosmithScheduledEvent
  },
  advance: {
    id: 'engineer.photon-forge',
    order: 20,
    handler: advancePhotonForgeState
  },
  afterCast: {
    id: 'engineer.holosmith-after-cast',
    order: 30,
    handler: handleHolosmithAfterCast
  },
  taskHandlers: Object.freeze({
    'engineer.photon-forge-heat': handlePhotonForgeHeat
  })
});

// afterCast is split out so module.ts can wire it through the castLifecycle
// (afterSkillEffects) rather than the scheduler hook path. Scheduler hooks don't
// have access to cast context, so dodge-triggered TRV must go through castLifecycle.
export const { afterCast: holosmithAfterCast, ...holosmithAdvancedSchedulerHooks } = holosmithSchedulerHooks;

// Heat-tier bonus multipliers applied per-hit. Sword skills (Sun Edge etc.) and
// some forge skills have unique scaling distinct from the general ECSU tier check.
const HEAT_TIER_STRIKE_PARAMETERS: Readonly<Record<string, number>> = Object.freeze({
  highHeatThreshold: 50,
  enhancedHeatThreshold: 100,
  swordHighFactor: 1.2,
  swordEnhancedFactor: 1.3,
  bladeBurstHighFactor: 1.25,
  bladeBurstEnhancedFactor: 1.35,
  particleHighFactor: 1.1,
  particleEnhancedFactor: 1.35,
  generalEnhancedFactor: 1.35,
  singularityFactor: 1.25,
  beamFactor: 1.2
});

function heatTierStrikeFactor(context: Gw2ModifierContext, parameters: Readonly<Record<string, number>>): number {
  const heat = Number(engineerSpecializationState(context, 'Holosmith').heat || 0);
  const event = engineerEvent(context);
  const skillName = String(eventSkill(context)?.name || event?.skillName || '');
  if (['Sun Edge', 'Sun Ripper', 'Gleam Saber'].includes(skillName)) {
    if (heat >= parameters.enhancedHeatThreshold && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)) {
      return parameters.swordEnhancedFactor;
    }

    return heat > parameters.highHeatThreshold ? parameters.swordHighFactor : 1;
  }

  if (skillName === 'Blade Burst' && heat > parameters.highHeatThreshold) {
    if (heat >= parameters.enhancedHeatThreshold && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)) {
      return parameters.bladeBurstEnhancedFactor;
    }

    return parameters.bladeBurstHighFactor;
  }

  const enhancedCapacityTier =
    event?.enhancedCapacityTier === true ||
    (heat >= parameters.enhancedHeatThreshold && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT));
  if (skillName === 'Particle Accelerator' && heat > parameters.highHeatThreshold) {
    return enhancedCapacityTier ? parameters.particleEnhancedFactor : parameters.particleHighFactor;
  }

  if (!enhancedCapacityTier) return 1;
  if (['Laser Disk', 'Launch Wall'].includes(skillName)) {
    return parameters.generalEnhancedFactor;
  }

  if (skillName === 'Prismatic Singularity' && event?.name === 'Explosion Damage') {
    return parameters.singularityFactor;
  }

  if (skillName === 'Prime Light Beam' && event?.name === 'Field Damage') {
    return parameters.beamFactor;
  }

  return 1;
}

export const holosmithModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'engineer.lasers-edge',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      standardMaximum: 0.15,
      enhancedMaximum: 0.225,
      bonusPerHeat: 0.0015
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const state = engineerSpecializationState(context, 'Holosmith');
      const maximum = hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
        ? parameters.enhancedMaximum
        : parameters.standardMaximum;
      return 1 + Math.min(maximum, Number(state.heat || 0) * parameters.bonusPerHeat);
    },
    when: (context) => {
      const state = engineerSpecializationState(context, 'Holosmith');
      return (
        playerStrike(context) &&
        hasTrait(context, TRAIT.LASERS_EDGE) &&
        (Boolean(state.photonForgeActive) ||
          (hasTrait(context, TRAIT.PHOTONIC_BLASTING_MODULE) &&
            Boolean(state.overheated) &&
            Number(state.heat || 0) > 0))
      );
    }
  },
  {
    id: 'engineer.solar-focusing-lens',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      playerStrike(context) && hasTrait(context, TRAIT.SOLAR_FOCUSING_LENS) && context.event?.solarFocusingLens === true
  },
  {
    id: 'engineer.enhanced-capacity-damage-tier',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: HEAT_TIER_STRIKE_PARAMETERS,
    factor: (context, _target, parameters) => heatTierStrikeFactor(context, parameters),
    when: (context) => playerStrike(context) && heatTierStrikeFactor(context, HEAT_TIER_STRIKE_PARAMETERS) > 1
  },
  {
    id: 'engineer.enhanced-capacity-prime-light-beam-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.5,
    when: (context) =>
      context.condition === 'Burning' &&
      context.event?.skillName === 'Prime Light Beam' &&
      hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT) &&
      context.event?.enhancedCapacityTier === true
  }
]);

export const holosmithAttributeRules = Object.freeze({
  modifierRules: holosmithModifierRules
});

export const holosmithCastRules = Object.freeze({
  availability: {
    id: 'engineer.holosmith-availability',
    order: 30,
    handler: holosmithCastAvailability
  }
});
