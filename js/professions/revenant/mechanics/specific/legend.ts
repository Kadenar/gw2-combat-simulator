/**
 * Revenant legend-swap transition.
 *
 * Switches the active fixed bar, resets Energy/upkeep/flip state, fires the
 * shared swap-sigil event, and applies invocation traits. Conduit-specific
 * affinity, Cosmic Wisdom, Found Purpose, and Alliance-side transitions are
 * committed in the same ordered state change.
 */
import { REVENANT_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from "../../legend-rules.js";
import { hasRevenantTrait } from "../../state.js";
import { emitNuminousGift, gainConduitAffinity } from "./conduit.js";
import { applyLegendInvocationTraits } from "./legend-traits.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { emitRevenantState } from "./shared.js";
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSkill,
} from "../../types.js";

/** Reports whether invocation-only combat effects may run at a timestamp. */
export function revenantCombatActive(
  context: RevenantSchedulerContext,
  at = context.state.time,
): boolean {
  return (
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null &&
      at + context.epsilon >= Number(context.combatStartTime))
  );
}

/** Executes the complete legend-swap transition at cast completion. */
export function swapRevenantLegend(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  const cosmicWisdomActive = state.cosmicWisdomUntil > at;
  const previousEnergy = state.energy;
  const other = state.selectedLegendIds.find(
    (id) => id !== state.activeLegendId,
  );
  state.activeLegendId = other || state.activeLegendId;
  state.activeLoadoutId = state.activeLegendId;
  state.legendSwapReadyAt = at + Number(context.rechargeDuration || 10);
  state.energy =
    previousEnergy <= MECHANICS.energy.chargedMistsThreshold &&
    hasRevenantTrait(context.config, TRAIT.CHARGED_MISTS)
      ? MECHANICS.energy.chargedMistsSwap
      : MECHANICS.energy.legendSwap;
  state.energyUpdatedAt = at;
  state.activeUpkeeps = [];
  state.availableFlips = {};
  if (state.activeLegendId === "LegendaryAlliance") {
    state.allianceSide =
      context.config.allianceSide === "kurzick" ? "kurzick" : "luxon";
  }
  if (context.config.specialization === "Conduit") {
    // Legend swap discards all existing affinity before invocation traits,
    // sigils, or other swap procs can grant new affinity.
    state.affinity = 0;
    if (
      revenantCombatActive(context, at) &&
      hasRevenantTrait(context.config, TRAIT.LINGERING_DETERMINATION)
    ) {
      gainConduitAffinity(
        context,
        MECHANICS.legendInvocation.lingeringDeterminationAffinity,
        "lingering-determination",
      );
    }
    if (
      cosmicWisdomActive &&
      hasRevenantTrait(context.config, TRAIT.ENHANCED_EMBODIMENT)
    ) {
      state.cosmicWisdomUntil +=
        MECHANICS.legendInvocation.enhancedEmbodimentExtension;
    }
    if (cosmicWisdomActive) {
      state.conduitForm =
        REVENANT_RELEASE_POTENTIAL_BY_LEGEND[state.activeLegendId]?.replace(
          "Release Potential: ",
          "",
        ) || "";
    }
    if (hasRevenantTrait(context.config, TRAIT.FOUND_PURPOSE)) {
      emitNuminousGift(context, skill, { allies: true });
    }
  }
  context.emit({
    type: "sigil_swap",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
  if (revenantCombatActive(context, at)) {
    applyLegendInvocationTraits(context, skill);
  }
  emitRevenantState(context, at, "legend-swap");
}
