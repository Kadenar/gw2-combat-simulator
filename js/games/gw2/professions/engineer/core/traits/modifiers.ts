import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { targetConditionActive, vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerCoreCastAvailability } from '#gw2/professions/engineer/core/mechanics/availability.js';
import { advanceEngineerResources } from '#gw2/professions/engineer/core/mechanics/resources.js';
import {
  handleElectricArtilleryExpire,
  handleElectricArtilleryReady,
  handleLightningRodCharge
} from '#gw2/professions/engineer/core/mechanics/spear.js';
import {
  applyEngineerCastTraits,
  isEngineerToolbeltSkill,
  observeEngineerHghEvent
} from '#gw2/professions/engineer/core/traits/index.js';
import { observeEngineerMineFieldEvent } from '#gw2/professions/engineer/core/mechanics/mine-field.js';
import {
  activeBoonStacks,
  cloneEngineerAttributes,
  engineerEvent,
  engineerRuntimeState,
  engineerSchedulerState,
  eventSkill,
  heavyMetalBonus,
  playerHealthFraction,
  targetConditionCount,
  targetHealthFraction
} from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { EngineerRechargeContext } from '#gw2/professions/engineer/types.js';

/** Re-exports the Engineer family snapshot hook through the Core modifier surface. */
export { snapshotEngineerState } from '#gw2/professions/engineer/state.js';

// Chemical Rounds extends pistol-skill base durations before the normal capped condition-duration multiplier.
function modifyEngineerConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  if (!hasTrait(context, TRAIT.CHEMICAL_ROUNDS)) return multiplier;
  const event = engineerEvent(context);
  const application = event?.application || event;
  // trait-sourced conditions (e.g. Incendiary Powder) don't get Chemical Rounds amplification
  if (application?.source === 'Trait') return multiplier;
  const skill = eventSkill(context);
  // condition events from different layers carry the weapon type at different paths — check all three
  if (event?.skillWeapon !== 'Pistol' && event?.application?.skillWeapon !== 'Pistol' && skill?.weapon !== 'Pistol') {
    return multiplier;
  }

  // Apply the skill-specific increase uniformly so every pistol condition keeps it beyond the global duration cap.
  return multiplier * (4 / 3);
}

