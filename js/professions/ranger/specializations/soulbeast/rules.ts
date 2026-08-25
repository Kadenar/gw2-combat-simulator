import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/combat/modifiers/rules.js';
import { professionStaticRulesApplied } from '../../../../platform/gw2/builds/attribute-provenance.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import { playerHealthFraction, targetHealthFraction } from '../../../../platform/gw2/combat/query/runtime-query.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { setRangerPetActive } from '../../core/pets.js';
import { rangerBalanceValue, RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '../../core/profiles.js';
import { rangerPetByName, selectedRangerPet } from '../../core/state.js';
import { applyRangerBeastSkillTraits } from '../../core/traits.js';
import type { AvailabilityResult } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '../../../../platform/gw2/combat/query/types.js';
import type { RangerCastContext, RangerPrecastContext, RangerSchedulerContext, RangerSkill } from '../../types.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { soulbeastState } from './state.js';

function deny(skill: RangerSkill, code: string, cause: string): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`
  };
}

// Three-layer lookup: static config assumptions → timeline snapshot → live resolver boon map.
// Config/timeline are checked first because runtime may not be populated during attribute pre-computation.
function activeBuff(context: Gw2ModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  if (context.timeline?.timedActive(kind, context.time)) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application: { at: number; expiresAt: number; stacks: number }) =>
      application.at <= context.time && application.expiresAt > context.time && application.stacks > 0
  );
}

// Oppressive Superiority activates when the target's HP fraction is below the player's HP fraction —
// playerHealthFraction defaults to 1 (full HP) if unset, making the condition always false unless configured.
function oppressiveSuperiorityActive(context: Gw2ModifierContext): boolean {
  return (
    hasTrait(context, TRAIT.OPPRESSIVE_SUPERIORITY) && targetHealthFraction(context) < playerHealthFraction(context)
  );
}

function beastmodeActive(context: Gw2ModifierContext): boolean {
  const profession = (
    context.runtime as { profession?: { specialization?: { kind?: string; state?: unknown } } } | undefined
  )?.profession;
  return Boolean(
    profession?.specialization?.kind === 'Soulbeast' &&
    (profession.specialization.state as { beastmodeActive?: boolean })?.beastmodeActive
  );
}

const PACK_ALPHA_RUNTIME_ATTRIBUTES = Object.freeze([
  'power',
  'conditionDamage',
  'precision',
  'toughness',
  'vitality'
] as const);

const SOULBEAST_ARCHETYPE_RUNTIME_ATTRIBUTES: Readonly<
  Record<string, Readonly<Partial<Record<keyof Gw2ResolvedStats, number>>>>
> = Object.freeze({
  Stout: Object.freeze({ toughness: 200, vitality: 100 }),
  Deadly: Object.freeze({ conditionDamage: 150, precision: 100 }),
  Versatile: Object.freeze({ vitality: 200, concentration: 225 }),
  Ferocious: Object.freeze({ power: 150, ferocity: 100 }),
  Supportive: Object.freeze({ vitality: 100 })
});

function soulbeastArchetypeAttributes(
  context: Gw2ModifierContext,
  archetype: string
): Readonly<Partial<Record<keyof Gw2ResolvedStats, number>>> {
  switch (archetype) {
    case 'Stout':
      return {
        toughness: rangerBalanceValue(context, PROFILE.stoutArchetype, 'attributeBonus', 200),
        vitality: rangerBalanceValue(context, PROFILE.stoutArchetype, 'weaponAttributeBonus', 100)
      };
    case 'Deadly':
      return {
        conditionDamage: rangerBalanceValue(context, PROFILE.deadlyArchetype, 'attributeBonus', 150),
        precision: rangerBalanceValue(context, PROFILE.deadlyArchetype, 'weaponAttributeBonus', 100)
      };
    case 'Versatile':
      return {
        vitality: rangerBalanceValue(context, PROFILE.versatileArchetype, 'attributeBonus', 200),
        concentration: rangerBalanceValue(context, PROFILE.versatileArchetype, 'weaponAttributeBonus', 225)
      };
    case 'Ferocious':
      return {
        power: rangerBalanceValue(context, PROFILE.ferociousArchetype, 'attributeBonus', 150),
        ferocity: rangerBalanceValue(context, PROFILE.ferociousArchetype, 'weaponAttributeBonus', 100)
      };
    case 'Supportive':
      return { vitality: rangerBalanceValue(context, PROFILE.supportiveArchetype, 'attributeBonus', 100) };
    default:
      return {};
  }
}

function petArchetype(context: Gw2ModifierContext, active: boolean): string {
  const configured = active
    ? (context.runtime as { profession?: { core?: { activePet?: string } } } | undefined)?.profession?.core
        ?.activePet || context.config?.selectedPet
    : context.config?.selectedPet;
  return rangerPetByName(String(configured || 'Pig')).archetype;
}

/** Reconciles Soulbeast merge attributes against the calculator's static merged baseline. */
function modifySoulbeastAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const merged = beastmodeActive(context);
  const adjust = (attribute: keyof Gw2ResolvedStats, amount: number): void => {
    result[attribute] = Number(result[attribute] || 0) + amount;
  };

  if (!staticRulesApplied && merged) {
    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      for (const attribute of PACK_ALPHA_RUNTIME_ATTRIBUTES) {
        adjust(attribute, rangerBalanceValue(context, CORE_PROFILE.packAlpha, 'attributeBonus', 150));
      }
    }

    if (hasTrait(context, TRAIT.PETS_PROWESS)) {
      adjust('ferocity', rangerBalanceValue(context, CORE_PROFILE.petsProwess, 'attributeBonus', 300));
    }

    for (const [attribute, amount] of Object.entries(
      soulbeastArchetypeAttributes(context, petArchetype(context, true))
    )) {
      adjust(attribute as keyof Gw2ResolvedStats, Number(amount));
    }
  } else if (staticRulesApplied && !merged) {
    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      for (const attribute of PACK_ALPHA_RUNTIME_ATTRIBUTES) adjust(attribute, -150);
    }

    if (hasTrait(context, TRAIT.PETS_PROWESS)) adjust('ferocity', -300);

    for (const [attribute, amount] of Object.entries(
      SOULBEAST_ARCHETYPE_RUNTIME_ATTRIBUTES[petArchetype(context, false)] || {}
    )) {
      adjust(attribute as keyof Gw2ResolvedStats, -Number(amount));
    }
  } else if (staticRulesApplied && merged) {
    const configuredArchetype = petArchetype(context, false);
    const activeArchetype = petArchetype(context, true);

    for (const [attribute, amount] of Object.entries(
      SOULBEAST_ARCHETYPE_RUNTIME_ATTRIBUTES[configuredArchetype] || {}
    )) {
      adjust(attribute as keyof Gw2ResolvedStats, -Number(amount));
    }

    for (const [attribute, amount] of Object.entries(soulbeastArchetypeAttributes(context, activeArchetype))) {
      adjust(attribute as keyof Gw2ResolvedStats, Number(amount));
    }

    if (hasTrait(context, TRAIT.PACK_ALPHA)) {
      const bonus = rangerBalanceValue(context, CORE_PROFILE.packAlpha, 'attributeBonus', 150);
      for (const attribute of PACK_ALPHA_RUNTIME_ATTRIBUTES) adjust(attribute, bonus - 150);
    }

    if (hasTrait(context, TRAIT.PETS_PROWESS)) {
      adjust('ferocity', rangerBalanceValue(context, CORE_PROFILE.petsProwess, 'attributeBonus', 300) - 300);
    }
  }

  return result;
}

export function soulbeastCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  const state = soulbeastState.from(context);
  const toggle = skill.id === ID.BEASTMODE || skill.id === ID.LEAVE_BEASTMODE;
  // Wrong-pet check must precede the beastmode-active check: a skill can be a beastmodeSkill
  // but still invalid if it belongs to a different pet than the one currently selected.
  if (skill.beastmodeSkill && !toggle && !selectedRangerPet(context.config)?.beastmodeSkillIds.includes(skill.id)) {
    return deny(skill, 'ranger.inactive-merged-pet-skill', 'select the pet that grants this merged Beast skill.');
  }

  if (skill.beastmodeSkill && !state.beastmodeActive && skill.name !== 'Beastmode') {
    return deny(skill, 'ranger.beastmode-inactive', 'enter Beastmode first.');
  }

  if (skill.name === 'Beastmode' && state.beastmodeActive) {
    return deny(skill, 'ranger.beastmode-active', 'Beastmode is already active.');
  }

  if (skill.name === 'Leave Beastmode' && !state.beastmodeActive) {
    return deny(skill, 'ranger.beastmode-inactive', 'Beastmode is not active.');
  }

  return { ready: true };
}

export const soulbeastModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.loud-whistle-player',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      context.event?.actorType !== 'summon' && beastmodeActive(context) && hasTrait(context, TRAIT.LOUD_WHISTLE)
  },
  {
    id: 'ranger.furious-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    // Furious Strength requires the player to have Fury; pet fury does not count.
    when: (context) => hasTrait(context, TRAIT.FURIOUS_STRENGTH) && activeBuff(context, 'fury')
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
    amount: 0.1,
    when: oppressiveSuperiorityActive
  }
]);

export const soulbeastAttributeRules = Object.freeze({
  modifyAttributes: modifySoulbeastAttributes,
  modifierRules: soulbeastModifierRules
});
export const soulbeastCastRules = Object.freeze({
  availability: {
    id: 'ranger.soulbeast-availability',
    order: 20,
    handler: soulbeastCastAvailability
  },
  // Merged skills are player actions, so undo Core's pet-only Pack Alpha recharge modifier.
  modifyRechargeDuration(context: RangerSchedulerContext & { skill?: RangerSkill }, duration: number): number {
    if (
      !context.skill?.petSkill ||
      !context.skill.beastmodeSkill ||
      !hasTrait(context as unknown as Gw2ModifierContext, TRAIT.PACK_ALPHA)
    ) {
      return duration;
    }

    return (
      duration /
      Math.max(Number.EPSILON, rangerBalanceValue(context, CORE_PROFILE.packAlpha, 'rechargeMultiplier', 0.8))
    );
  }
});

function initializeSoulbeastPetOwnership(context: RangerSchedulerContext): void {
  // Beastmode starts active, so Soulbeast suspends Core's autonomous pet before combat begins.
  setRangerPetActive(context, !soulbeastState.from(context).beastmodeActive, context.state.time);
}

function emitMergedCommandEffects(context: RangerCastContext, skill: RangerSkill): void {
  if (skill.id === ID.SIC_EM) {
    context.emit({
      type: 'buff',
      at: context.start,
      source: 'ranger',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      kind: 'sic-em',
      duration: rangerBalanceValue(context, CORE_PROFILE.sicEm, 'durationMultiplier', 10),
      stacks: 1
    });
  }

  if (String(skill.description || '').startsWith('Command.') && hasTrait(context, TRAIT.RESOUNDING_TIMBRE)) {
    context.emit({
      type: 'ranger.boon-extension',
      at: context.start,
      source: 'ranger',
      sourceId: TRAIT.RESOUNDING_TIMBRE,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Resounding Timbre',
      duration: rangerBalanceValue(context, CORE_PROFILE.resoundingTimbre, 'durationMultiplier', 2)
    });
  }
}

/** Completes Soulbeast-only pet substitution and merged Beast-skill behavior. */
function completeSoulbeastCast(context: RangerCastContext, skill: RangerSkill): void {
  const state = soulbeastState.from(context);
  if (skill.id === ID.PET_SWAP) {
    state.archetype = rangerPetByName(professionCoreState(context).activePet).archetype;
  }

  if (!state.beastmodeActive) return;
  emitMergedCommandEffects(context, skill);
  if (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE) {
    applyRangerBeastSkillTraits(context, skill, false);
  }
}

export const soulbeastSchedulerHooks = Object.freeze({
  initialize: {
    id: 'ranger.soulbeast-pet-ownership',
    order: 20,
    handler: initializeSoulbeastPetOwnership
  },
  onCastComplete: {
    id: 'ranger.soulbeast-complete',
    order: 20,
    handler: completeSoulbeastCast
  }
});
