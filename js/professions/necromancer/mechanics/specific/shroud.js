import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../skill-mechanics.js";
import { advanceNecromancerState, leaveShroud } from "./life-force.js";
import {
  EXIT_ID_BY_SHROUD,
  SHROUD_ENTRY,
  SHROUD_EXIT,
  emitBuff,
  emitDamage,
  emitState,
  gainNecromancerLifeForce,
  hasTrait,
} from "./shared.js";

function activateShroud(context, skill) {
  const state = context.state.profession;
  const shroud = SHROUD_ENTRY[skill.id];
  const at = context.effectiveEnd;
  const specialization = context.config.specialization || "Core";
  if (shroud === "harbinger") {
    gainNecromancerLifeForce(context, 15, at);
  }
  state.activeShroud = shroud;
  state.shroudEnteredAt = at;
  state.lastResourceAt = at;
  state.nextBlightAt = shroud === "harbinger"
    ? Math.floor(at) + 1
    : Number.POSITIVE_INFINITY;
  state.soulTwistingAvailable =
    shroud === "ritualist"
    && hasTrait(context, TRAIT.SOUL_TWISTING);
  const exitId = EXIT_ID_BY_SHROUD[shroud];
  state.availableFlips[exitId] = Number.POSITIVE_INFINITY;
  state.pendingShroudEntryId = skill.id;

  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitBuff(context, skill, "necromancer-soul-barbs", 15);
  }
  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    emitBuff(context, skill, "might", 5, 5);
  }
  if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
    emitBuff(context, skill, "fury", 8);
  }
  if (hasTrait(context, TRAIT.SPITEFUL_SPIRIT)) {
    emitDamage(context, skill, MECHANICS.traitStrikeCoefficient[
      TRAIT.SPITEFUL_SPIRIT
    ], {
      name: "Spiteful Spirit",
      source: "Trait",
      sourceId: TRAIT.SPITEFUL_SPIRIT,
      actorType: "effect",
      skillWeapon: "Unequipped",
    });
  }
  context.emit({
    type: "weapon_set",
    at,
    source: "necromancer",
    sourceId: `necromancer.${shroud}-shroud-enter`,
    actorType: "player",
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true,
    specialization,
  });
  emitState(context, at, "shroud-enter");
  return true;
}

function shroud(context, skill) {
  advanceNecromancerState(context, context.start);
  if (SHROUD_ENTRY[skill.id]) return activateShroud(context, skill);
  if (SHROUD_EXIT[skill.id]) {
    leaveShroud(context, context.effectiveEnd);
    return true;
  }
  return false;
}

function lich(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (skill.id === ID.LICH_FORM) {
    state.activeShroud = "lich";
    state.lichEndsAt = at + 20;
    state.lastResourceAt = at;
    state.availableFlips[ID.EXIT_LICH_FORM] = state.lichEndsAt;
    emitState(context, at, "lich-enter");
  } else {
    state.activeShroud = "";
    state.lichEndsAt = 0;
    delete state.availableFlips[ID.EXIT_LICH_FORM];
    gainNecromancerLifeForce(context, 15, at);
    emitState(context, at, "lich-exit");
  }
  return true;
}

export const necromancerShroudSkillHandlers = Object.freeze({
  "necromancer.shroud": shroud,
  "necromancer.lich": lich,
});
