import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';
import { soulbeastArchetypeAttributes } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/archetype-attributes.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { boonActive, playerHealthFraction, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { rangerPetByName, selectedRangerPet } from '#gw2/professions/ranger/core/state.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { denySkillCast as deny } from '#gw2/professions/shared/availability.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats, Gw2NumericStatKey } from '#gw2/platform/combat/query/combat-query.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';

// Three-layer lookup: static config assumptions → timeline snapshot → live resolver boon map.
// Config/timeline are checked first because runtime may not be populated during attribute pre-computation.
function activeBuff(context: RangerModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  if (context.timeline?.timedActive(kind, context.time)) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application: { at: number; expiresAt: number; stacks: number }) =>
      application.at <= context.time && application.expiresAt > context.time && application.stacks > 0
  );
}

// With player health fixed at 100%, Oppressive Superiority activates when the target is below full health.
function oppressiveSuperiorityActive(context: RangerModifierContext): boolean {
  return (
    hasTrait(context, TRAIT.OPPRESSIVE_SUPERIORITY) && targetHealthFraction(context) < playerHealthFraction(context)
  );
}

function beastmodeActive(context: RangerModifierContext): boolean {
  return Boolean(
    readProfessionSpecializationState<{ beastmodeActive?: boolean }>(context.runtime?.profession, 'Soulbeast')
      ?.beastmodeActive
  );
}

const PACK_ALPHA_RUNTIME_ATTRIBUTES = Object.freeze([
  'power',
  'conditionDamage',
  'precision',
  'toughness',
  'vitality'
] as const);

// Resolve the merged pet archetype's live attribute contribution, including
// trait adjustments, without mutating the shared base stats.

function petArchetype(context: RangerModifierContext, active: boolean): string {
  const configured = active
    ? readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet ||
      context.config?.selectedPet
    : context.config?.selectedPet;
  return rangerPetByName(String(configured || 'Pig')).archetype;
}

/** Reconciles Soulbeast merge attributes against the calculator's static merged baseline. */
function modifySoulbeastAttributes(context: RangerModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const merged = beastmodeActive(context);
  const adjust = (attribute: Gw2NumericStatKey, amount: number): void => {
    result[attribute] = Number(result[attribute] || 0) + amount;
  };

  if (!staticRulesApplied && merged) {
    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      for (const attribute of PACK_ALPHA_RUNTIME_ATTRIBUTES) {
        const packAlphaProfile = requireBalanceProfileFromContext(context, CORE_PROFILE.packAlpha);
        adjust(attribute, balanceProfileNumber(packAlphaProfile, 'attributeBonus'));
      }
    }

    if (hasTrait(context, TRAIT.PETS_PROWESS)) {
      const petsProwessProfile = requireBalanceProfileFromContext(context, CORE_PROFILE.petsProwess);
      adjust('ferocity', balanceProfileNumber(petsProwessProfile, 'attributeBonus'));
    }

    for (const [attribute, amount] of Object.entries(
      soulbeastArchetypeAttributes(context, petArchetype(context, true))
    )) {
      adjust(attribute as Gw2NumericStatKey, Number(amount));
    }
  } else if (staticRulesApplied && !merged) {
    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      for (const attribute of PACK_ALPHA_RUNTIME_ATTRIBUTES)
        adjust(
          attribute,
          -balanceProfileNumber(requireBalanceProfileFromContext(context, CORE_PROFILE.packAlpha), 'attributeBonus')
        );
    }

    if (hasTrait(context, TRAIT.PETS_PROWESS))
      adjust(
        'ferocity',
        -balanceProfileNumber(requireBalanceProfileFromContext(context, CORE_PROFILE.petsProwess), 'attributeBonus')
      );

    for (const [attribute, amount] of Object.entries(
      soulbeastArchetypeAttributes(context, petArchetype(context, false))
    )) {
      adjust(attribute as Gw2NumericStatKey, -Number(amount));
    }
  } else if (staticRulesApplied && merged) {
    const configuredArchetype = petArchetype(context, false);
    const activeArchetype = petArchetype(context, true);

    for (const [attribute, amount] of Object.entries(soulbeastArchetypeAttributes(context, configuredArchetype))) {
      adjust(attribute as Gw2NumericStatKey, -Number(amount));
    }

    for (const [attribute, amount] of Object.entries(soulbeastArchetypeAttributes(context, activeArchetype))) {
      adjust(attribute as Gw2NumericStatKey, Number(amount));
    }
  }

  return result;
}

export function soulbeastCastAvailability(context: RangerRuntime, skill: RangerSkill): AvailabilityResult {
  const state = soulbeastState.from(context);
  const toggle = skill.id === ID.BEASTMODE || skill.id === ID.LEAVE_BEASTMODE;
  // Wrong-pet check must precede the beastmode-active check: a skill can be a beastmodeSkill
  // but still invalid if it belongs to a different pet than the one currently selected.
  if (skill.beastmodeSkill && !toggle && !selectedRangerPet(context.config)?.beastmodeSkillIds.includes(skill.id)) {
    return deny(skill, 'ranger.inactive-merged-pet-skill', 'select the pet that grants this merged Beast skill.');
  }

  if (skill.beastmodeSkill && !state.beastmodeActive && skill.id !== ID.BEASTMODE) {
    return deny(skill, 'ranger.beastmode-inactive', 'enter Beastmode first.');
  }

  if (skill.id === ID.BEASTMODE && state.beastmodeActive) {
    return deny(skill, 'ranger.beastmode-active', 'Beastmode is already active.');
  }

  if (skill.id === ID.LEAVE_BEASTMODE && !state.beastmodeActive) {
    return deny(skill, 'ranger.beastmode-inactive', 'Beastmode is not active.');
  }

  return { ready: true };
}

// Soulbeast player modifiers follow outgoing ownership while merged-pet state remains a separate prerequisite.
export const soulbeastModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.loud-whistle-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && beastmodeActive(context) && hasTrait(context, TRAIT.LOUD_WHISTLE)
  },
  {
    id: 'ranger.furious-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    // Furious Strength requires the player to have Fury; pet fury does not count.
    when: (context) => hasTrait(context, TRAIT.FURIOUS_STRENGTH) && boonActive(context, 'fury')
  },
  {
    id: 'ranger.sic-em-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) => activeBuff(context, 'sic-em')
  },
  {
    id: 'ranger.lesser-sic-em-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) => activeBuff(context, 'lesser-sic-em')
  },
  {
    id: 'ranger.twice-as-vicious-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) => activeBuff(context, 'twice-as-vicious')
  },
  {
    id: 'ranger.twice-as-vicious-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => activeBuff(context, 'twice-as-vicious')
  },
  {
    id: 'ranger.oppressive-superiority',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: oppressiveSuperiorityActive
  },
  {
    id: 'ranger.oppressive-superiority-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.OPPRESSIVE_SUPERIORITY),
        'conditionDurationBonus'
      ),
    when: oppressiveSuperiorityActive
  }
]);

export const soulbeastAttributeRules = Object.freeze({
  modifyAttributes: modifySoulbeastAttributes,
  modifierRules: soulbeastModifierRules
});
