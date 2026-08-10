import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { replaceSkill } from "../../../platform/gw2/native-profession.js";
import { RANGER_SKILL_IDS as ID } from "../data/ids.js";
import type { RangerCastContext, RangerSkill } from "../types.js";
import {
  applyRangerPetSwapTraits,
  applyRangerSicEmTraits,
  applyRangerWeaponSwapTraits,
} from "./traits.js";

function swapRangerWeapons(
  context: RangerCastContext,
  skill: RangerSkill,
): boolean {
  const weaponSet = context.state.activeWeaponSet === 1 ? 2 : 1;
  context.state.activeWeaponSet = weaponSet;
  professionCoreState(context).autoattackChains = {};
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "ranger",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet,
  });
  applyRangerWeaponSwapTraits(context, skill);
  return true;
}

function performRangerDodge(context: RangerCastContext): boolean {
  const state = professionCoreState(context);
  state.endurance = Math.max(0, state.endurance - 50);
  state.enduranceUpdatedAt = context.start;
  return true;
}

function swapRangerPets(
  context: RangerCastContext,
  skill: RangerSkill,
): boolean {
  professionCoreState(context).petSwapCount += 1;
  applyRangerPetSwapTraits(context, skill);
  return true;
}

export const rangerCoreSkillHandlers = Object.freeze({
  "ranger.dodge": replaceSkill({
    beforeEffects: performRangerDodge,
  }),
  "ranger.pet-swap": replaceSkill({
    beforeEffects: swapRangerPets,
  }),
  "ranger.weapon-swap": replaceSkill({
    beforeEffects: swapRangerWeapons,
  }),
  "ranger.winters-bite": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      professionCoreState(context).winterBiteReady = true;
      context.emit({
        type: "ranger.winter-bite-ready",
        at: context.effectiveEnd,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
      });
    },
  },
  "ranger.sic-em": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const merged = Boolean(
        flattenProfessionState(context.state.profession).beastmodeActive,
      );
      context.emit({
        type: "buff",
        at: context.start,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        kind: merged ? "sic-em" : "sic-em-pet",
        duration: 10,
        stacks: 1,
      });
      applyRangerSicEmTraits(context, skill, merged);
    },
  },
  "ranger.crippling-shot": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      context.emit({
        type: "ranger.blood-thirst",
        at: context.effectiveEnd,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        charges: 3,
      });
    },
  },
});
