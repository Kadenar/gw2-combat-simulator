import { professionStaticRulesApplied } from '../../../../platform/gw2/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/combat/modifiers/rules.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { CAST_READY, denyCast } from '../../../../platform/engine/skills/availability.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { cloneNecromancerAttributes, necromancerRuntimeSpecializationState } from '../../core/rules.js';
import type { AvailabilityResult, SchedulerRecord } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/combat/modifiers/types.js';
import type { NecromancerAmmoModifierContext, NecromancerRechargeModifierContext } from '../../types.js';
import type {
  NecromancerPrecastContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '../../types.js';
import { necromancerBalanceProfile } from '../../core/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import {
  gainNecromancerLifeForce,
  hasTrait as hasNecromancerTrait,
  registerNecromancerBoonConcentrationModifier
} from '../../core/shared.js';
import { purgeScourgeTimedState, scourgeState } from './state.js';

function modifyScourgeAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config) && hasTrait(context, TRAIT.FELL_BEACON)) {
    // Fell Beacon converts 7% of condition damage into expertise; must use raw
    // gear stats (config.stats) not the merged attribute record because might
    // stacks and trait bonuses like Lingering Curse are already folded in there
    result.expertise +=
      Number(context.config?.stats?.conditionDamage || 0) *
      Number(necromancerBalanceProfile(context, PROFILE.fellBeacon)?.attributeConversion || 0.07);
  }

  if (
    hasTrait(context, TRAIT.SAND_SAGE) &&
    // Bonus only applies when at least one shade is alive — check expiry timestamps against current sim time
    (necromancerRuntimeSpecializationState(context).shades || []).some((expiresAt: number) => expiresAt > context.time)
  ) {
    const bonus = Number(necromancerBalanceProfile(context, PROFILE.sandSage)?.attributeBonus || 225);
    result.concentration += bonus;
    result.expertise += bonus;
  }

  return result;
}

function modifyScourgeRechargeDuration(context: NecromancerRechargeModifierContext, duration: number): number {
  // Sand Savant adds a 25% recharge penalty alongside the ammo cap reduction to 1
  return context.skill?.id === ID.MANIFEST_SAND_SHADE && hasTrait(context, TRAIT.SAND_SAVANT)
    ? duration * Number(necromancerBalanceProfile(context, PROFILE.sandSavant)?.rechargePenalty || 1.25)
    : duration;
}

function modifyScourgeMaximumAmmo(context: NecromancerAmmoModifierContext, maximum: number): number {
  // Sand Savant merges all 3 shades into a single more-powerful shade; only 1 charge allowed
  return context.skill?.id === ID.MANIFEST_SAND_SHADE && hasTrait(context, TRAIT.SAND_SAVANT)
    ? Number(necromancerBalanceProfile(context, PROFILE.sandSavant)?.maximumStacks || 1)
    : maximum;
}

/** Selects the one Scourge F5 variant enabled by Herald of Sorrow for this command attempt. */
function scourgeBuildAvailability(context: NecromancerPrecastContext, skill: NecromancerSkill): AvailabilityResult {
  // Herald of Sorrow owns the mutually exclusive F5 replacement at the Scourge boundary.
  if (skill.id === ID.SANDSTORM_SHROUD) {
    return hasNecromancerTrait(context, TRAIT.HERALD_OF_SORROW)
      ? CAST_READY
      : denyCast('necromancer.trait-replacement', `${skill.name} is unavailable — requires Herald of Sorrow.`);
  }
  if (skill.id === ID.DESERT_SHROUD) {
    return hasNecromancerTrait(context, TRAIT.HERALD_OF_SORROW)
      ? denyCast(
          'necromancer.trait-replacement',
          `${skill.name} is unavailable — replaced by Sandstorm Shroud while Herald of Sorrow is selected.`
        )
      : CAST_READY;
  }
  return CAST_READY;
}

function initializeScourgeRuntime(context: NecromancerSchedulerContext): void {
  registerNecromancerBoonConcentrationModifier(context, 'scourge.sand-sage', (runtime, concentration, at) => {
    const activeShade = scourgeState.from(runtime).shades.some((expiresAt: number) => expiresAt > at);
    if (!activeShade || !hasNecromancerTrait(runtime, TRAIT.SAND_SAGE)) return concentration;
    return concentration + Number(necromancerBalanceProfile(runtime, PROFILE.sandSage)?.attributeBonus || 225);
  });
}

// Observe scheduled shade and barrier events to update Scourge trait state only
// after their canonical timestamps and ownership are known.
function onScourgeEventScheduled(context: NecromancerSchedulerContext, event: NecromancerSimulationEvent): void {
  const state = scourgeState.from(context);
  if (
    event.type !== 'condition' ||
    event.condition !== 'Burning' ||
    !hasNecromancerTrait(context, TRAIT.NOURISHING_ASHES) ||
    event.at < state.nourishingAshesReadyAt
  ) {
    return;
  }

  const profile = necromancerBalanceProfile(context, PROFILE.nourishingAshes);
  state.nourishingAshesReadyAt = event.at + Number(profile?.cooldown || 3);
  gainNecromancerLifeForce(context, Number(profile?.lifeForceGain || 5), event.at, 'nourishing-ashes');
}

export const scourgeSchedulerHooks = Object.freeze({
  initialize: {
    id: 'scourge.initialize-runtime',
    order: 10,
    handler: initializeScourgeRuntime
  },
  advance: {
    id: 'scourge.purge-shades',
    order: -10,
    handler: (context: NecromancerSchedulerContext, target: number) =>
      purgeScourgeTimedState(scourgeState.from(context), target)
  },
  onEventScheduled: {
    id: 'scourge.nourishing-ashes',
    order: 10,
    handler: onScourgeEventScheduled
  }
});

export const scourgeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'necromancer.fell-beacon',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => context.condition === 'Burning' && hasTrait(context, TRAIT.FELL_BEACON)
  },
  {
    id: 'necromancer.demonic-lore',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.33,
    order: 100,
    when: (context) => context.condition === 'Torment' && hasTrait(context, TRAIT.DEMONIC_LORE)
  }
]);

export const scourgeAttributeRules = Object.freeze({
  modifyAttributes: modifyScourgeAttributes,
  modifierRules: scourgeModifierRules
});

export const scourgeCastRules = Object.freeze({
  availability: {
    id: 'scourge.build',
    order: 120,
    handler: scourgeBuildAvailability
  },
  modifyRechargeDuration: modifyScourgeRechargeDuration,
  modifyMaximumAmmo: modifyScourgeMaximumAmmo
});
