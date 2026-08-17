import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { replaceSkill } from "../../../platform/gw2/native-profession.js";
import { RANGER_SKILL_IDS as ID } from "../data/ids.js";
import type { RangerCastContext, RangerSkill } from "../types.js";
import {
  applyRangerDodgeTraits,
  applyRangerPetSwapTraits,
  applyRangerWeaponSwapTraits,
} from "./traits.js";
import { rangerPetByName } from "./state.js";
import {
  rangerBalanceProfile,
  rangerBalanceProfileEffect,
  rangerBalanceValue,
  RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE,
} from "./profiles.js";

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
  state.endurance = Math.max(
    0,
    state.endurance -
      rangerBalanceValue(context, PROFILE.resources, "resourceCost", 50),
  );
  state.enduranceUpdatedAt = context.start;
  applyRangerDodgeTraits(context);
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
  if (context.state.profession.specialization.kind === "Soulbeast") {
    context.state.profession.specialization.state.archetype = pet.archetype;
  }
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
  "ranger.poisonous-strikes": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const profile = rangerBalanceProfile(context, PROFILE.poisonousStrikes);
      context.emit({
        type: "ranger.poisonous-strikes",
        at: context.effectiveEnd,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        charges: Number(profile?.playerStacks ?? 2),
        duration: Number(profile?.durationMultiplier ?? 10),
      });
    },
  },
  "ranger.sharpening-stone": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const profile = rangerBalanceProfile(context, PROFILE.sharpeningStone);
      context.emit({
        type: "ranger.sharpening-stone",
        at: context.start,
        source: "ranger",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        charges: Number(profile?.playerStacks ?? 10),
        duration: Number(profile?.durationMultiplier ?? 30),
      });
    },
  },
  "ranger.sun-spirit": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const burning = rangerBalanceProfileEffect(
        rangerBalanceProfile(context, PROFILE.sunSpirit),
        "condition",
      );
      context.emit({
        type: "condition",
        at: context.effectiveEnd,
        source: "ranger",
        sourceId: ID.SOLAR_FLARE,
        actorType: "player",
        skillId: ID.SOLAR_FLARE,
        skillName: "Solar Flare",
        name: "Solar Flare - Burning",
        condition: "Burning",
        stacks: Number(burning?.stacks ?? 3),
        duration: Number(burning?.duration ?? 6),
        triggeredBy: skill.name,
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
        duration: rangerBalanceValue(
          context,
          PROFILE.sicEm,
          "durationMultiplier",
          10,
        ),
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
        charges: rangerBalanceValue(
          context,
          PROFILE.bloodThirst,
          "playerStacks",
          3,
        ),
      });
    },
  },
});
