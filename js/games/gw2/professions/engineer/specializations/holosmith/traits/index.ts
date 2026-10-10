import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { engineerSpecializationState } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { HOLOSMITH_HEAT } from '#gw2/professions/engineer/specializations/holosmith/mechanics/constants.js';
import {
  holosmithEventMetadata,
  type HolosmithResolverEvent
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import { holosmithState } from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { preservesPhotonicHeat } from '#gw2/professions/engineer/specializations/holosmith/traits/heat.js';
import { type EngineerResolverContext } from '#gw2/professions/engineer/types.js';

import {
  heatGained,
  heatInitialized,
  photonForgeTransitioned,
  triggerVentExhaust,
  type HeatGain,
  type PhotonForgeTransition
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/photon-forge.js';
import type { HolosmithSkill } from '#gw2/professions/engineer/specializations/holosmith/types.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Owns Thermal Release Valve at its established heat and impact boundaries. */
export const thermalReleaseValve = defineTrait({
  id: TRAIT.THERMAL_RELEASE_VALVE,
  name: 'Thermal Release Valve',
  balance: {
    // The trait owns the dodge boon; the invoked Vent Exhaust skill owns its damage and heat loss.
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', stacks: 1, duration: 3 }]
  },
  // Dodge admission controls both the boon and vent; existing heat and charge lifetimes remain independent.
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      run: (runtime, cast) => triggerThermalReleaseValve(runtime, cast.skill, runtime.time)
    }
  ]
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
  triggers: [
    onTriggerPoint(heatInitialized, { run: seedEnhancedCapacityMight }),
    onTriggerPoint(heatGained, { run: crossEnhancedCapacityThreshold })
  ],
  lifetime: {
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
  },
  triggers: [
    onTriggerPoint(photonForgeTransitioned, {
      when: (_runtime, { transition, blastAt }: PhotonForgeTransition) => transition === 'overheat' && blastAt != null,
      run: emitPhotonicBlastingModuleEffects
    })
  ]
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
  triggers: [onTriggerPoint(photonForgeTransitioned, { run: grantSolarFocusingLens })],
  lifetime: {
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
  const state = holosmithState.from(context);
  emitTraitProfile(context, TRAIT.THERMAL_RELEASE_VALVE, TRAIT.THERMAL_RELEASE_VALVE, undefined, {
    at: at,
    effect: { type: 'boon', name: 'vigor' },
    attribution: {
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Thermal Release Valve \u2014 vigor'
    },
    transform: (event) => ({ ...event, applicationIndex: undefined, totalApplications: undefined })
  });

  if (state.heat.value <= 0 || preservesPhotonicHeat(context)) return;
  triggerVentExhaust(context, skill, at);
}

/** Emit one Might pulse after the caller has accepted its heat threshold or scheduled lifetime. */
function emitEnhancedCapacityMight(context: EngineerRuntime<HolosmithSkill>, at: number): void {
  emitTraitProfile(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT, undefined, {
    at: at,
    effect: { type: 'boon', name: 'might' },
    attribution: { actorType: 'player', name: 'Enhanced Capacity Storage Unit \u2014 might' },
    transform: (event) => ({ ...event, applicationIndex: undefined, totalApplications: undefined })
  });
}

/** Crossing the threshold grants the first pulse immediately and starts the existing scheduled cadence. */
function crossEnhancedCapacityThreshold(
  context: EngineerRuntime<HolosmithSkill>,
  { at, previousHeat }: HeatGain
): void {
  const state = holosmithState.from(context);
  if (
    previousHeat > HOLOSMITH_HEAT.enhancedCapacityThreshold ||
    state.heat.value <= HOLOSMITH_HEAT.enhancedCapacityThreshold
  )
    return;
  emitEnhancedCapacityMight(context, at);
  const enhancedCapacityProfile = requireBalanceProfileFromContext(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT);
  const next = at + balanceProfileNumber(enhancedCapacityProfile, 'pulseInterval');
  state.enhancedCapacityMightAt = next;
  context.schedule('engineer.enhanced-capacity-might', next, undefined, undefined, -200);
}

/** Seed the Might task before passive cooling begins in preheated simulations. */
function seedEnhancedCapacityMight(context: EngineerRuntime<HolosmithSkill>): void {
  const state = holosmithState.from(context);
  if (state.heat.value > HOLOSMITH_HEAT.enhancedCapacityThreshold) {
    state.enhancedCapacityMightAt = context.time;
    context.schedule('engineer.enhanced-capacity-might', context.time, undefined, undefined, -200);
  }
}

/** Queue the blast before Burning at the accepted overheat deadline, preserving independent packet ownership. */
function emitPhotonicBlastingModuleEffects(
  context: EngineerRuntime<HolosmithSkill>,
  { blastAt }: PhotonForgeTransition
): void {
  // The blast owns the finisher; its following condition retains independent application ownership.
  emitTraitProfile(context, TRAIT.PHOTONIC_BLASTING_MODULE, TRAIT.PHOTONIC_BLASTING_MODULE, undefined, {
    at: blastAt!,
    skillWeaponFallback: 'Unequipped',
    attribution: { actorType: 'player', skillName: 'Photonic Blasting Module' },
    transform: (event) =>
      event.type === 'damage'
        ? {
            ...event,
            name: 'Photonic Blasting Module',
            canCrit: undefined,
            explosion: true,
            comboFinishers: [{ ownerId: 'engineer', finisherType: 'Blast', ambiguousFieldSelection: 'oldest' }]
          }
        : {
            ...event,
            name: 'Photonic Blasting Module \u2014 Burning',
            applicationIndex: undefined,
            totalApplications: undefined
          }
  });
}

/**
 * Entry and ordinary exit grant the smaller charge count; overheat grants the larger one, at the delayed module blast
 * when Photonic Blasting Module supplies one. Grants cross into the resolver at their activation time.
 */
function grantSolarFocusingLens(
  context: EngineerRuntime<HolosmithSkill>,
  { transition, at, blastAt }: PhotonForgeTransition
): void {
  const overheat = transition === 'overheat';
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, TRAIT.SOLAR_FOCUSING_LENS);
  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'engineer.solar-focusing-lens',
      at: overheat ? (blastAt ?? at) : at,
      source: 'Trait',
      sourceId: TRAIT.SOLAR_FOCUSING_LENS,
      actorType: 'player',
      stacks: balanceProfileNumber(solarFocusingLensProfile, overheat ? 'maximumStacks' : 'minimumStacks'),
      duration: balanceProfileNumber(solarFocusingLensProfile, 'durationMultiplier')
    }
  });
}

