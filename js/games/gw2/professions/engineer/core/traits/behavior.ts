import type {
  EngineerSkill,
  EngineerRuntime,
  EngineerResolverContext,
  EngineerResolverEvent
} from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { buildEngineerBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  activeBoonStacks,
  engineerEvent,
  targetHealthFraction
} from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { powerScaledConditionAttributes } from '#gw2/platform/combat/modifiers.js';

/** Owns HGH's elixir cast effects and scheduled-event duration extension. */

export function isElixirSkill(skill: EngineerSkill | undefined): boolean {
  return Boolean(skill?.categories?.some((category) => category.toLowerCase() === 'elixir'));
}

/** Schedules Acid Bomb's extended final pulse while HGH is selected. */
export function applyHghAcidBomb(context: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  const skill = cast.skill;
  if (!hasTrait(context.traits, TRAIT.HGH) || skill.id !== ID.ACID_BOMB) return;

  const hghProfile = requireBalanceProfileFromContext(context, TRAIT.HGH);
  const strike = requireEffect(hghProfile, 'strike', 'HGH');
  if (strike) {
    buildEngineerPackets(
      'damage',
      {
        at: cast.fullEnd + 6,
        activationId: cast.id,
        weaponStrengthProfileId: strike.weaponStrengthProfileId,
        coefficient: Number(strike.coefficient),
        hits: Number(strike.hits),
        name: 'Acid Bomb',
        actorType: 'player'
      },
      skill
    ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }
}

/** Extends scheduled elixir fields, boons, and conditions while HGH is selected. */
export function prepareEngineerHghEvent(context: EngineerRuntime, event: SimulationEventBase): SimulationEventBase {
  if (!hasTrait(context.traits, TRAIT.HGH) || event.sourceId === TRAIT.HGH) return event;
  const skill = skillForEvent(context.helpers, event);
  if (!isElixirSkill(skill)) return event;
  const hghProfile = requireBalanceProfileFromContext(context, TRAIT.HGH);
  const durationMultiplier = balanceProfileNumber(hghProfile, 'durationMultiplier');

  if (event.type === 'combo_field') {
    const duration = Number(event.expiresAt) - event.at;
    if (duration > 0) return { ...event, expiresAt: event.at + duration * durationMultiplier };
  } else if ((event.type === 'buff' || event.type === 'condition') && Number(event.duration) > 0) {
    return { ...event, duration: Number(event.duration) * durationMultiplier };
  }

  return event;
}

/** Opens or extends Thermal Vision's condition-damage window from player-owned Burning. */
export function applyThermalVision(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Burning' || event.actorType === 'summon' || !hasTrait(context, TRAIT.THERMAL_VISION)) {
    return;
  }

  const thermalVisionProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_VISION);
  // Independent accepted grants retain the longest window when Burning applications overlap.
  const thermalVisionBuff = requireEffect(thermalVisionProfile, 'buff', 'thermal-vision');
  if (thermalVisionBuff) {
    context.effects.emit({
      kind: 'packet',
      cause: event,
      settlement: 'reaction',
      event: buildEngineerBuff(event, {
        name: 'Thermal Vision',
        kind: 'thermal-vision',
        duration: thermalVisionBuff.duration,
        stacks: 1,
        sourceId: TRAIT.THERMAL_VISION,
        actorType: 'effect'
      })
    });
  }
}

/** Converts player-owned Bleeding applications into Sanguine Array might. */
export function applySanguineArray(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.SANGUINE_ARRAY)) {
    return;
  }

  const sanguineArrayProfile = requireBalanceProfileFromContext(context, TRAIT.SANGUINE_ARRAY);
  const sanguineArrayMight = requireEffect(sanguineArrayProfile, 'boon', 'might');
  if (sanguineArrayMight) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Sanguine Array',
        kind: String(sanguineArrayMight.boon).toLowerCase(),
        stacks: Math.max(1, event.stacks || 1),
        duration: sanguineArrayMight.duration,
        sourceId: TRAIT.SANGUINE_ARRAY,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.SANGUINE_ARRAY, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Sanguine Array', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grants Hematic Focus fury from player-owned Bleeding when its cooldown is ready. */
