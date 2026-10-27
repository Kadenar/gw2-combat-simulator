import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceNumberFromContext, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { revenantRuntimeSpecializationState } from '#gw2/professions/revenant/core/state-queries.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

const LEGEND_ATTRIBUTE_GROUPS = new Map<string, string>([
  [LEGEND.ASSASSIN, 'assassinAttributeBonuses'],
  [LEGEND.CENTAUR, 'centaurAttributeBonuses'],
  [LEGEND.DEMON, 'demonAttributeBonuses'],
  [LEGEND.DWARF, 'dwarfAttributeBonuses'],
  [LEGEND.ENTITY, 'entityAttributeBonuses']
]);

/** Each selected legend contributes its named grants, preserving shared attributes and the active multiplier. */
export function bolsteredBondsBonuses(
  context: unknown,
  selectedLegendIds: readonly string[] = [],
  multiplier = 1
): Record<string, number> {
  if (!multiplier) return {};

  const bonuses: Record<string, number> = {};
  for (const legendId of selectedLegendIds) {
    const group = LEGEND_ATTRIBUTE_GROUPS.get(legendId);

    if (!group) continue;

    const profile = requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS);
    for (const [attribute, amount] of Object.entries(profile[group] as Readonly<Record<string, number>>))
      bonuses[attribute] = (bonuses[attribute] ?? 0) + amount * multiplier;
  }

  return bonuses;
}

/** Scales the already-selected base recharge at the original mechanic boundary. */
const enhancedEmbodimentRecharge = compileRechargeRules<RevenantRuntimeState, RevenantSkill>([
  {
    trait: TRAIT.ENHANCED_EMBODIMENT,
    when: (runtime, skill) => skill.id === ID.SWAP_LEGENDS && runtime.engagement.combatMechanicsAllowed(),
    multiplier: { profile: TRAIT.ENHANCED_EMBODIMENT, field: 'rechargeMultiplier' }
  }
]);

/** Applies the selected legend-swap cooldown after Core's precombat adjustment. */
export function enhancedLegendRecharge(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill,
  work: number
): number {
  if (work === 0 || !runtime.engagement.combatMechanicsAllowed() || !hasTrait(runtime, TRAIT.ENHANCED_EMBODIMENT))
    return work;

  return enhancedEmbodimentRecharge(runtime, skill, Math.max(0, skill.cooldown ?? work));
}

export function affinity(context: Gw2ModifierContext): number {
  // Kinetic Insight adds its patched affinity bonus for modifier calculations without changing actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT)
    ? balanceNumberFromContext(context, TRAIT.KINETIC_INSIGHT, 'resourceGain')
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
        ? balanceNumberFromContext(runtime, TRAIT.KINETIC_INSIGHT, 'resourceGain')
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