export const engineerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'engineer.glass-cannon',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.GLASS_CANNON) &&
      playerHealthFraction(context) > 0.75
  },
  {
    id: 'engineer.big-boomer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.BIG_BOOMER) &&
      playerHealthFraction(context) > targetHealthFraction(context)
  },
  {
    // caps at 25 stacks to match the in-game vulnerability stack cap
    id: 'engineer.shaped-charge',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      maximumStacks: 25,
      damagePerStack: 0.005
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      1 + Math.min(parameters.maximumStacks, vulnerabilityStacks(context)) * parameters.damagePerStack,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.SHAPED_CHARGE)
  },
  {
    id: 'engineer.modified-ammunition',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      damagePerCondition: 0.01
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + targetConditionCount(context) * parameters.damagePerCondition,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.MODIFIED_AMMUNITION)
  },
  {
    id: 'engineer.excessive-energy',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.EXCESSIVE_ENERGY) &&
      activeBoonStacks(context, 'vigor', 1) > 0
  },
  {
    // checks runtime state when available; falls back to scheduler state for precast evaluation
    id: 'engineer.takedown-round',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => {
      const state =
        context.runtime?.profession != null ? engineerRuntimeState(context) : engineerSchedulerState(context);
      return (
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.TAKEDOWN_ROUND) &&
        // 1e-9 tolerance prevents floating-point rounding from falsely reading "full endurance"
        Number(state.endurance || 0) < Number(state.maximumEndurance || 100) - 1e-9
      );
    }
  },
  {
    id: 'engineer.kinetic-battery',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.KINETIC_BATTERY) &&
      activeBoonStacks(context, 'kinetic-battery', 1) > 0
  },
  {
    id: 'engineer.flame-jet-burning-target',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => context.event?.skillName === 'Flame Jet' && targetConditionActive(context, 'Burning')
  },
  {
    id: 'engineer.high-caliber',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.HIGH_CALIBER)
  },
  {
    id: 'engineer.grand-entrance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.GRAND_ENTRANCE) &&
      activeBoonStacks(context, 'grand-entrance', 1) > 0
  },
  {
    id: 'engineer.heavy-metal-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    parameters: {
      lowerThreshold: 0.25,
      middleThreshold: 0.5,
      upperThreshold: 0.75,
      lowerBonus: 0.15,
      middleBonus: 0.1,
      upperBonus: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => heavyMetalBonus(context, parameters),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.HEAVY_METAL)
  },
  {
    id: 'engineer.heavy-metal-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    parameters: {
      lowerThreshold: 0.25,
      middleThreshold: 0.5,
      upperThreshold: 0.75,
      lowerBonus: 0.15,
      middleBonus: 0.1,
      upperBonus: 0.05
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + heavyMetalBonus(context, parameters),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.HEAVY_METAL)
  },
  {
    // Static Discharge doubles its completed critical multiplier without affecting other strikes.
    id: 'engineer.static-discharge-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 2,
    when: (context) => context.event?.staticDischarge === true
  },
  {
    // thermalVisionUntil is extended by each Burning application; rule active while window is open
    id: 'engineer.thermal-vision-damage',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) =>
      hasTrait(context, TRAIT.THERMAL_VISION) &&
      Number(engineerRuntimeState(context).traitProcReadyAt?.thermalVisionUntil || 0) > context.time
  },
  {
    id: 'engineer.serrated-steel-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    parameters: {
      durationMultiplier: 0.33
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      balanceProfileValueFromContext(
        context,
        PROFILE.serratedSteel,
        'durationMultiplier',
        parameters.durationMultiplier
      ),
    // Panel-derived simulation stats already contain this static bonus; provenance keeps direct simulations compatible.
    when: (context) =>
      context.condition === 'Bleeding' &&
      hasTrait(context, TRAIT.SERRATED_STEEL) &&
      !professionStaticRulesApplied(context.config)
  },
  {
    id: 'engineer.incendiary-powder-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    parameters: {
      durationMultiplier: 0.33
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      balanceProfileValueFromContext(
        context,
        PROFILE.incendiaryPowder,
        'durationMultiplier',
        parameters.durationMultiplier
      ),
    when: (context) =>
      context.condition === 'Burning' &&
      hasTrait(context, TRAIT.INCENDIARY_POWDER) &&
      !professionStaticRulesApplied(context.config)
  },
  {
    id: 'engineer.hematic-focus',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.HEMATIC_FOCUS) &&
      activeBoonStacks(context, 'fury', 1) > 0
  }
]);

/** Compiles declarative Engineer modifier rules into the shared hook contract. */
export function compileEngineerModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

/** Applies Core Engineer's static and runtime-dependent attribute changes to a fresh attribute snapshot. */
function modifyEngineerCoreAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const modified = cloneEngineerAttributes(attributes);
  // buildAttributesApplied guard: prevents double-counting when the build calculator already applied these bonuses
  const buildAttributesApplied = professionStaticRulesApplied(context.config);
  if (hasTrait(context, TRAIT.CHEMICAL_ROUNDS) && !buildAttributesApplied) {
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) +
      balanceProfileValueFromContext(context, PROFILE.chemicalRounds, 'attributeBonus', 120);
  }

  if (hasTrait(context, TRAIT.THERMAL_VISION) && !buildAttributesApplied) {
    modified.expertise =
      Number(modified.expertise || 0) +
      balanceProfileValueFromContext(context, PROFILE.thermalVision, 'attributeBonus', 150);
  }

  if (
    hasTrait(context, TRAIT.ENERGY_AMPLIFIER) &&
    activeBoonStacks(context, 'regeneration', 1) > 0 &&
    // only skip if regen is a permanent assumption AND build attributes already account for it
    !(buildAttributesApplied && Boolean(context.config?.boons?.regeneration))
  ) {
    const attributeBonus = balanceProfileValueFromContext(context, PROFILE.energyAmplifier, 'attributeBonus', 250);
    modified.power = Number(modified.power || 0) + attributeBonus;
    modified.healingPower = Number(modified.healingPower || 0) + attributeBonus;
  }

  if (
    hasTrait(context, TRAIT.NO_SCOPE) &&
    activeBoonStacks(context, 'fury', 1) > 0 &&
    !(buildAttributesApplied && Boolean(context.config?.boons?.fury))
  ) {
    modified.ferocity =
      Number(modified.ferocity || 0) + balanceProfileValueFromContext(context, PROFILE.noScope, 'attributeBonus', 150);
  }

  if (hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    modified.ferocity =
      Number(modified.ferocity || 0) +
      activeBoonStacks(
        context,
        'explosive-temper',
        balanceProfileValueFromContext(context, PROFILE.explosiveTemper, 'maximumStacks', 10)
      ) *
        balanceProfileValueFromContext(context, PROFILE.explosiveTemper, 'attributePerStack', 20);
  }

  applyEngineerSharpshooterConditionDamage(context, modified);
  return modified;
}

