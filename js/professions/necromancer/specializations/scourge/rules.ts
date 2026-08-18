import { professionStaticRulesApplied } from '../../../../platform/gw2/attribute-provenance.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { cloneNecromancerAttributes, necromancerRuntimeSpecializationState } from '../../core/rules.js';
import type { SchedulerRecord } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type { NecromancerAmmoModifierContext, NecromancerRechargeModifierContext } from '../../types.js';
import { necromancerBalanceProfile } from '../../core/profiles.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

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
  modifyRechargeDuration: modifyScourgeRechargeDuration,
  modifyMaximumAmmo: modifyScourgeMaximumAmmo
});
