import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierEligibleEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { engineerSpecializationState } from '#gw2/content/professions/engineer/core/traits/query-helpers.js';
import { holosmithCastAvailability } from '#gw2/content/professions/engineer/specializations/holosmith/mechanics/availability.js';
import {
  holosmithEventMetadata,
  holosmithEventStrikeFactor
} from '#gw2/content/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import {
  advancePhotonForgeState,
  handleHolosmithKitEquip,
  handlePhotonForgeHeat,
  handlePhotonForgeOverheatPenalty,
  handlePhotonForgePassiveHeat,
  initializePhotonForgeHeat,
  observeHolosmithScheduledEvent,
  triggerThermalReleaseValve
} from '#gw2/content/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { EngineerCastContext, EngineerSkill } from '#gw2/content/professions/engineer/types.js';

/** Handles post-cast kit transitions and triggers Thermal Release Valve at synthetic dodge start. */
function handleHolosmithAfterCast(context: EngineerCastContext, skill: EngineerSkill): void {
  handleHolosmithKitEquip(context, skill);
  if (skill.id === -5) {
    triggerThermalReleaseValve(context, skill, context.start);
  }
}

/** Registers Holosmith heat initialization, observation, advancement, cast, and task hooks. */
export const holosmithSchedulerHooks = Object.freeze({
  initialize: {
    id: 'engineer.photon-forge-initialize',
    order: 20,
    handler: initializePhotonForgeHeat
  },
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
    'engineer.photon-forge-heat': handlePhotonForgeHeat,
    'engineer.photon-forge-overheat-penalty': handlePhotonForgeOverheatPenalty,
    'engineer.photon-forge-passive-heat': handlePhotonForgePassiveHeat
  })
});

/**
 * Splits `afterCast` into the cast lifecycle, where dodge-triggered TRV has cast context,
 * while retaining context-free hooks in the advanced scheduler contract.
 */
export const { afterCast: holosmithAfterCast, ...holosmithAdvancedSchedulerHooks } = holosmithSchedulerHooks;

/** Applies an authored skill factor before ordinary condition-duration bonuses are capped. */
function modifyHolosmithConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  const factor = Number(holosmithEventMetadata(context.event).holosmithConditionBaseDurationFactor ?? 1);
  return multiplier * (Number.isFinite(factor) ? Math.max(0, factor) : 1);
}

/** Defines Holosmith's heat- and trait-sensitive packet modifier rules. */
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
        isGw2PlayerModifierEligibleEvent(context.event) &&
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
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.SOLAR_FOCUSING_LENS) &&
      holosmithEventMetadata(context.event).solarFocusingLens === true
  },
  {
    id: 'engineer.enhanced-capacity-damage-tier',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { defaultFactor: 1 },
    // Heat-sensitive emitters own skill selection and tuning; this rule applies
    // either a delayed packet's captured factor or a direct packet's live profile tier.
    factor: (context, _target, parameters) =>
      holosmithEventStrikeFactor(context, context.event || {}, parameters.defaultFactor),
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) && holosmithEventStrikeFactor(context, context.event || {}) > 1
  }
]);

/** Exposes Holosmith condition-base-duration and packet modifier rules. */
export const holosmithAttributeRules = Object.freeze({
  modifyConditionBaseDuration: modifyHolosmithConditionBaseDuration,
  modifierRules: holosmithModifierRules
});

/** Exposes Holosmith cast availability to the scheduler. */
export const holosmithCastRules = Object.freeze({
  availability: {
    id: 'engineer.holosmith-availability',
    order: 30,
    handler: holosmithCastAvailability
  }
});
