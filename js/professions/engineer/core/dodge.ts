import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasEngineerTrait } from "./state.js";
import { emitEngineerState } from "./events.js";
import { isEngineerToolbeltSkill } from "./traits.js";
import { ENGINEER_DODGE_ENDURANCE_COST } from "./mechanics.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../types.js";

// ammo and cooldown skills use different reduction APIs — ammo tracks charges, not a single timestamp
function reduceCooldown(
  context: EngineerCastContext,
  skill: EngineerSkill,
  seconds: number,
  at: number,
): number {
  const ammo = context.state.ammo.get(skill.id);
  if (ammo) {
    return context.cooldownController.reduceAmmoRecharge(
      skill,
      seconds,
      at,
    ).reducedBy;
  }
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  // skill already ready — nothing to reduce, avoid mutating the map unnecessarily
  if (readyAt <= at + context.epsilon) return 0;
  const reduced = Math.min(seconds, readyAt - at);
  context.state.cooldowns.set(skill.id, readyAt - reduced);
  return reduced;
}

// a skill lives in exactly one of the two maps (ammo OR cooldowns, never both); scan both to catch all
function reduceMatchingCooldowns(
  context: EngineerCastContext,
  predicate: (skill: EngineerSkill) => boolean,
  seconds: number,
  at: number,
): number {
  const ids = new Set([
    ...context.state.cooldowns.keys(),
    ...context.state.ammo.keys(),
  ]);
  let reducedBy = 0;
  for (const skillId of ids) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill && predicate(skill)) {
      reducedBy += reduceCooldown(context, skill, seconds, at);
    }
  }
  return reducedBy;
}

export function performEngineerDodge(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const state = professionCoreState(context);
  const at = context.start;
  state.endurance = Math.max(
    0,
    Number(state.endurance || 0) - ENGINEER_DODGE_ENDURANCE_COST,
  );
  // enduranceUpdatedAt anchors the regen formula in resources.ts — must update alongside any endurance change
  state.enduranceUpdatedAt = at;

  context.emit({
    type: "engineer.dodge",
    at,
    source: "engineer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
  });

  if (hasEngineerTrait(context.config, TRAIT.POWER_WRENCH)) {
    const reducedBy = reduceMatchingCooldowns(
      context,
      candidate =>
        candidate.type === "Elite" || candidate.slot === "Elite",
      3,
      at,
    );
    // only emit proc when something actually changed — suppresses no-op entries in the event log
    if (reducedBy > 0) {
      context.emit({
        type: "proc",
        at,
        source: "Trait",
        sourceId: TRAIT.POWER_WRENCH,
        actorType: "effect",
        name: "Power Wrench",
        procType: "trait",
        sourceSkill: skill.name,
        cooldownReduction: reducedBy,
      });
    }
  }

  if (hasEngineerTrait(context.config, TRAIT.ADRENAL_IMPLANT)) {
    const reducedBy = reduceMatchingCooldowns(
      context,
      isEngineerToolbeltSkill,
      1,
      at,
    );
    if (reducedBy > 0) {
      context.emit({
        type: "proc",
        at,
        source: "Trait",
        sourceId: TRAIT.ADRENAL_IMPLANT,
        actorType: "effect",
        name: "Adrenal Implant",
        procType: "trait",
        sourceSkill: skill.name,
        cooldownReduction: reducedBy,
      });
    }
  }

  // "dodge" cause lets downstream state subscribers (e.g. scrapper gyro checks) react post-dodge
  emitEngineerState(context, at, "dodge");
}

export const ENGINEER_DODGE_SKILL_ID = ID.DODGE;
