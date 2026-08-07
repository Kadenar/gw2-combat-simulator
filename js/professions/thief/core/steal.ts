import { professionCoreState } from "../../../platform/engine/profession.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefEndurance,
  gainThiefInitiative,
} from "./shared.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type { ThiefCastContext } from "../types.js";

const STOLEN_ID_BY_CHOICE: Readonly<Record<string, number>> = Object.freeze({
  "throw-gunk": ID.THROW_GUNK,
  "consume-plasma": ID.CONSUME_PLASMA,
  "whirling-axe": ID.WHIRLING_AXE,
});
function emitStealBoon(
  context: ThiefCastContext,
  at: number,
  boon: string,
  duration: number,
  stacks = 1,
): void {
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: `thief.steal.${boon}`,
    actorType: "player",
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name: `Steal — ${boon}`,
    kind: boon,
    boon,
    duration,
    stacks,
  });
}

function selectedStolenSkill(context: ThiefCastContext): SkillId {
  const choice =
    context.config.deterministicChoices?.stolenSkillChoice
    || "throw-gunk";
  return STOLEN_ID_BY_CHOICE[choice] || ID.THROW_GUNK;
}

export function emitStealTraitEffects(context: ThiefCastContext): void {
  const at = context.effectiveEnd;
  const state = professionCoreState(context);
  const potentPoison = hasThiefTrait(context.config, TRAIT.POTENT_POISON);
  if (hasThiefTrait(context.config, TRAIT.SERPENTS_TOUCH)) {
    emitThiefCondition(context, {
      at,
      condition: "Poisoned",
      duration: 10,
      stacks: potentPoison ? 3 : 2,
      sourceId: TRAIT.SERPENTS_TOUCH,
      name: "Serpent's Touch — Poison",
    });
  }
  if (hasThiefTrait(context.config, TRAIT.MUG)) {
    context.emit({
      type: "damage",
      at,
      source: "Trait",
      sourceId: TRAIT.MUG,
      actorType: "player",
      skillId: context.skill?.id,
      skillName: context.skill?.name,
      name: "Mug",
      coefficient: 1.5,
      hits: 1,
      canCrit: false,
    });
  }
  if (hasThiefTrait(context.config, TRAIT.EVEN_THE_ODDS)) {
    emitThiefCondition(context, {
      at,
      condition: "Vulnerability",
      duration: 10,
      stacks: 10,
      sourceId: TRAIT.EVEN_THE_ODDS,
      name: "Even the Odds — Vulnerability",
    });
  }
  if (hasThiefTrait(context.config, TRAIT.DEADLY_AMBUSH)) {
    emitThiefCondition(context, {
      at,
      condition: "Bleeding",
      duration: 10,
      stacks: 3,
      sourceId: TRAIT.DEADLY_AMBUSH,
      name: "Deadly Ambush — Bleeding",
    });
  }
  if (hasThiefTrait(context.config, TRAIT.THRILL_OF_THE_CRIME)) {
    emitStealBoon(context, at, "Fury", 10);
    emitStealBoon(context, at, "Might", 10, 5);
    emitStealBoon(context, at, "Swiftness", 10);
  }
  if (hasThiefTrait(context.config, TRAIT.BOUNTIFUL_THEFT)) {
    emitStealBoon(context, at, "Vigor", 10);
    if (context.config?.target?.boonless !== false) {
      emitStealBoon(context, at, "Might", 10, 5);
    }
  }
  if (hasThiefTrait(context.config, TRAIT.SLEIGHT_OF_HAND)) {
    context.emit({
      type: "control",
      at,
      source: "Trait",
      sourceId: TRAIT.SLEIGHT_OF_HAND,
      actorType: "player",
      skillId: context.skill?.id,
      skillName: context.skill?.name,
      name: "Sleight of Hand - Daze",
      effect: "Daze",
      duration: 1,
    });
  }
  if (hasThiefTrait(context.config, TRAIT.HIDDEN_THIEF)) {
    const readyAt = Number(state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] ?? 0);
    if (at + 1e-9 >= readyAt) {
      state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] = at + 2;
      emitThiefCondition(context, {
        at,
        condition: "Blindness",
        duration: 3,
        stacks: 1,
        sourceId: TRAIT.HIDDEN_THIEF,
        name: "Hidden Thief - Blindness",
      });
      emitThiefCondition(context, {
        at,
        condition: "Weakness",
        duration: 3,
        stacks: 1,
        sourceId: TRAIT.HIDDEN_THIEF,
        name: "Hidden Thief - Weakness",
      });
    }
  }
}

export function completeStealWithStoredSkill(
  context: ThiefCastContext,
  storedSkillId: SkillId | null,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.storedStolenSkillId = storedSkillId;
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(context, 2, at, "kleptomaniac");
  }
  if (hasThiefTrait(context.config, TRAIT.ENDURANCE_THIEF)) {
    gainThiefEndurance(context, 25, at, "endurance-thief");
  }
  emitThiefState(context, at, "steal");
}

export function completeSteal(context: ThiefCastContext): void {
  completeStealWithStoredSkill(context, selectedStolenSkill(context));
}

export function consumeStoredStolenSkill(context: ThiefCastContext): void {
  professionCoreState(context).storedStolenSkillId = null;
  emitThiefState(context, context.effectiveEnd, "stolen-skill-used");
}
