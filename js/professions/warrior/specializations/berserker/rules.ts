import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { berserkerState } from './state.js';
import type { AvailabilityResult, SchedulerRecord } from '../../../../platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from '../../types.js';
import { warriorBalanceProfile, WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '../../core/profiles.js';
import { advanceBerserker } from './mechanics.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import {
  finishBerserkerCast,
  handleKingOfFiresDetonationTask,
  handleKingOfFiresHitTask,
  observeBerserkerEvent
} from './traits.js';

export const berserkerSchedulerHooks = Object.freeze({
  initialize: (context: WarriorSchedulerContext) => {
    // King of Fires needs resolved critical facts before the Berserker event observer runs.
    if (hasTrait(context, TRAIT.KING_OF_FIRES)) {
      (
        context.schedulerPolicy as unknown as {
          requireCriticalFacts?: () => void;
        }
      ).requireCriticalFacts?.();
    }
  },
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
    'warrior.king-of-fires-hit': handleKingOfFiresHitTask,
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

  const runtime = (
    context.runtime as
      | {
          profession?: {
            specialization?: {
              kind?: string;
              state?: { berserkActive?: boolean };
            };
          };
        }
      | undefined
  )?.profession;
  return runtime?.specialization?.kind === 'Berserker' && Boolean(runtime.specialization.state?.berserkActive);
}

function modifyAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const conversionPower = Number(context.config?.stats?.power ?? attributes.power ?? 0);
  const conversionPrecision = Number(context.config?.stats?.precision ?? attributes.precision ?? 0);
  const result = { ...attributes } as SchedulerRecord & {
    power: number;
    precision: number;
    ferocity: number;
    conditionDamage: number;
  };
  if (active(context)) {
    const resources = warriorBalanceProfile(context, PROFILE.resources);
    const powerBonus = Number(resources?.attributeBonus ?? 300);
    result.power += powerBonus;
    result.conditionDamage += Number(resources?.attributePerStack ?? 150);
    if (hasTrait(context, TRAIT.GREAT_FORTITUDE)) {
      const conversion = Number(
        warriorBalanceProfile(context, CORE_PROFILE.greatFortitude)?.attributeConversion ?? 0.1
      );
      result.vitality = Number(result.vitality || 0) + powerBonus * conversion;
      result.ferocity += powerBonus * conversion;
    }
  }

  if (hasTrait(context, TRAIT.BLOOD_REACTION)) {
    const profile = warriorBalanceProfile(context, PROFILE.bloodReaction);
    const conversion = active(context)
      ? Number(profile?.coefficientMultiplier ?? 0.24)
      : Number(profile?.attributeConversion ?? 0.12);
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
    amount: 0.15,
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

// Berserk grants an inherent 15% attack speed bonus. The bonus is skipped when
// quickness is active because quickness already provides superior haste and the
// two are not additive in the game's speed model.
function modifyCastDuration(context: WarriorCastContext, duration: number): number {
  return berserkerState.from(context).berserkActive && !context.hasBuff('quickness', context.start)
    ? duration / Number(warriorBalanceProfile(context, PROFILE.resources)?.quicknessCastMultiplier ?? 1.15)
    : duration;
}

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
export const berserkerCastRules = Object.freeze({ modifyCastDuration, availability });
