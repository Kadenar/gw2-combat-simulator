import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  activeBoonStacks,
  cloneEngineerAttributes,
  engineerEvent,
  eventSkill,
  selectedSkillNames,
} from "../../core/rule-helpers.js";
import { hasEngineerTrait } from "../../core/state.js";
import { mechanistCastAvailability } from "./availability.js";
import { isEngineerMechCommand } from "./mech.js";
import { engineerMechAttributes } from "./state.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  EngineerConfig,
  EngineerRechargeContext,
} from "../../types.js";

function engineerMechEvent(context: Gw2ModifierContext): boolean {
  const event = engineerEvent(context);
  if (
    event?.engineerMech === true
    || event?.application?.engineerMech === true
  ) {
    return true;
  }
  if (
    context.config?.specialization !== "Mechanist"
    || event?.actorType !== "summon"
  ) {
    return false;
  }
  const slot = Number(eventSkill(context)?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

function selectedSignet(
  context: Gw2ModifierContext,
  name: string,
): boolean {
  return selectedSkillNames(context).has(name);
}

function jDriveSignet(
  context: Gw2ModifierContext,
  name: string,
): boolean {
  return (
    hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
    && selectedSignet(context, name)
  );
}

function configuredSkillNames(
  config: EngineerConfig | undefined,
): Set<string> {
  const selected = config?.selectedSkills || [];
  return new Set(
    (Array.isArray(selected) ? selected : Object.values(selected)).map(String),
  );
}

export const mechanistModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "engineer.force-signet",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: (context) =>
        hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? 0.18 : 0.15,
      when: (context) => selectedSignet(context, "Force Signet"),
    },
    {
      id: "engineer.j-drive-superconducting-signet",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "damage-additive",
      amount: 0.12,
      when: (context) =>
        jDriveSignet(context, "Superconducting Signet"),
    },
    {
      id: "engineer.mech-base-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.05,
      when: (context) =>
        engineerMechEvent(context)
        && !hasTrait(
          context,
          TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        ),
    },
    {
      id: "engineer.jade-cannons-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.2,
      when: (context) =>
        engineerMechEvent(context)
        && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS),
    },
  ]);

function modifyMechanistAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const modified = cloneEngineerAttributes(attributes);
  if (!engineerMechEvent(context)) return modified;
  const mightStacks = activeBoonStacks(context, "might");
  const inheritedSource = {
    ...modified,
    power: Math.max(
      0,
      Number(modified.power || 0) - mightStacks * 30,
    ),
    ferocity: Math.max(
      0,
      Number(modified.ferocity || 0) - (
        hasTrait(context, TRAIT.NO_SCOPE)
        && activeBoonStacks(context, "fury", 1) > 0
          ? 150
          : 0
      ),
    ),
    conditionDamage: Math.max(
      0,
      Number(modified.conditionDamage || 0) - mightStacks * 30,
    ),
  };
  const mech = engineerMechAttributes(context.config, inheritedSource);
  if (selectedSignet(context, "Shift Signet")) {
    mech.power += mightStacks * 30;
    mech.conditionDamage += mightStacks * 30;
  }
  return mech;
}

function modifyMechanistRechargeDuration(
  context: EngineerRechargeContext,
  duration: number,
): number {
  const skill = context.skill;
  if (
    isEngineerMechCommand(skill)
    && hasEngineerTrait(context.config, TRAIT.MECH_CORE_JADE_DYNAMO)
  ) {
    return duration * 0.8;
  }
  if (
    skill?.id !== ID.OVERCLOCK_SIGNET
    && skill?.categories?.some(
      (category) => String(category).toLowerCase() === "signet",
    )
  ) {
    const overclockReadyAt = Number(
      context.state?.cooldowns?.get(ID.OVERCLOCK_SIGNET) || 0,
    );
    const jDrive = hasEngineerTrait(
      context.config,
      TRAIT.MECH_CORE_J_DRIVE,
    );
    if (
      configuredSkillNames(context.config).has("Overclock Signet")
      && (
        jDrive
        || overclockReadyAt <= Number(context.start || 0)
      )
    ) {
      return duration * (jDrive ? 0.76 : 0.8);
    }
  }
  return duration;
}

export const mechanistAttributeRules = Object.freeze({
  modifyAttributes: modifyMechanistAttributes,
  modifierRules: mechanistModifierRules,
});

export const mechanistCastRules = Object.freeze({
  availability: {
    id: "engineer.mechanist-availability",
    order: 30,
    handler: mechanistCastAvailability,
  },
  modifyRechargeDuration: modifyMechanistRechargeDuration,
});
