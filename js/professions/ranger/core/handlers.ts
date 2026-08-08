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
  const state = professionCoreState(context);
  const inCombat =
    context.combatStartTime != null && context.start >= context.combatStartTime;
  if (
    inCombat &&
    hasTrait(context, TRAIT.TAIL_WIND) &&
    context.start >= state.tailWindReadyAt
  ) {
    state.tailWindReadyAt = context.start + 9;
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.TAIL_WIND,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Tail Wind",
      kind: "swiftness",
      duration: 9,
      stacks: 1,
    });
  }
  if (
    inCombat &&
    hasTrait(context, TRAIT.QUICK_DRAW) &&
    context.start >= state.quickDrawReadyAt
  ) {
    state.quickDrawReadyAt = context.start + 9;
    state.quickDrawUntil = context.start + 5;
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.QUICK_DRAW,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Quick Draw",
      kind: "quickness",
      duration: 3,
      stacks: 1,
    });
  }
  if (
    inCombat &&
    hasTrait(context, TRAIT.FURIOUS_GRIP) &&
    context.start >= state.furiousGripReadyAt
  ) {
    state.furiousGripReadyAt = context.start + 9;
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.FURIOUS_GRIP,
      actorType: "effect",
      skillId: skill.id,
      skillName: "Furious Grip",
      kind: "fury",
      duration: 5,
      stacks: 1,
    });
  }
  return true;
}

export const rangerCoreSkillHandlers = Object.freeze({
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
  "ranger.path-of-scars": {
    mode: "augment" as const,
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
      if (merged && hasTrait(context, TRAIT.RESOUNDING_TIMBRE)) {
        context.emit({
          type: "ranger.boon-extension",
          at: context.start,
          source: "ranger",
          sourceId: TRAIT.RESOUNDING_TIMBRE,
          actorType: "effect",
          skillId: skill.id,
          skillName: "Resounding Timbre",
          duration: 2,
        });
      }
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

export const rangerCoreSchedulerHooks = Object.freeze({
  onCastComplete(context: RangerCastContext, skill: RangerSkill): void {
    const state = professionCoreState(context);
    if (
      skill.type === "Weapon" &&
      skill.slot !== "Weapon_1" &&
      skill.id !== ID.SWAP_WEAPONS &&
      context.start < state.quickDrawUntil
    ) {
      state.quickDrawUntil = 0;
    }
    if (
      skill.id !== ID.PATH_OF_SCARS &&
      skill.id !== ID.PATH_OF_SCARS_MAX_RANGE
    ) {
      return;
    }
    const readyAt = Number(
      context.state.cooldowns.get(skill.id) || context.effectiveEnd,
    );
    context.state.cooldowns.set(ID.PATH_OF_SCARS, readyAt);
    context.state.cooldowns.set(ID.PATH_OF_SCARS_MAX_RANGE, readyAt);
  },
});