export function applyHematicFocus(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.HEMATIC_FOCUS)) {
    return;
  }

  const state = context.procs;
  if (!isInternalCooldownReady(event.at, state.deadline('hematicFocus') || 0)) return;
  const hematicFocusProfile = requireBalanceProfileFromContext(context, TRAIT.HEMATIC_FOCUS);
  const hematicFocusFury = requireEffect(hematicFocusProfile, 'boon', 'fury');
  if (hematicFocusFury) {
    state.setDeadline('hematicFocus', event.at + balanceProfileNumber(hematicFocusProfile, 'internalCooldown'));
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Hematic Focus',
        kind: String(hematicFocusFury.boon).toLowerCase(),
        stacks: Number(hematicFocusFury.stacks),
        duration: hematicFocusFury.duration,
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.HEMATIC_FOCUS, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Hematic Focus', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Applies Chemical Rounds at the live attribute boundary while preserving build provenance. */
export function applyChemicalRoundsAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.CHEMICAL_ROUNDS) && !professionStaticRulesApplied(context.config)) {
    const chemicalRoundsProfile = requireBalanceProfileFromContext(context, TRAIT.CHEMICAL_ROUNDS);
    modified.conditionDamage =
      (modified.conditionDamage || 0) + balanceProfileNumber(chemicalRoundsProfile, 'attributeBonus');
  }
}

/** Applies Thermal Vision at the live attribute boundary while preserving build provenance. */
export function applyThermalVisionAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.THERMAL_VISION) && !professionStaticRulesApplied(context.config)) {
    const thermalVisionProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_VISION);
    modified.expertise = (modified.expertise || 0) + balanceProfileNumber(thermalVisionProfile, 'attributeBonus');
  }
}

/** Applies No Scope at the live attribute boundary while preserving build provenance. */
export function applyNoScopeAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (
    hasTrait(context, TRAIT.NO_SCOPE) &&
    activeBoonStacks(context, 'fury', 1) > 0 &&
    !(professionStaticRulesApplied(context.config) && Boolean(context.config?.boons?.fury))
  ) {
    const noScopeProfile = requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(noScopeProfile, 'attributeBonus');
  }
}

// Chemical Rounds extends pistol-skill base durations before the normal capped condition-duration multiplier.
export function applyChemicalRoundsConditionDuration(context: Gw2ModifierContext, multiplier: number): number {
  if (!hasTrait(context, TRAIT.CHEMICAL_ROUNDS)) return multiplier;
  const event = engineerEvent(context);
  const application = event?.application || event;
  // trait-sourced conditions (e.g. Incendiary Powder) don't get Chemical Rounds amplification
  if (application?.source === 'Trait') return multiplier;
  const skill = skillForEvent(context.profession?.catalog, context.event, context.skillId);
  // condition events from different layers carry the weapon type at different paths — check all three
  if (event?.skillWeapon !== 'Pistol' && event?.application?.skillWeapon !== 'Pistol' && skill?.weapon !== 'Pistol') {
    return multiplier;
  }

  const chemicalRoundsProfile = requireBalanceProfileFromContext(context, TRAIT.CHEMICAL_ROUNDS);
  // Apply the skill-specific increase uniformly so every pistol condition keeps it beyond the global duration cap.
  return multiplier * balanceProfileNumber(chemicalRoundsProfile, 'conditionDurationMultiplier');
}

/** Selects Heavy Metal's critical bonus from the target's current health tier. */
export function heavyMetalBonus(context: Gw2ModifierContext): number {
  const fraction = targetHealthFraction(context);
  const heavyMetalProfile = requireBalanceProfileFromContext(context, TRAIT.HEAVY_METAL);
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'lowerThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'lowerBonus');
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'middleThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'middleBonus');
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'upperThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'upperBonus');
  return 0;
}

/** Sharpshooter scales Bleeding from final Power after all attribute owners have contributed. */
export function applySharpshooterConditionAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  return powerScaledConditionAttributes(context, attributes, 'Bleeding', TRAIT.SHARPSHOOTER);
}

/** No Scope's live boon bonus is excluded before the mech inherits the player's base attributes. */
export function noScopeBoonFerocity(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.NO_SCOPE) && activeBoonStacks(context, 'fury', 1) > 0
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE), 'attributeBonus')
    : 0;
}

/** Applies Energy Amplifier at the live attribute boundary while preserving build provenance. */
export function applyEnergyAmplifierAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (
    hasTrait(context, TRAIT.ENERGY_AMPLIFIER) &&
    activeBoonStacks(context, 'regeneration', 1) > 0 &&
    // only skip if regen is a permanent assumption AND build attributes already account for it
    !(professionStaticRulesApplied(context.config) && Boolean(context.config?.boons?.regeneration))
  ) {
    const energyAmplifierProfile = requireBalanceProfileFromContext(context, TRAIT.ENERGY_AMPLIFIER);
    const attributeBonus = balanceProfileNumber(energyAmplifierProfile, 'attributeBonus');
    modified.power = (modified.power || 0) + attributeBonus;
    modified.healingPower = (modified.healingPower || 0) + attributeBonus;
  }
}