/** Replaces Lens charges only when the Forge transition's grant reaches the resolver. */
function handleSolarFocusingLens(context: EngineerResolverContext, event: HolosmithResolverEvent): void {
  const state = holosmithState.from(context);
  // Lens keeps its inclusive final-hit policy on the temporary-effect expiry tick.
  state.solarFocusingLens = {
    ...grantCharges(Number(event.stacks), gw2EffectExpiresAt(event.at, Number(event.duration))),
    readyAt: event.at
  };
}

/** Spends Lens charges in impact order, including strikes materialized by resolver handlers. */
function consumeSolarFocusingLens(
  context: EngineerResolverContext,
  event: HolosmithResolverEvent
): { solarFocusingLens: true } | void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.traits, TRAIT.SOLAR_FOCUSING_LENS)
  )
    return;
  const state = holosmithState.from(context);
  const solarFocusingLensProfile = requireBalanceProfileFromContext(context, TRAIT.SOLAR_FOCUSING_LENS);
  const condition = requireEffect(solarFocusingLensProfile, 'condition', 'Burning');
  if (!condition) return;
  // Lens cannot activate before its grant; zero-ICD consumption does not enforce readyAt.
  if (event.at < (state.solarFocusingLens.readyAt ?? 0) || !consumeCharge(state.solarFocusingLens, event.at, 0, true))
    return;

  emitTraitProfile(context, TRAIT.SOLAR_FOCUSING_LENS, TRAIT.SOLAR_FOCUSING_LENS, undefined, {
    at: event.at,
    effect: { type: 'condition', name: 'Burning' },
    attribution: {
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Solar Focusing Lens \u2014 Burning'
    },
    transform: (packet) => ({ ...packet, applicationIndex: undefined, totalApplications: undefined })
  });

  return { solarFocusingLens: true };
}
