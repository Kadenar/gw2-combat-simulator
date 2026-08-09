import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { replaceSkill } from "../../../platform/gw2/native-profession.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import type { RangerCastContext, RangerSkill } from "../types.js";
import { advanceRangerResources } from "./resources.js";
import { selectedRangerPet } from "./state.js";

function boonDuration(
  context: RangerCastContext,
  kind: string,
  baseDuration: number,
): number {
  const name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  const sigil = context.config.sigilSets?.[weaponSet - 1];
  const lingeringMagic =
    hasTrait(context, TRAIT.LINGERING_MAGIC) &&
    !professionStaticRulesApplied(context.config)
      ? 240
      : 0;
  const bonus =
    (Number(context.config.stats?.concentration || 0) + lingeringMagic) / 1500 +
    Number(context.config.stats?.boonDurationBonus || 0) / 100 +
    Number(context.config.stats?.boonDurationBonuses?.[name] || 0) / 100 +
    Number(sigil?.boonDurationBonus || 0) / 100;
  return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
}

function emitPartyBoon(
  context: RangerCastContext,
  skill: RangerSkill,
  sourceId: number,
  sourceName: string,
  kind: string,
  baseDuration: number,
  stacks = 1,
): void {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: sourceId,
    skillName: sourceName,
    name: `${sourceName} - ${kind}`,
    kind,
    boon: kind,
    duration: boonDuration(context, kind, baseDuration),
    stacks,
    recipients: "party",
    affectsSummons: true,
    maximumRecipients: 5,
    triggeredBy: skill.name,
  });
}

function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(
    (skill.petSkill && !skill.petFamilySkill) ||
    (skill.beastmodeSkill &&
      skill.id !== ID.BEASTMODE &&
      skill.id !== ID.LEAVE_BEASTMODE),
  );
}

function emitChildOfEarth(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, TRAIT.CHILD_OF_EARTH) ||
    context.start < state.childOfEarthReadyAt
  ) {
    return;
  }
  state.childOfEarthReadyAt = context.start + 20;
  const at = context.effectiveEnd;
  context.emit({
    type: "condition",
    at,
    source: "Trait",
    sourceId: TRAIT.CHILD_OF_EARTH,
    actorType: "effect",
    skillId: TRAIT.CHILD_OF_EARTH,
    skillName: "Child of Earth",
    name: "Lesser Muddy Terrain - Immobilized",
    condition: "Immobilized",
    duration: 1,
    stacks: 1,
    triggeredBy: skill.name,
  });
  for (let offset = 0; offset < 10; offset += 2) {
    for (const [condition, duration] of [
      ["Crippled", 2],
      ["Slow", 1],
    ] as const) {
      context.emit({
        type: "condition",
        at: at + offset,
        source: "Trait",
        sourceId: TRAIT.CHILD_OF_EARTH,
        actorType: "effect",
        skillId: TRAIT.CHILD_OF_EARTH,
        skillName: "Child of Earth",
        name: `Lesser Muddy Terrain - ${condition}`,
        condition,
        duration,
        stacks: 1,
        triggeredBy: skill.name,
      });
    }
  }
}

function completeRangerTraitSkill(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = professionCoreState(context);
  if (skill.type === "Heal") {
    if (hasTrait(context, TRAIT.WELLSPRING)) {
      emitPartyBoon(
        context,
        skill,
        TRAIT.WELLSPRING,
        "Wellspring",
        "regeneration",
        6,
      );
    }
    emitChildOfEarth(context, skill);
  }
  if (skill.weapon === "Warhorn" && hasTrait(context, TRAIT.WINDBORNE_NOTES)) {
    emitPartyBoon(
      context,
      skill,
      TRAIT.WINDBORNE_NOTES,
      "Windborne Notes",
      "regeneration",
      6,
    );
  }
  if (!isBeastSkill(skill)) return;
  if (
    hasTrait(context, TRAIT.REJUVENATION) &&
    context.start >= state.rejuvenationReadyAt
  ) {
    state.rejuvenationReadyAt = context.start + 20;
    emitPartyBoon(
      context,
      skill,
      TRAIT.REJUVENATION,
      "Rejuvenation",
      "regeneration",
      10,
    );
  }
  if (
    hasTrait(context, TRAIT.POISON_MASTER) &&
    context.combatStartTime != null &&
    context.start >= context.combatStartTime
  ) {
    context.emit({
      type: "ranger.beast-skill-used",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.POISON_MASTER,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
    });
  }
  if (
    hasTrait(context, TRAIT.WOLFSONG) &&
    selectedRangerPet(context.config).family === "canine"
  ) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.WOLFSONG,
      actorType: "effect",
      skillId: TRAIT.WOLFSONG,
      skillName: "Wolfsong",
      name: "Wolfsong - Vulnerability",
      kind: "target-vulnerability",
      duration: 6,
      stacks: 6,
      triggeredBy: skill.name,
    });
  }
}

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
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.petSwapCount += 1;
  const inCombat =
    context.combatStartTime != null && context.start >= context.combatStartTime;
  if (inCombat && hasTrait(context, TRAIT.SPIRITED_ARRIVAL)) {
    emitPartyBoon(
      context,
      skill,
      TRAIT.SPIRITED_ARRIVAL,
      "Spirited Arrival",
      "might",
      12,
      6,
    );
    emitPartyBoon(
      context,
      skill,
      TRAIT.SPIRITED_ARRIVAL,
      "Spirited Arrival",
      "fury",
      8,
    );
  }
  if (
    hasTrait(context, TRAIT.CLARION_BOND) &&
    context.start >= state.clarionBondReadyAt
  ) {
    state.clarionBondReadyAt = context.start + 15;
    for (const [kind, stacks] of [
      ["fury", 1],
      ["might", 6],
      ["swiftness", 1],
    ] as const) {
      emitPartyBoon(
        context,
        skill,
        TRAIT.CLARION_BOND,
        "Clarion Bond",
        kind,
        5,
        stacks,
      );
    }
    context.emit({
      type: "condition",
      at,
      source: "Trait",
      sourceId: TRAIT.CLARION_BOND,
      actorType: "effect",
      skillId: TRAIT.CLARION_BOND,
      skillName: "Clarion Bond",
      name: "Lesser Call of the Wild - Weakness",
      condition: "Weakness",
      duration: 5,
      stacks: 1,
      triggeredBy: skill.name,
    });
    context.emit({
      type: "blast_combo",
      at,
      source: "Trait",
      sourceId: TRAIT.CLARION_BOND,
      actorType: "effect",
      skillId: TRAIT.CLARION_BOND,
      skillName: "Clarion Bond",
      name: "Lesser Call of the Wild - Blast Finisher",
      triggeredBy: skill.name,
    });
  }
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
  advance: {
    id: "ranger.core-resources",
    order: 10,
    handler: advanceRangerResources,
  },
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
    completeRangerTraitSkill(context, skill);
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
