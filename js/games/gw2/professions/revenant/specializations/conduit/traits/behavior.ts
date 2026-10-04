import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState
} from '#gw2/professions/revenant/core/modifiers.js';
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from '#gw2/professions/revenant/data/legends.js';
import { gainAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import { scheduleFormExpiry } from '#gw2/professions/revenant/specializations/conduit/mechanics/form-expiry.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { numinousGift } from '#gw2/professions/revenant/specializations/conduit/traits/numinous-gift.js';
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

export function modifyConduitAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes } as Record<string, number>;
  if (context.config?.specialization !== 'Conduit') return modified;
  const state = revenantRuntimeSpecializationState(context, 'Conduit');
  const coreState = revenantRuntimeCoreState(context);
  // Cosmic Wisdom doubles the Bolstered Bonds bonus; the build-time static pass already applied one copy,
  // so at runtime we add only the extra copies: 2 (active) - 1 (already in build stats) = 1 extra during form,
  // or 1 (inactive) - 1 (already in build stats) = 0 during non-form (effectively a no-op addition).
  const cosmicMultiplier =
    (state.cosmicWisdomUntil || 0) > context.time
      ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BOLSTERED_BONDS), 'attributeMultiplier')
      : 1;
  const buildMultiplier = professionStaticRulesApplied(context.config) ? 1 : 0;
  const bonuses = bolsteredBondsBonuses(context, coreState.selectedLegendIds, cosmicMultiplier - buildMultiplier);
  for (const [attribute, bonus] of Object.entries(bonuses)) {
    modified[attribute] = (modified[attribute] || 0) + (bonus || 0);
  }

  return modified;
}

/** Weapon casts grant affinity after the mechanic has established a positive Energy cost. */
export function grantConductiveArmaments(runtime: RevenantRuntime, skill: RevenantSkill): void {
  if (skill.type === 'Weapon' && hasTrait(runtime, TRAIT.CONDUCTIVE_ARMAMENTS)) gainAffinity(runtime, 1);
}

/** Applies the trait at the mechanic's existing execution boundary. */
export function extendEnhancedEmbodiment(runtime: RevenantRuntime, formActive: boolean): void {
  const state = conduitState.from(runtime);
  if (formActive && hasTrait(runtime, TRAIT.ENHANCED_EMBODIMENT)) {
    const enhanced = requireBalanceProfileFromContext(runtime, PROFILE.enhancedEmbodiment);
    const extension = requireEffect(enhanced, 'buff', 'cosmic-wisdom-extension');
    if (extension) {
      state.cosmicWisdomUntil += Math.max(0, effectNumber(enhanced, extension, 'duration'));
      scheduleFormExpiry(runtime);
    }
  }
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

/** Applies the trait at the mechanic's existing execution boundary. */
export function grantExpandedConsciousness(runtime: RevenantRuntime, previous: number, maximum: number): void {
  const state = conduitState.from(runtime);
  if (previous < maximum && state.affinity === maximum && hasTrait(runtime, TRAIT.EXPANDED_CONSCIOUSNESS))
    runtime.resourceController.grant(
      'energy',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.expandedConsciousness), 'resourceGain')
    );
}

/** Applies the trait at the mechanic's existing execution boundary. */
export function grantFoundPurpose(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, combat: boolean): void {
  if (combat && hasTrait(runtime, TRAIT.FOUND_PURPOSE)) numinousGift(runtime, cast, true);
}

export function affinity(context: Gw2ModifierContext): number {
  // Kinetic Insight adds its patched affinity bonus for modifier calculations without changing actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.KINETIC_INSIGHT), 'resourceGain')
    : 0;
  return Math.min(
    Math.max(1, revenantRuntimeSpecializationState(context, 'Conduit').affinityMaximum || 5),
    (revenantRuntimeSpecializationState(context, 'Conduit').affinity || 0) + bonus
  );
}

/** Kinetic Insight adds its patched virtual affinity bonus for scaling without changing the stored value. */
export function effectiveConduitAffinity(runtime: MechanicQueriesOf<RevenantRuntime>): number {
  const maximum = Math.max(
    1,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'maximumStacks')
  );
  return Math.min(
    maximum,
    (conduitState.from(runtime).affinity || 0) +
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

/** Applies the trait at the mechanic's existing execution boundary. */
export function grantLingeringDetermination(runtime: RevenantRuntime, combat: boolean): void {
  if (combat && hasTrait(runtime, TRAIT.LINGERING_DETERMINATION))
    gainAffinity(
      runtime,
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.lingeringDetermination), 'resourceGain')
      )
    );
}

/** Applies the trait at the mechanic's existing execution boundary. */
export function emitCosmicMistfire(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (hasTrait(runtime, TRAIT.MISTFIRE)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.mistfire);
    runtime.effects.emit({
      kind: 'profile',
      profile: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'strike' || effect.type === 'condition'),
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.MISTFIRE,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: TRAIT.MISTFIRE,
        skillName: 'Mistfire',
        activationId: cast.id
      },
      transform: (event) => ({
        ...event,
        name: event.type === 'damage' ? 'Mistfire' : 'Mistfire — Burning',
        skillWeapon: 'Unequipped'
      })
    });
  }
}
