import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import {
  emitEnhancedCapacityMight,
  preservesPhotonicHeat
} from '#gw2/professions/engineer/specializations/holosmith/traits/heat.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { engineerSpecializationState } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { holosmithEventMetadata } from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import {
  handleSolarFocusingLens,
  consumeSolarFocusingLens
} from '#gw2/professions/engineer/specializations/holosmith/traits/behavior.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { triggerVentExhaust } from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Owns Thermal Release Valve at its established heat and impact boundaries. */
export const thermalReleaseValve = defineTrait({
  id: TRAIT.THERMAL_RELEASE_VALVE,
  name: 'Thermal Release Valve',
  balance: {
    // The trait owns the dodge boon; the invoked Vent Exhaust skill owns its damage and heat loss.
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', stacks: 1, duration: 3 }]
  },
  hooks: {
    onCastStart(runtime, cast) {
      if (cast.skill.id === SHARED_SKILL_IDS.DODGE) triggerThermalReleaseValve(runtime, cast.skill, runtime.time);
    }
  }
});

/** Owns the selected Forge autoattack family; skill fragments retain each attack's packets. */
export const crystalConfigurationStorm = defineTrait({
  id: TRAIT.CRYSTAL_CONFIGURATION_STORM,
  name: 'Crystal Configuration: Storm'
});

/** Owns Enhanced Capacity Storage Unit at its established heat and impact boundaries. */
export const enhancedCapacityStorageUnit = defineTrait({
  id: TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
  name: 'Enhanced Capacity Storage Unit',
  balance: {
    pulseInterval: 1,
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 6 }]
  },
  hooks: {
    tasks: {
      'engineer.enhanced-capacity-might'(context) {
        const state = holosmithState.from(context);
        if (state.enhancedCapacityMightAt !== context.time) return;
        state.enhancedCapacityMightAt = Infinity;
        if (state.heat.value <= HOLOSMITH_HEAT.enhancedCapacityThreshold) return;
        emitEnhancedCapacityMight(context, context.time);
        const interval = balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT),
          'pulseInterval'
        );
        if (interval > 0) {
          state.enhancedCapacityMightAt = context.time + interval;
          context.schedule(
            'engineer.enhanced-capacity-might',
            state.enhancedCapacityMightAt,
            undefined,
            undefined,
            -200
          );
        }
      }
    }
  }
});

/** Owns Photonic Blasting Module at its established heat and impact boundaries. */
export const photonicBlastingModule = defineTrait({
  id: TRAIT.PHOTONIC_BLASTING_MODULE,
  name: 'Photonic Blasting Module',
  balance: {
    initialDelay: 1.56,
    cooldown: 5,
    effects: [
      { name: 'Photonic Blasting Module', type: 'strike', coefficient: 5, hits: 1 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 7, duration: 6 }
    ]
  }
});

/** Registers the passive heat adjustment consumed by Forge's cadence. */
export const lightDensityAmplifier = defineTrait({
  id: TRAIT.LIGHT_DENSITY_AMPLIFIER,
  name: 'Light Density Amplifier'
});

/** Laser's Edge samples live heat after trait-adjusted capacity and overheat state. */
export const lasersEdge = defineTrait({
  id: TRAIT.LASERS_EDGE,
  name: "Laser's Edge",
  modifierRules: [
    {
      id: 'engineer.lasers-edge',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        standardMaximum: 0.15,
        enhancedMaximum: 0.225,
        bonusPerHeat: 0.0015
      },
      factor: (context, _target, parameters) => {
        const state = engineerSpecializationState(context, 'Holosmith');
        const maximum = hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
          ? parameters.enhancedMaximum
          : parameters.standardMaximum;
        return 1 + Math.min(maximum, (state.heat?.value ?? 0) * parameters.bonusPerHeat);
      },
      when: (context) => {
        const state = engineerSpecializationState(context, 'Holosmith');
        return (
          isGw2PlayerModifierOwnedEvent(context.event) &&
          ((Boolean(state.photonForgeActive) && !state.overheated) ||
            (hasTrait(context, TRAIT.PHOTONIC_BLASTING_MODULE) &&
              Boolean(state.overheated) &&
              (state.heat?.value ?? 0) > 0))
        );
      }
    }
  ]
});

/** Owns Solar Focusing Lens at its established heat and impact boundaries. */
export const solarFocusingLens = defineTrait({
  id: TRAIT.SOLAR_FOCUSING_LENS,
  name: 'Solar Focusing Lens',
  balance: {
    minimumStacks: 2,
    maximumStacks: 6,
    durationMultiplier: 4,
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 3 }]
  },
  modifierRules: [
    {
      id: 'engineer.solar-focusing-lens',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && holosmithEventMetadata(context.event).solarFocusingLens === true
    }
  ],
  hooks: {
    eventHandlers: { 'engineer.solar-focusing-lens': handleSolarFocusingLens },
    reactions: { 'damage.resolving': consumeSolarFocusingLens }
  }
});

/** Registers holosmith traits in the established gameplay order. */
export const holosmithTraits = [
  lasersEdge,
  solarFocusingLens,
  enhancedCapacityStorageUnit,
  photonicBlastingModule,
  lightDensityAmplifier,
  thermalReleaseValve,
  crystalConfigurationStorm
];

/** Dodge grants Vigor before invoking the skill-owned vent, unless PBM preserves the current heat. */
function triggerThermalReleaseValve(context: EngineerRuntime<HolosmithSkill>, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.traits, TRAIT.THERMAL_RELEASE_VALVE)) return;
  const state = holosmithState.from(context);
  const thermalReleaseValveProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_RELEASE_VALVE);
  const boon = requireEffect(thermalReleaseValveProfile, 'boon', 'vigor');
  if (boon) {
    buildEngineerPackets('buff', {
      at,
      source: 'Trait',
      sourceId: TRAIT.THERMAL_RELEASE_VALVE,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Thermal Release Valve — vigor',
      kind: String(boon.boon).toLowerCase(),
      duration: boon.duration,
      stacks: Number(boon.stacks)
    }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }

  if (state.heat.value <= 0 || preservesPhotonicHeat(context)) return;
  triggerVentExhaust(context, skill, at);
}
