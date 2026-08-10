import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefEndurance,
  gainThiefInitiative,
} from "./shared.js";
import type { ThiefCastContext, ThiefSkill } from "../types.js";

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
    if (context.config.target?.boonless !== false) {
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

export function applyStealCompletionTraits(
  context: ThiefCastContext,
  at: number,
): void {
  if (hasThiefTrait(context.config, TRAIT.KLEPTOMANIAC)) {
    gainThiefInitiative(context, 2, at, "kleptomaniac");
  }
  if (hasThiefTrait(context.config, TRAIT.ENDURANCE_THIEF)) {
    gainThiefEndurance(context, 50, at, "endurance-thief");
  }
}

export function updateThiefTraitCastState(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const initiativeCost = Math.max(0, Number(skill.initiativeCost || 0));
  if (initiativeCost > 0 && hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS)) {
    const expirations = state.leadAttackExpirations || [];
    for (
      let stack = 0;
      stack < initiativeCost && expirations.length < 15;
      stack += 1
    ) {
      expirations.push(at + 10);
    }
    state.leadAttackExpirations = expirations;
    state.leadAttacksStacks = expirations.length;
    state.leadAttacksUntil = expirations.length ? Math.max(...expirations) : 0;
    emitThiefState(context, at, "lead-attacks");
  }
  if (skill.movementSkill) {
    let movementStateChanged = false;
    if (hasThiefTrait(context.config, TRAIT.FLUID_STRIKES)) {
      state.fluidStrikesUntil = at + 5;
      movementStateChanged = true;
    }
    if (hasThiefTrait(context.config, TRAIT.HARD_TO_CATCH)) {
      gainThiefEndurance(context, 8, at, "hard-to-catch");
    } else if (movementStateChanged) {
      emitThiefState(context, at, "fluid-strikes");
    }
  }
  const isDualWieldAttack =
    skill.categories?.includes("DualWield") ||
    Boolean(
      skill.requiredMainHand && typeof skill.requiredOffHand === "string",
    );
  if (
    isDualWieldAttack &&
    hasThiefTrait(context.config, TRAIT.DEADLY_AMBITION)
  ) {
    const potentPoison = hasThiefTrait(context.config, TRAIT.POTENT_POISON);
    emitThiefCondition(context, {
      at,
      condition: "Poisoned",
      duration: 3,
      stacks: potentPoison ? 2 : 1,
      sourceId: TRAIT.DEADLY_AMBITION,
      name: "Deadly Ambition — Poison",
    });
  }
}
