import { createModifierHooks, MODIFIER_TARGET } from '../../../platform/gw2/modifier-rules.js';
import { professionStaticRulesApplied } from '../../../platform/gw2/attribute-provenance.js';
import { hasTrait } from '../../../platform/gw2/trait-state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { engineerCoreCastAvailability } from './availability.js';
import { advanceEngineerResources } from './resources.js';
import { handleElectricArtilleryExpire, handleElectricArtilleryReady, handleLightningRodCharge } from './spear.js';
import { applyEngineerCastTraits, isEngineerToolbeltSkill } from './traits.js';
import { handleEngineerTurretAttack } from './turrets.js';
import { updateEngineerWeaponState } from './weapon-state.js';
import {
  activeBoonStacks,
  cloneEngineerAttributes,
  engineerEvent,
  engineerRuntimeState,
  engineerSchedulerState,
  eventSkill,
  heavyMetalBonus,
  playerHealthFraction,
  playerStrike,
  targetConditionCount,
  targetHealthFraction,
  vulnerability
} from './rule-helpers.js';
import { hasEngineerTrait } from './state.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE, engineerBalanceValue } from './profiles.js';
import type { SchedulerRecord } from '../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../platform/gw2/types.js';
import type { EngineerRechargeContext } from '../types.js';

export { snapshotEngineerState } from './state.js';

// condition duration modifier for Chemical Rounds (pistol skills only)
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

  const skillName = skill?.name || event?.skillName || event?.application?.skillName;
  const condition = context.condition || event?.condition || event?.application?.condition;
  // Blowtorch and Glue Shot have unique per-skill multipliers sourced from the wiki
  if (skillName === 'Blowtorch' && condition === 'Burning') {
    return multiplier * 1.2;
  }

  if (skillName === 'Glue Shot') {
    return condition === 'Crippled' ? multiplier * 1.5 : multiplier;
  }

  return multiplier * (4 / 3);
}

export const engineerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'engineer.glass-cannon',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.07,
    when: (context) =>
      playerStrike(context) && hasTrait(context, TRAIT.GLASS_CANNON) && playerHealthFraction(context) > 0.75
  },
  {
    id: 'engineer.big-boomer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      playerStrike(context) &&
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
      1 + Math.min(parameters.maximumStacks, vulnerability(context)) * parameters.damagePerStack,
    when: (context) => playerStrike(context) && hasTrait(context, TRAIT.SHAPED_CHARGE)
  },
  {
    id: 'engineer.modified-ammunition',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      damagePerCondition: 0.01
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + targetConditionCount(context) * parameters.damagePerCondition,
    when: (context) => playerStrike(context) && hasTrait(context, TRAIT.MODIFIED_AMMUNITION)
  },
  {
    id: 'engineer.excessive-energy',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      playerStrike(context) && hasTrait(context, TRAIT.EXCESSIVE_ENERGY) && activeBoonStacks(context, 'vigor', 1) > 0
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
        playerStrike(context) &&
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
      playerStrike(context) &&
      hasTrait(context, TRAIT.KINETIC_BATTERY) &&
      activeBoonStacks(context, 'kinetic-battery', 1) > 0
  },
  {
    id: 'engineer.flame-jet-burning-target',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      context.event?.skillName === 'Flame Jet' &&
      Boolean(context.query?.targetHasCondition('Burning', context.time, context.runtime))
  },
  {
    id: 'engineer.high-caliber',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => playerStrike(context) && hasTrait(context, TRAIT.HIGH_CALIBER)
  },
  {
    id: 'engineer.grand-entrance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.1,
    when: (context) =>
      playerStrike(context) &&
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
    when: (context) => playerStrike(context) && hasTrait(context, TRAIT.HEAVY_METAL)
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
    when: (context) => playerStrike(context) && hasTrait(context, TRAIT.HEAVY_METAL)
  },
  {
    // staticDischarge flag is set by the trait handler — prevents the rule from applying to non-SD hits
    id: 'engineer.static-discharge-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'add',
    amount: 1,
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
      engineerBalanceValue(context, PROFILE.serratedSteel, 'durationMultiplier', parameters.durationMultiplier),
    when: (context) => context.condition === 'Bleeding' && hasTrait(context, TRAIT.SERRATED_STEEL)
  },
  {
    id: 'engineer.incendiary-powder-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    parameters: {
      durationMultiplier: 0.33
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      engineerBalanceValue(context, PROFILE.incendiaryPowder, 'durationMultiplier', parameters.durationMultiplier),
    when: (context) => context.condition === 'Burning' && hasTrait(context, TRAIT.INCENDIARY_POWDER)
  },
  {
    id: 'engineer.hematic-focus',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) =>
      playerStrike(context) && hasTrait(context, TRAIT.HEMATIC_FOCUS) && activeBoonStacks(context, 'fury', 1) > 0
  }
]);

