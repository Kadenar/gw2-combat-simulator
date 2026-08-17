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
  DRAGON_TRIGGER_FLOW_COST,
  maximumDragonCharges,
  requestedDragonCharges,
} from "./dragon-trigger.js";
import type { WarriorCastContext, WarriorSkill } from "../../types.js";
import {
  advanceBladesworn,
  completeBladeswornSkill,
  observeBladeswornEvent,
  trackBladeswornAmmoCast,
} from "./traits.js";

// Shared reason string so both the availability check and the charge-release
// projection surface the same message in the UI.
export const ENTER_DRAGON_TRIGGER_REASON =
  "Enter Dragon Trigger before using this skill.";

export const bladeswornSchedulerHooks = Object.freeze({
  advance: { id: "warrior.flow", order: 20, handler: advanceBladesworn },
  afterCast: {
    id: "warrior.bladesworn-ammo-cast",
    order: 20,
    handler: trackBladeswornAmmoCast,
  },
  onCastComplete: {
    id: "warrior.bladesworn-state",
    order: 20,
    handler: completeBladeswornSkill,
  },
  onEventScheduled: {
    id: "warrior.bladesworn-explosions",
    order: 20,
    handler: observeBladeswornEvent,
  },
});

function modifyAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const result = { ...attributes } as SchedulerRecord & { ferocity: number };
  if (
    hasTrait(context, TRAIT.GUNS_AND_GLORY) &&
    runtimeBuffActive(context, "guns-and-glory")
  ) {
    result.ferocity += 250;
  }
  return result;
}

function runtimeBuffActive(context: Gw2ModifierContext, kind: string): boolean {
  const applications = context.runtime?.boons?.get(kind) || [];
  return applications.some(
    (application) =>
      application.affectsSelf !== false &&
      application.at <= context.time &&
      application.expiresAt > context.time,
  );
}

function runtimeBuffStacks(
  context: Gw2ModifierContext,
  kind: string,
  maximum: number,
): number {
  return Math.min(
    maximum,
    (context.runtime?.boons?.get(kind) || [])
      .filter(
        (application) =>
          application.affectsSelf !== false &&
          application.at <= context.time &&
          application.expiresAt > context.time,
      )
      .reduce((total, application) => total + application.stacks, 0),
  );
}

function cartridgeDamageBonus(context: Gw2ModifierContext): number {
  if (runtimeBuffActive(context, "supercharged-cartridges")) return 0.2;
  if (runtimeBuffActive(context, "overcharged-cartridges")) return 0.15;
  return 0;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "warrior.fierce-as-fire",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context) =>
      runtimeBuffStacks(context, "fierce-as-fire", 10) * 0.01,
    when: (context) => hasTrait(context, TRAIT.FIERCE_AS_FIRE),
  },
  {
    id: "warrior.overcharged-cartridges",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + cartridgeDamageBonus(context),
    when: (context) =>
      context.event?.damageKind === "explosion" &&
      cartridgeDamageBonus(context) > 0,
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
    (state.gunsaberActive || state.dragonTriggerActive) &&
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
  if (
    (skill.dragonSlash || skill.dragonTriggerSkill) &&
    !state.dragonTriggerActive
  ) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.dragon-trigger",
      reason: ENTER_DRAGON_TRIGGER_REASON,
    };
  }
  if (skill.dragonSlash) {
    const maximumCharges = maximumDragonCharges(context);
    const releaseAtCharges = requestedDragonCharges(context, maximumCharges);
    const missingCharges = releaseAtCharges - state.dragonCharges;
    if (missingCharges > 0) {
      const nextChargeAt =
        state.nextDragonChargeAt > context.start + context.epsilon
          ? state.nextDragonChargeAt
          : context.start + DRAGON_CHARGE_INTERVAL_SECONDS;
      // Even the next possible tick would land after the deadline — stop waiting.
      if (nextChargeAt > state.dragonTriggerChargeDeadline + context.epsilon) {
        return {
          ready: false,
          retryAt: null,
          code: "warrior.flow",
          reason:
            `Dragon Slash could not reach ${releaseAtCharges} charges ` +
            `before Dragon Trigger ended; it reached ${state.dragonCharges}.`,
        };
      }
      return {
        ready: false,
        retryAt: nextChargeAt,
        code: "warrior.dragon-trigger-charging",
        reason: `Dragon Trigger is charging to ${releaseAtCharges} charges.`,
      };
    }
  }
  if (
    state.dragonTriggerActive &&
    skill.gunsaberSkill &&
    !skill.dragonSlash &&
    !skill.dragonTriggerSkill
  ) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.dragon-trigger",
      reason: "Finish Dragon Trigger before using gunsaber attacks.",
    };
  }
  if (
    skill.gunsaberSkill &&
    !skill.dragonSlash &&
    !skill.dragonTriggerSkill &&
    !state.gunsaberActive
  ) {
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
  if (
    skill.id === ID.DRAGON_TRIGGER &&
    state.flow + context.epsilon < DRAGON_TRIGGER_FLOW_COST
  ) {
    return {
      ready: false,
      retryAt: null,
      code: "warrior.flow",
      reason: `Dragon Trigger requires at least ${DRAGON_TRIGGER_FLOW_COST} flow.`,
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
