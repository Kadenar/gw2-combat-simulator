/**
 * Core (profession-agnostic) necromancer skill handlers.
 *
 * Covers mechanics that aren't tied to an elite specialization: weapon swap,
 * flip-skill arming/expiry (`availableFlips`), the Signet of Vampirism active
 * life-steal strikes, and the (no-op on cast) Signet of Undeath. Exposed as the
 * `necromancerCoreSkillHandlers` map.
 */
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { emitDamage, emitState } from "./shared.js";
import type {
  NecromancerCastContext,
  NecromancerSkill,
} from "../../types.js";

function swapWeapons(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  context.state.profession.autoattackChains = {};
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet,
  });
  return true;
}

function flip(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const state = context.state.profession;
  if (skill.flipSkillId != null) {
    const duration =
      ({
        [ID.DARK_PATH]: 3,
        [ID.INFUSING_TERROR]: 6,
        [ID.RIPPLE_OF_HORROR]: 12,
      } as Readonly<Record<string | number, number>>)[skill.id] || 5;
    state.availableFlips[skill.flipSkillId] = context.effectiveEnd + duration;
  }
  if (skill.flipParentId != null) {
    delete state.availableFlips[skill.id];
  }
  emitState(context, context.effectiveEnd, "flip");
  return false;
}

function signetOfVampirism(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const at = context.effectiveEnd;
  const active = MECHANICS.signetOfVampirism.active;
  for (let index = 1; index <= active.hits; index += 1) {
    emitDamage(context, skill, 0, {
      at: at + index * active.interval,
      name: "Signet of Vampirism — Vampiric Mark",
      skillWeapon: "Unequipped",
      metadata: {
        flatStrikeBase: active.flatStrikeBase,
        flatStrikePowerCoeff: active.flatStrikePowerCoeff,
        noCrit: true,
        damageKind: "life-steal",
      },
    });
  }
  return true;
}

function signetOfUndeath(): boolean {
  return true;
}

export const necromancerCoreSkillHandlers = Object.freeze({
  "necromancer.weapon-swap": swapWeapons,
  "necromancer.flip": flip,
  "necromancer.signet-vampirism": signetOfVampirism,
  "necromancer.signet-undeath": signetOfUndeath,
});
