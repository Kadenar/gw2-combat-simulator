import { professionCoreState } from "../../../../platform/engine/profession.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  revenantActiveBoonCount,
  revenantPlayer,
  revenantTimedBuff,
} from "../../core/attribute-rules.js";
import { emitRevenantBoon } from "../../core/boons.js";
import { revenantCombatActive } from "../../core/legend.js";
import { hasRevenantTrait } from "../../core/state.js";
import { HERALD_MECHANICS as MECHANICS } from "./mechanics.js";
import type {
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import type {
  RevenantSchedulerContext,
  RevenantSimulationEvent,
} from "../../types.js";

export const heraldModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "revenant.burst-of-strength-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: (context) => revenantTimedBuff(context, "burst-of-strength"),
  },
  {
    id: "revenant.burst-of-strength-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.05,
    when: (context) => revenantTimedBuff(context, "burst-of-strength"),
  },
  {
    id: "revenant.reinforced-potency",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) => revenantActiveBoonCount(context) * 0.01,
    when: (context) =>
      revenantPlayer(context) &&
      hasTrait(context, TRAIT.REINFORCED_POTENCY),
  },
]);

export const heraldAttributeRules = Object.freeze({
  modifierRules: heraldModifierRules,
});

export const heraldCastRules = Object.freeze({});

function observeHeraldEvent(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (
    event.type !== "sigil_swap" ||
    professionCoreState(context).activeLegendId !== LEGEND.DRAGON ||
    !revenantCombatActive(context, event.at)
  ) {
    return;
  }
  const swapSkill = event.skillId == null
    ? undefined
    : context.catalog.skillsById.get(event.skillId);
  if (!swapSkill) return;
  const invocation = MECHANICS.legendInvocation;
  if (hasRevenantTrait(context.config, TRAIT.SPIRIT_BOON)) {
    const boon = invocation.spiritBoon;
    emitRevenantBoon(
      context,
      swapSkill,
      boon.kind,
      boon.duration,
      boon.stacks,
      {
      at: event.at,
      sourceId: TRAIT.SPIRIT_BOON,
      name: `Spirit Boon — ${boon.kind}`,
      },
    );
  }
  if (!hasRevenantTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) return;
  const song = invocation.song;
  context.emit({
    type: "damage",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.SONG_OF_THE_MISTS,
    actorType: "player",
    skillId: TRAIT.SONG_OF_THE_MISTS,
    skillName: song.name,
    name: song.name,
    coefficient: song.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
  });
  for (const [condition, stacks, duration] of song.conditions) {
    context.emit({
      type: "condition",
      at: event.at,
      source: "revenant",
      sourceId: TRAIT.SONG_OF_THE_MISTS,
      actorType: "player",
      skillId: TRAIT.SONG_OF_THE_MISTS,
      skillName: song.name,
      name: `${song.name} — ${condition}`,
      condition: String(condition),
      stacks: Number(stacks),
      duration: Number(duration),
    });
  }
}

export const heraldSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "revenant.herald-legend-invocation",
    order: 20,
    handler: observeHeraldEvent,
  },
});
