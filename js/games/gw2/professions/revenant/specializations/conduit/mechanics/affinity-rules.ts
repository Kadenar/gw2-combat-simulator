import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isDamagingCondition } from '#gw2/platform/combat/state/targets.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { bolsteredBondsBonuses } from '#gw2/professions/revenant/specializations/conduit/traits/bolstered-bonds.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';

function affinity(context: Gw2ModifierContext): number {
  // Kinetic Insight adds a flat +2 bonus to affinity for modifier calculations without changing actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  return Math.min(
    Math.max(1, Number(revenantRuntimeSpecializationState(context, 'Conduit').affinityMaximum || 5)),
    Number(revenantRuntimeSpecializationState(context, 'Conduit').affinity || 0) + bonus
  );
}

function equippedLegend(context: Gw2ModifierContext, legendId: string): boolean {
  return (revenantRuntimeCoreState(context).selectedLegendIds || []).includes(legendId);
}

export const conduitModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.targeted-destruction-numinous-gift',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      vulnerabilityPerStack: 0.005,
      bonus: 0.05
    } as Readonly<Record<string, number>>,
    // Numinous Gift unlocks Targeted Destruction's bonus; the factor is expressed as a multiplier delta on top of
    // the existing vulnerability bonus so both traits stack multiplicatively with the base formula.
    factor: (context, _target, parameters) => {
      const base = 1 + vulnerabilityStacks(context) * parameters.vulnerabilityPerStack;
      return (base + parameters.bonus) / base;
    },
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.TARGETED_DESTRUCTION) &&
      hasTrait(context, TRAIT.NUMINOUS_GIFT)
  },
  {
    id: 'revenant.release-dervish-assassin-affinity',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerAffinity: 0.1 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + affinity(context) * parameters.damagePerAffinity,
    when: (context) =>
      ([ID.RELEASE_POTENTIAL_DERVISH, ID.RELEASE_POTENTIAL_ASSASSIN] as readonly number[]).includes(
        Number(context.event?.skillId)
      )
  },
  {
    id: 'revenant.release-warrior-affinity',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerAffinity: 0.15 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + affinity(context) * parameters.damagePerAffinity,
    when: (context) => context.event?.skillId === ID.RELEASE_POTENTIAL_WARRIOR
  },
  {
    id: 'revenant.beguiling-haze-assassin-resonance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    // Assassin resonance doubles Beguiling Haze damage when Assassin is equipped (not necessarily active).
    factor: 2,
    when: (context) =>
      BEGUILING_HAZE_SKILL_IDS.has(Number(context.event?.skillId)) && equippedLegend(context, LEGEND.ASSASSIN)
  },
  {
    id: 'revenant.twin-moon-assassin-resonance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    when: (context) =>
      TWIN_MOON_SKILL_IDS.has(Number(context.event?.skillId)) && equippedLegend(context, LEGEND.ASSASSIN)
  },
  {
    id: 'revenant.yearning-empowerment-numinous-gift',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, 'revenant.conduit.numinous-gift'),
        'conditionDurationBonus'
      ),
    when: (context) =>
      isDamagingCondition(context.condition) &&
      hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
      hasTrait(context, TRAIT.NUMINOUS_GIFT) &&
      !professionStaticRulesApplied(context.config)
  }
]);

function modifyConduitAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes } as Record<string, number>;
  if (context.config?.specialization !== 'Conduit') return modified;
  const state = revenantRuntimeSpecializationState(context, 'Conduit');
  const coreState = revenantRuntimeCoreState(context);
  // Cosmic Wisdom doubles the Bolstered Bonds bonus; the build-time static pass already applied one copy,
  // so at runtime we add only the extra copies: 2 (active) - 1 (already in build stats) = 1 extra during form,
  // or 1 (inactive) - 1 (already in build stats) = 0 during non-form (effectively a no-op addition).
  const cosmicMultiplier =
    Number(state.cosmicWisdomUntil || 0) > context.time
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS), 'attributeMultiplier')
      : 1;
  const buildMultiplier = professionStaticRulesApplied(context.config) ? 1 : 0;
  const bonuses = bolsteredBondsBonuses(context, coreState.selectedLegendIds, cosmicMultiplier - buildMultiplier);
  for (const [attribute, bonus] of Object.entries(bonuses)) {
    modified[attribute] = Number(modified[attribute] || 0) + Number(bonus || 0);
  }

  return modified;
}

export const conduitAttributeRules = Object.freeze({
  modifierRules: conduitModifierRules,
  modifyAttributes: modifyConduitAttributes
});