export function compileEngineerModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

function modifyEngineerCoreAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const modified = cloneEngineerAttributes(attributes);
  // buildAttributesApplied guard: prevents double-counting when the build calculator already applied these bonuses
  const buildAttributesApplied = professionStaticRulesApplied(context.config);
  if (hasTrait(context, TRAIT.CHEMICAL_ROUNDS) && !buildAttributesApplied) {
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) +
      engineerBalanceValue(context, PROFILE.chemicalRounds, 'attributeBonus', 120);
  }

  if (hasTrait(context, TRAIT.THERMAL_VISION) && !buildAttributesApplied) {
    modified.expertise =
      Number(modified.expertise || 0) + engineerBalanceValue(context, PROFILE.thermalVision, 'attributeBonus', 150);
  }

  if (
    hasTrait(context, TRAIT.ENERGY_AMPLIFIER) &&
    activeBoonStacks(context, 'regeneration', 1) > 0 &&
    // only skip if regen is a permanent assumption AND build attributes already account for it
    !(buildAttributesApplied && Boolean(context.config?.boons?.regeneration))
  ) {
    const attributeBonus = engineerBalanceValue(context, PROFILE.energyAmplifier, 'attributeBonus', 250);
    modified.power = Number(modified.power || 0) + attributeBonus;
    modified.healingPower = Number(modified.healingPower || 0) + attributeBonus;
  }

  if (
    hasTrait(context, TRAIT.NO_SCOPE) &&
    activeBoonStacks(context, 'fury', 1) > 0 &&
    !(buildAttributesApplied && Boolean(context.config?.boons?.fury))
  ) {
    modified.ferocity =
      Number(modified.ferocity || 0) + engineerBalanceValue(context, PROFILE.noScope, 'attributeBonus', 150);
  }

  if (hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    modified.ferocity =
      Number(modified.ferocity || 0) +
      activeBoonStacks(
        context,
        'explosive-temper',
        engineerBalanceValue(context, PROFILE.explosiveTemper, 'maximumStacks', 10)
      ) *
        engineerBalanceValue(context, PROFILE.explosiveTemper, 'attributePerStack', 20);
  }

  applyEngineerSharpshooterConditionDamage(context, modified);
  return modified;
}

// Sharpshooter replaces bleeding's condition-damage attribute with a Power
// conversion. Specializations can rerun this after their dynamic Power hooks
// so the replacement includes bonuses such as Amalgam's Evolved state.
export function applyEngineerSharpshooterConditionDamage(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord
): void {
  if (
    !hasTrait(context, TRAIT.SHARPSHOOTER) ||
    context.event?.condition !== 'Bleeding' ||
    context.event?.actorType === 'summon'
  ) {
    return;
  }

  attributes.conditionDamage =
    Number(attributes.power || 0) * engineerBalanceValue(context, PROFILE.sharpshooter, 'coefficientMultiplier', 2 / 3);
}

function modifyEngineerCoreRechargeDuration(context: EngineerRechargeContext, duration: number): number {
  const skill = context.skill;
  if (isEngineerToolbeltSkill(skill) && hasEngineerTrait(context.config, TRAIT.MECHANIZED_DEPLOYMENT)) {
    return duration * 0.85;
  }

  if (
    skill?.categories?.some((category) => String(category).toLowerCase() === 'gadget') &&
    hasEngineerTrait(context.config, TRAIT.GADGETEER)
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
      id: 'engineer.weapon-state',
      order: 10,
      handler: updateEngineerWeaponState
    },
    {
      id: 'engineer.core-traits',
      order: 20,
      handler: applyEngineerCastTraits
    }
  ]),
  taskHandlers: Object.freeze({
    'engineer.turret-attack': handleEngineerTurretAttack,
    'engineer.lightning-rod-charge': handleLightningRodCharge,
    'engineer.electric-artillery-ready': handleElectricArtilleryReady,
    'engineer.electric-artillery-expire': handleElectricArtilleryExpire
  })
});
