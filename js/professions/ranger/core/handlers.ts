import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { replaceSkill } from "../../../platform/gw2/native-profession.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type { RangerCastContext, RangerSkill } from "../types.js";
import {
  applyRangerPetSwapTraits,
  applyRangerWeaponSwapTraits,
} from "./traits.js";
import { rangerPetByName } from "./state.js";

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
  if (hasTrait(context, TRAIT.LIGHT_ON_YOUR_FEET)) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.LIGHT_ON_YOUR_FEET,
      actorType: "effect",
      skillId: TRAIT.LIGHT_ON_YOUR_FEET,
      skillName: "Light on your Feet",
      kind: "light-on-your-feet",
      duration: 6,
      stacks: 1,
    });
  }
  return true;
}

function swapRangerPets(
  context: RangerCastContext,
  skill: RangerSkill,
): boolean {
  const state = professionCoreState(context);
  state.petSwapCount += 1;
  state.activePetSlot = state.activePetSlot === 1 ? 2 : 1;
  const pet = rangerPetByName(state.petNames[state.activePetSlot - 1]);
  state.activePet = pet.name;
  state.activePetSkillIds = [...pet.skillIds];
  state.petOpeningStrikeReady = true;
  context.emit({
    type: "ranger.pet-swapped",
    at: context.effectiveEnd,
    source: "ranger",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    activePet: pet.name,
    activePetSlot: state.activePetSlot,
  });
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
