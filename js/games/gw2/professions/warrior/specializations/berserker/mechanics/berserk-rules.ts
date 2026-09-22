import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileFromContext,
  balanceProfileNumberFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { WarriorCastContext, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { advanceBerserker } from '#gw2/professions/warrior/specializations/berserker/mechanics/berserk.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import {
  finishBerserkerCast,
  handleKingOfFiresDetonationTask,
  kingOfFiresReaction,
  observeBerserkerEvent
} from '#gw2/professions/warrior/specializations/berserker/traits/index.js';

export const berserkerSchedulerHooks = Object.freeze({
  initialize: kingOfFiresReaction.initialize,
  advance: {
    id: 'warrior.berserker-advance',
    order: 20,
    handler: advanceBerserker
  },
  afterCast: {
    id: 'warrior.berserker-duration',
    order: 20,
    handler: finishBerserkerCast
  },
  onEventScheduled: {
    id: 'warrior.king-of-fires',
    order: 20,
    handler: observeBerserkerEvent
  },
  taskHandlers: Object.freeze({
    ...kingOfFiresReaction.taskHandlers,
    'warrior.king-of-fires-detonation': handleKingOfFiresDetonationTask
  })
});

// Berserk active state must be read from two sources: the timeline buff (used
// during the resolver pass) and the live runtime state (used during scheduling,
// before events are committed to the timeline).
function active(context: Gw2ModifierContext): boolean {
  if ((context.timeline?.buffStacksAt('berserk', context.time, 0, 1) || 0) > 0) {
    return true;
  }

  return Boolean(
    readProfessionSpecializationState<{ berserkActive?: boolean }>(context.runtime?.profession, 'Berserker')
      ?.berserkActive
  );
}

// Apply Berserker's live trait and Berserk-window attribute changes without
// mutating the shared resolved-stat object.
function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const conversionPower = Number(context.config?.stats?.power ?? attributes.power ?? 0);
  const conversionPrecision = Number(context.config?.stats?.precision ?? attributes.precision ?? 0);
  const result = { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    ferocity: number;
    conditionDamage: number;
  };
  if (active(context)) {
    const powerBonus = balanceProfileNumberFromContext(context, PROFILE.resources, 'attributeBonus');
    result.power += powerBonus;
    result.conditionDamage += balanceProfileNumberFromContext(context, PROFILE.resources, 'attributePerStack');
    if (hasTrait(context, TRAIT.GREAT_FORTITUDE)) {
      const conversion = balanceProfileNumberFromContext(context, CORE_PROFILE.greatFortitude, 'attributeConversion');
      result.vitality = Number(result.vitality || 0) + powerBonus * conversion;
      result.ferocity += powerBonus * conversion;
    }
  }

  if (hasTrait(context, TRAIT.BLOOD_REACTION)) {
    const profile = balanceProfileFromContext(context, PROFILE.bloodReaction);
    const conversion = active(context)
      ? Number(profile?.coefficientMultiplier ?? 0.24)
      : balanceProfileNumberFromContext(context, PROFILE.bloodReaction, 'attributeConversion');
    result.ferocity += conversionPrecision * conversion;
    result.conditionDamage += conversionPower * conversion;
  }

  return result;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.smash-brawler-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) => balanceProfileNumberFromContext(context, TRAIT.SMASH_BRAWLER, 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.SMASH_BRAWLER) && active(context)
  },
  {
    id: 'warrior.bloody-roar',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.BLOODY_ROAR) && active(context)
  }
]);

/** Enforces Berserker's primal-burst replacement and active-mode lifecycle. */
function availability(context: WarriorCastContext, skill: WarriorSkill): AvailabilityResult {
  const state = berserkerState.from(context);
  if (skill.primalBurst && !state.berserkActive) {
    return {
      ready: false,
      retryAt: null,
      code: 'warrior.berserk',
      reason: 'Primal bursts require berserk mode.'
    };
  }

  if (skill.handlerId === 'warrior.berserk' && state.berserkActive) {
    return {
      ready: false,
      retryAt: state.berserkUntil,
      code: 'warrior.berserk-active',
      reason: 'Already in berserk mode.'
    };
  }

  return { ready: true };
}

export const berserkerAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules
});
export const berserkerCastRules = Object.freeze({ availability });
