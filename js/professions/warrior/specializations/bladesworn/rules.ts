import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  WARRIOR_SKILL_IDS as ID,
  WARRIOR_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { bladeswornState } from "./state.js";
import type {
  AvailabilityResult,
  SchedulerRecord,
} from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import {
  DRAGON_CHARGE_INTERVAL_SECONDS,
  DRAGON_FLOW_PER_CHARGE,
  maximumDragonCharges,
  requestedDragonCharges,
} from "./dragon-trigger.js";
import type { WarriorCastContext, WarriorSkill } from "../../types.js";

function specState(context: Gw2ModifierContext) {
  const specialization = (
    context.runtime as
      | {
          profession?: {
            specialization?: { kind?: string; state?: Record<string, unknown> };
          };
        }
      | undefined
  )?.profession?.specialization;
  return specialization?.kind === "Bladesworn"
    ? specialization.state || {}
    : {};
}

function modifyAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & { ferocity: number };
  if (
    hasTrait(context, TRAIT.GUNS_AND_GLORY) &&
    Number(specState(context).gunsAndGloryUntil || 0) > context.time
  ) {
    result.ferocity += 250;
  }
  return result;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.fierce-as-fire",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context) =>
      (
        (specState(context).fierceAsFireExpiries as number[] | undefined) || []
      ).filter((expiresAt) => expiresAt > context.time).length * 0.01,
    when: (context) => hasTrait(context, TRAIT.FIERCE_AS_FIRE),
  },
]);

function availability(
  context: WarriorCastContext,
  skill: WarriorSkill,
): AvailabilityResult {
  const state = bladeswornState.from(context);
  if (skill.id === ID.SWAP_WEAPONS) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.gunsaber",
      reason: "Bladesworn cannot swap normal weapon sets in combat.",
    };
  }
  if (skill.id === ID.UNSHEATHE_GUNSABER && state.gunsaberActive) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.gunsaber",
      reason: "Gunsaber is already active.",
    };
  }
  if (skill.id === ID.SHEATHE_GUNSABER && !state.gunsaberActive) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.gunsaber",
      reason: "Gunsaber is not active.",
    };
  }
  if (
    state.gunsaberActive &&
    skill.type === "Weapon" &&
    Boolean(skill.weapon)
  ) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.gunsaber",
      reason: "Sheathe the gunsaber before using standard weapon skills.",
    };
  }
  if (skill.dragonSlash && !state.dragonTriggerActive) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.dragon-trigger",
      reason: "Enter Dragon Trigger before using Dragon Slash.",
    };
  }
  if (skill.dragonSlash) {
    const maximumCharges = maximumDragonCharges(context);
    const releaseAtCharges = requestedDragonCharges(context, maximumCharges);
    const missingCharges = releaseAtCharges - state.dragonCharges;
    if (missingCharges > 0) {
      const requiredFlow = missingCharges * DRAGON_FLOW_PER_CHARGE;
      if (state.flow + context.epsilon < requiredFlow) {
        return {
          ready: false,
          retryAt: null,
          code: "warrior.flow",
          reason:
            `Dragon Slash needs ${requiredFlow} Flow to reach ` +
            `${releaseAtCharges} charges; ${state.flow} Flow remains.`,
        };
      }
      const nextChargeAt =
        state.nextDragonChargeAt > context.start + context.epsilon
          ? state.nextDragonChargeAt
          : context.start + DRAGON_CHARGE_INTERVAL_SECONDS;
      return {
        ready: false,
        retryAt: nextChargeAt,
        code: "warrior.dragon-trigger-charging",
        reason: `Dragon Trigger is charging to ${releaseAtCharges} charges.`,
      };
    }
  }
  if (skill.gunsaberSkill && !skill.dragonSlash && !state.gunsaberActive) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.gunsaber",
      reason: "Unsheathe the gunsaber first.",
    };
  }
  if (skill.id === ID.DRAGON_TRIGGER && state.dragonTriggerActive) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.dragon-trigger",
      reason: "Dragon Trigger is already active.",
    };
  }
  if (skill.id === ID.DRAGON_TRIGGER && state.flow < 10) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.flow",
      reason: "Dragon Trigger requires at least 10 flow.",
    };
  }
  return { ready: true };
}

export const bladeswornAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules,
});
export const bladeswornCastRules = Object.freeze({
  availability: { id: "warrior.bladesworn", order: 20, handler: availability },
});
