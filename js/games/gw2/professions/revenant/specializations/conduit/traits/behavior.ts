import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantRuntimeSpecializationState } from '#gw2/professions/revenant/core/state-queries.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

// Legendary Entity grants every attribute represented by Bolstered Bonds.
const ALL_ATTRIBUTES = Object.freeze([
  'power',
  'precision',
  'toughness',
  'vitality',
  'ferocity',
  'conditionDamage',
  'expertise',
  'concentration',
  'healingPower'
]);

/**
 * Calculates the combined Bolstered Bonds bonuses for the selected legends.
 *
 * Each supported legend contributes its own attribute pair; Legendary Entity
 * contributes every attribute. Legends without a Bolstered Bonds bonus are
 * ignored.
 *
 * Bonuses keyed by runtime attribute name.
 */
export function bolsteredBondsBonuses(
  context: unknown,
  selectedLegendIds: readonly string[] = [],
  multiplier = 1
): Record<string, number> {
  if (!multiplier) return {};
  const bonuses: Record<string, number> = {};
  const add = (attribute: string, amount: number): void => {
    bonuses[attribute] = (bonuses[attribute] || 0) + amount * multiplier;
  };

  for (const legendId of selectedLegendIds) {
    if (legendId === LEGEND.ASSASSIN) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('power', balanceProfileNumber(bolsteredBondsProfile, 'assassinAttributeBonus'));
      add('ferocity', balanceProfileNumber(bolsteredBondsProfile, 'assassinAttributeBonus'));
    } else if (legendId === LEGEND.CENTAUR) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('healingPower', balanceProfileNumber(bolsteredBondsProfile, 'centaurAttributeBonus'));
      add('concentration', balanceProfileNumber(bolsteredBondsProfile, 'centaurAttributeBonus'));
    } else if (legendId === LEGEND.DEMON) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('conditionDamage', balanceProfileNumber(bolsteredBondsProfile, 'demonAttributeBonus'));
      add('expertise', balanceProfileNumber(bolsteredBondsProfile, 'demonAttributeBonus'));
    } else if (legendId === LEGEND.DWARF) {
      const bolsteredBondsProfile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
      add('toughness', balanceProfileNumber(bolsteredBondsProfile, 'dwarfAttributeBonus'));
      add('vitality', balanceProfileNumber(bolsteredBondsProfile, 'dwarfAttributeBonus'));
    } else if (legendId === LEGEND.ENTITY) {
      for (const attribute of ALL_ATTRIBUTES)
        add(
          attribute,
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS), 'entityAttributeBonus')
        );
    }
  }

  return bonuses;
}

/** Scales the already-selected base recharge at the original mechanic boundary. */
export const enhancedEmbodimentRecharge = compileRechargeRules<RevenantRuntimeState, RevenantSkill>([
  {
    trait: TRAIT.ENHANCED_EMBODIMENT,
    when: (runtime, skill) => skill.id === ID.SWAP_LEGENDS && runtime.combatStartedAt(),
    multiplier: { profile: PROFILE.enhancedEmbodiment, field: 'rechargeMultiplier' }
  }
]);

/** Applies the selected legend-swap cooldown after Core's precombat adjustment. */
export function enhancedLegendRecharge(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill,
  work: number
): number {
  if (work === 0 || !runtime.combatStartedAt() || !hasTrait(runtime, TRAIT.ENHANCED_EMBODIMENT)) return work;
  return enhancedEmbodimentRecharge(runtime, skill, Math.max(0, skill.cooldown ?? work));
}

export function affinity(context: Gw2ModifierContext): number {
  // Kinetic Insight adds its patched affinity bonus for modifier calculations without changing actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.KINETIC_INSIGHT), 'resourceGain')
    : 0;
  const pool = revenantRuntimeSpecializationState(context, 'Conduit').affinity;
  return pool ? Math.min(pool.maximum, pool.value + bonus) : 0;
}

/** Kinetic Insight adds its patched virtual affinity bonus for scaling without changing the stored value. */
export function effectiveConduitAffinity(runtime: MechanicQueriesOf<RevenantRuntime>): number {
  const pool = conduitState.from(runtime).affinity;
  return Math.min(
    pool.maximum,
    runtime.resourceController.value('affinity') +
      (hasTrait(runtime, TRAIT.KINETIC_INSIGHT)
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.KINETIC_INSIGHT), 'resourceGain')
        : 0)
  );
}

/** Scales the already-selected base recharge at the original mechanic boundary. */
export const kineticInsightRecharge = compileRechargeRules<RevenantRuntimeState, RevenantSkill>([
  {
    trait: TRAIT.KINETIC_INSIGHT,
    when: (_runtime, skill) => RELEASE_POTENTIAL_IDS.has(skill.id),
    multiplier: { profile: TRAIT.KINETIC_INSIGHT, field: 'rechargeMultiplier' }
  }
]);

const RELEASE_POTENTIAL_IDS = new Set<SkillId>(Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND));