/**
 * Replaces player-owned bleeding's condition damage with Sharpshooter's Power conversion.
 * Specializations may rerun it after their dynamic Power hooks so those bonuses are included.
 */
export function applyEngineerSharpshooterConditionDamage(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord
): void {
  if (
    !hasTrait(context, TRAIT.SHARPSHOOTER) ||
    context.event?.condition !== 'Bleeding' ||
    !isGw2PlayerModifierOwnedEvent(context.event)
  ) {
    return;
  }

  // Sharpshooter replaces the attribute only for bleeding that inherits the player's outgoing modifiers.
  attributes.conditionDamage =
    Number(attributes.power || 0) *
    balanceProfileValueFromContext(context, PROFILE.sharpshooter, 'coefficientMultiplier', 2 / 3);
}

/** Applies toolbelt and gadget recharge reductions from the active Core traits. */
function modifyEngineerCoreRechargeDuration(context: EngineerRechargeContext, duration: number): number {
  const skill = context.skill;
  if (isEngineerToolbeltSkill(skill) && hasTrait(context.config, TRAIT.MECHANIZED_DEPLOYMENT)) {
    return duration * 0.85;
  }

  if (
    skill?.categories?.some((category) => String(category).toLowerCase() === 'gadget') &&
    hasTrait(context.config, TRAIT.GADGETEER)
  ) {
    return duration * 0.8;
  }

  return duration;
}

export const engineerCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyEngineerCoreAttributes,
  modifyConditionBaseDuration: modifyEngineerConditionBaseDuration,
  modifierRules: engineerCoreModifierRules,
  compileModifierRules: compileEngineerModifierRules
});

export const engineerCoreCastRules = Object.freeze({
  availability: {
    id: 'engineer.core-availability',
    // order 10 — runs before specialization availability checks (which typically use higher order values)
    order: 10,
    handler: engineerCoreCastAvailability
  },
  modifyRechargeDuration: modifyEngineerCoreRechargeDuration
});

export const engineerCoreSchedulerHooks = Object.freeze({
  advance: {
    id: 'engineer.resources',
    order: 10,
    handler: advanceEngineerResources
  },
  afterCast: Object.freeze([
    {
      id: 'engineer.core-traits',
      order: 20,
      handler: applyEngineerCastTraits
    }
  ]),
  onEventScheduled: Object.freeze([
    {
      id: 'engineer.mine-field',
      order: 10,
      handler: observeEngineerMineFieldEvent
    },
    {
      id: 'engineer.hgh-duration',
      order: 20,
      handler: observeEngineerHghEvent
    }
  ]),
  taskHandlers: Object.freeze({
    'engineer.lightning-rod-charge': handleLightningRodCharge,
    'engineer.electric-artillery-ready': handleElectricArtilleryReady,
    'engineer.electric-artillery-expire': handleElectricArtilleryExpire
  })
});
