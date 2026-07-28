/**
 * Shroud entry/exit and Lich Form handlers.
 *
 * `activateShroud` enters death/reaper/harbinger/ritualist shroud: sets active
 * shroud state, arms the exit flip, and fires the on-enter trait payloads
 * (carapace/life-force gains, boons, Weakening Shroud, etc.). Exit is delegated
 * to `leaveShroud` in life-force.js. Lich Form is a separate timed transform.
 * The resource clock is advanced to `context.start` first so entry sees an
 * up-to-date life-force pool. Exports `necromancerShroudSkillHandlers`.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { advanceNecromancerState, leaveShroud } from "./life-force.js";
import {
  EXIT_ID_BY_SHROUD,
  SHROUD_ENTRY,
  SHROUD_EXIT,
  addCarapace,
  emitBuff,
  emitCondition,
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
  const timedCarapace = (state.carapaceExpiries || []).filter(
    (expiresAt) => expiresAt > at,
  ).length;
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(state.activeMinions || {}).reduce(
        (total, count) => total + Number(count || 0) * 2,
        0,
      )
    : 0;
  if (hasTrait(context, TRAIT.SOUL_COMPREHENSION)) {
    gainNecromancerLifeForce(
      context,
      Math.min(30, timedCarapace + minionCarapace) * 0.5,
      at,
    );
  }
  if (hasTrait(context, TRAIT.ARMORED_SHROUD)) {
    addCarapace(state, 5, at);
  }
  if (hasTrait(context, TRAIT.SHROUDED_REMOVAL)) {
    const activeCondition = (state.selfConditions || []).find(
      (application) =>
        application.appliedAt <= at && application.expiresAt > at,
    );
    if (activeCondition) {
      state.selfConditions = state.selfConditions.filter(
        (application) => application !== activeCondition,
      );
      addCarapace(state, 3, at);
    }
  }
  if (shroud === "harbinger" && hasTrait(context, TRAIT.CORRUPTED_TALENT)) {
    gainNecromancerLifeForce(context, 15, at);
  }
  state.activeShroud = shroud;
  state.shroudEnteredAt = at;
  state.lastResourceAt = at;
  state.nextBlightAt =
    shroud === "harbinger" ? Math.floor(at) + 1 : Number.POSITIVE_INFINITY;
  state.soulTwistingAvailable =
    shroud === "ritualist" && hasTrait(context, TRAIT.SOUL_TWISTING);
  const exitId = EXIT_ID_BY_SHROUD[shroud];
  state.availableFlips[exitId] = Number.POSITIVE_INFINITY;
  state.pendingShroudEntryId = skill.id;
  state.plagueSendingArmed =
    hasTrait(context, TRAIT.PLAGUE_SENDING) &&
    (state.selfConditions || []).some(
      (application) =>
        application.appliedAt <= at && application.expiresAt > at,
    );

  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitBuff(context, skill, "necromancer-soul-barbs", 15);
  }
  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    emitBuff(context, skill, "might", 5, 5);
  }
  if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
    emitBuff(context, skill, "fury", 8);
  }
  if (hasTrait(context, TRAIT.SPEED_OF_SHADOWS)) {
    emitBuff(context, skill, "swiftness", 10);
  }
  if (hasTrait(context, TRAIT.ETERNAL_LIFE)) {
    emitBuff(context, skill, "protection", 3);
  }
  if (hasTrait(context, TRAIT.WEAKENING_SHROUD)) {
    emitDamage(context, skill, 1.5, {
      name: "Weakening Shroud",
      source: "Trait",
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: "effect",
      skillWeapon: "Unequipped",
    });
    emitCondition(context, skill, "Bleeding", 2, 10, {
      source: "Trait",
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: "effect",
    });
    emitCondition(context, skill, "Weakness", 1, 6, {
      source: "Trait",
      sourceId: TRAIT.WEAKENING_SHROUD,
      actorType: "effect",
    });
  }
  if (shroud === "harbinger" && hasTrait(context, TRAIT.DEATHLY_HASTE)) {
    emitBuff(context, skill, "quickness", 4);
    emitBuff(context, skill, "fury", 4);
  }
  if (shroud === "harbinger" && hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
    emitBuff(context, skill, "stability", 5, 3);
    emitBuff(context, skill, "implacable-foe", 2);
  }
  if (hasTrait(context, TRAIT.SPITEFUL_SPIRIT)) {
    emitDamage(
      context,
      skill,
      MECHANICS.traitStrikeCoefficient[TRAIT.SPITEFUL_SPIRIT],
      {
        name: "Spiteful Spirit",
        source: "Trait",
        sourceId: TRAIT.SPITEFUL_SPIRIT,
        actorType: "effect",
        skillWeapon: "Unequipped",
      },
    );
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

function executionersScythe(context, _skill, event) {
  if (
    event?.type !== "damage"
    || Number(event.hitIndex || 1) !== 1
  ) return;
  context.state.profession.executionersIceFieldUntil = event.at + 4;
}

const SOUL_SPIRAL_ICE_COMBO_HITS = new Set([2, 4, 6, 8, 10, 11, 12]);

function soulSpiral(context, skill, event) {
  if (
    event?.type !== "damage"
    || !SOUL_SPIRAL_ICE_COMBO_HITS.has(Number(event.hitIndex || 1))
    || Number(context.state.profession.executionersIceFieldUntil || 0)
      < event.at - context.epsilon
  ) return;
  context.emit({
    type: "necromancer.chill",
    at: event.at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: `${skill.name} — Chilling Bolts`,
    duration: 1,
  });
}

export const necromancerShroudSkillHandlers = Object.freeze({
  "necromancer.shroud": shroud,
  "necromancer.lich": lich,
  "necromancer.executioners-scythe": executionersScythe,
  "necromancer.soul-spiral": soulSpiral,
});
