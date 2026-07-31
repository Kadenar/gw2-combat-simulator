import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND } from "../../legend-rules.js";
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from "../../legend-rules.js";
import { bolsteredBondsBonuses } from "../../bolstered-bonds.js";
import {
  revenantPlayer,
  revenantProfessionState,
  revenantTargetVulnerability,
} from "../../core/attribute-rules.js";
import { denyRevenantSkill } from "../../core/availability.js";
import { CONDUIT_MECHANICS as MECHANICS } from "./mechanics.js";
import {
  completeBeguilingHaze,
  emitNuminousGift,
  emitLesserEnchantedDaggers,
  gainConduitAffinity,
  handleConduitAffinityHit,
  syncConduitEnergyCostOverrides,
} from "./conduit.js";
import { effectiveRevenantEnergyCost } from "../../core/energy.js";
import { hasRevenantTrait } from "../../core/state.js";
import { revenantCombatActive } from "../../core/legend.js";
import {
  afterConduitTraitCast,
  modifyConduitCastDuration,
  modifyConduitRechargeDuration,
  observeConduitTraits,
} from "./traits.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2Stats,
} from "../../../../platform/gw2/types.js";
import type {
  RevenantCastContext,
  RevenantPrecastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";

function affinity(context: Gw2ModifierContext): number {
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  return Math.min(
    5,
    Number(revenantProfessionState(context).affinity || 0) + bonus,
  );
}

function equippedLegend(context: Gw2ModifierContext, legendId: string): boolean {
  return (
    revenantProfessionState(context).selectedLegendIds || []
  ).includes(legendId);
}

export const conduitModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "revenant.targeted-destruction-numinous-gift",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => {
      const base = 1 + revenantTargetVulnerability(context) * 0.005;
      return (base + 0.05) / base;
    },
    when: (context) =>
      revenantPlayer(context) &&
      hasTrait(context, TRAIT.TARGETED_DESTRUCTION) &&
      hasTrait(context, TRAIT.NUMINOUS_GIFT),
  },
  {
    id: "revenant.release-dervish-assassin-affinity",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + affinity(context) * 0.1,
    when: (context) =>
      ["Release Potential: Dervish", "Release Potential: Assassin"].includes(
        String(context.event?.skillName || ""),
      ),
  },
  {
    id: "revenant.release-warrior-affinity",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + affinity(context) * 0.15,
    when: (context) =>
      context.event?.skillName === "Release Potential: Warrior",
  },
  {
    id: "revenant.beguiling-haze-assassin-resonance",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 2,
    when: (context) =>
      context.event?.skillName === "Beguiling Haze" &&
      equippedLegend(context, LEGEND.ASSASSIN),
  },
  {
    id: "revenant.twin-moon-assassin-resonance",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.5,
    when: (context) =>
      context.event?.skillName === "Twin Moon Sweep" &&
      equippedLegend(context, LEGEND.ASSASSIN),
  },
]);

function modifyConduitConditionDuration(
  context: Gw2ModifierContext,
  duration: number,
): number {
  const damaging = new Set([
    "Bleeding",
    "Burning",
    "Confusion",
    "Poisoned",
    "Torment",
  ]);
  return damaging.has(String(context.condition || "")) &&
    hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
    hasTrait(context, TRAIT.NUMINOUS_GIFT) &&
    !professionStaticRulesApplied(context.config)
    ? duration + 0.05
    : duration;
}

function modifyConduitAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2Stats,
): Gw2Stats {
  const modified = { ...attributes } as Record<string, number>;
  if (context.config?.specialization !== "Conduit") return modified;
  const state = revenantProfessionState(context);
  const cosmicMultiplier =
    Number(state.cosmicWisdomUntil || 0) > context.time ? 2 : 1;
  const buildMultiplier = professionStaticRulesApplied(context.config) ? 1 : 0;
  const bonuses = bolsteredBondsBonuses(
    state.selectedLegendIds,
    cosmicMultiplier - buildMultiplier,
  );
  for (const [attribute, bonus] of Object.entries(bonuses)) {
    modified[attribute] = Number(modified[attribute] || 0) + Number(bonus || 0);
  }
  if (hasTrait(context, TRAIT.DETERMINED_RESOLUTION)) {
    modified.strikeDamageReduction =
      Number(modified.strikeDamageReduction || 0) + 0.05;
  }
  if (hasTrait(context, TRAIT.SERENE_REJUVENATION)) {
    modified.healingEffectiveness =
      Number(modified.healingEffectiveness || 0) + 0.05;
  }
  if (hasTrait(context, TRAIT.CONTAINED_TEMPER)) {
    modified.containedTemperEnergyGainBonus =
      Number(modified.containedTemperEnergyGainBonus || 0) + 5;
  }
  return modified;
}

export const conduitAttributeRules = Object.freeze({
  modifierRules: conduitModifierRules,
  modifyAttributes: modifyConduitAttributes,
  modifyConditionDuration: modifyConduitConditionDuration,
});

const RELEASE_POTENTIAL_IDS = new Set(
  Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND),
);

function conduitCastAvailability(
  context: RevenantPrecastContext,
  skill: RevenantSkill,
) {
  const state = context.state.profession;
  if (
    skill.handlerId === "revenant.beguiling-haze" &&
    Number(state.beguilingHazeCharges || 0) <= 0 &&
    context.start < Number(state.beguilingHazeReadyAt || 0)
  ) {
    return denyRevenantSkill(
      skill,
      "revenant.beguiling-haze-cooldown",
      "Beguiling Haze is recharging.",
      Number(state.beguilingHazeReadyAt),
    );
  }
  if (
    RELEASE_POTENTIAL_IDS.has(skill.id) &&
    REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[state.activeLegendId] !==
      skill.id
  ) {
    return denyRevenantSkill(
      skill,
      "revenant.release-variant",
      "the active legend supplies a different Release Potential variant.",
    );
  }
  return { ready: true as const };
}

export const conduitCastRules = Object.freeze({
  availability: {
    id: "revenant.conduit-availability",
    order: 20,
    handler: conduitCastAvailability,
  },
  modifyCastDuration: modifyConduitCastDuration,
  modifyRechargeDuration: modifyConduitRechargeDuration,
});

function afterConduitCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  afterConduitTraitCast(context, skill);
  if (skill.handlerId !== "revenant.upkeep") return;
  const active = context.state.profession.activeUpkeeps.find(
    (upkeep) => upkeep.skillId === skill.id,
  );
  if (active && active.nextAffinityAt == null) {
    active.nextAffinityAt =
      context.effectiveEnd + 3;
  }
  if (
    active &&
    skill.id === ID.IMPOSSIBLE_ODDS &&
    active.nextAlliedProcAt == null
  ) {
    active.nextAlliedProcAt = context.effectiveEnd + 1;
  }
}

function completeConduitCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  completeBeguilingHaze(context, skill);
}

function advanceConduitUpkeep(
  context: RevenantSchedulerContext,
  target: number,
): void {
  const state = context.state.profession;
  if (state.cosmicWisdomUntil > 0 && target >= state.cosmicWisdomUntil) {
    state.cosmicWisdomUntil = 0;
    state.conduitForm = "";
    syncConduitEnergyCostOverrides(state);
  }
  for (const active of state.activeUpkeeps) {
    if (
      active.nextAffinityAt != null &&
      target + context.epsilon >= active.nextAffinityAt
    ) {
      gainConduitAffinity(context, 1, "enigmatic-upkeep");
      active.nextAffinityAt += 3;
    }
    if (
      active.skillId === ID.IMPOSSIBLE_ODDS &&
      active.nextAlliedProcAt != null &&
      target + context.epsilon >= active.nextAlliedProcAt
    ) {
      const skill = context.catalog.skillsById.get(active.skillId);
      if (skill) {
        while (
          active.nextAlliedProcAt != null &&
          target + context.epsilon >= active.nextAlliedProcAt
        ) {
          emitLesserEnchantedDaggers(
            context,
            skill,
            active.nextAlliedProcAt,
          );
          active.nextAlliedProcAt += 1;
        }
      }
    }
  }
}

function gainConduitAffinityFromCost(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const cost = effectiveRevenantEnergyCost(context, skill);
  if (!(cost > 0)) return;
  if (skill.legendId && !skill.affinityOnHit) {
    gainConduitAffinity(
      context,
      cost >= 25 ? 2 : 1,
      "enigmatic-connection",
    );
  } else if (
    skill.type === "Weapon" &&
    hasRevenantTrait(context.config, TRAIT.CONDUCTIVE_ARMAMENTS)
  ) {
    gainConduitAffinity(context, 1, "conductive-armaments");
  }
}

function observeConduitEvent(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (event.type !== "sigil_swap") return;
  const state = context.state.profession;
  const cosmicWisdomActive = state.cosmicWisdomUntil > event.at;
  state.affinity = 0;
  if (
    revenantCombatActive(context, event.at) &&
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
    syncConduitEnergyCostOverrides(state);
  }
  const swapSkill = event.skillId == null
    ? undefined
    : context.catalog.skillsById.get(event.skillId);
  if (
    swapSkill &&
    hasRevenantTrait(context.config, TRAIT.FOUND_PURPOSE)
  ) {
    emitNuminousGift(context, swapSkill, { allies: true });
  }
}

export const conduitSchedulerHooks = Object.freeze({
  advance: {
    id: "revenant.conduit-upkeep",
    order: 20,
    handler: advanceConduitUpkeep,
  },
  afterCast: {
    id: "revenant.conduit-upkeep-start",
    order: 20,
    handler: afterConduitCast,
  },
  onCastComplete: {
    id: "revenant.conduit-cast-complete",
    order: 20,
    handler: completeConduitCast,
  },
  onCastStart: {
    id: "revenant.conduit-energy-cost",
    order: 20,
    handler: gainConduitAffinityFromCost,
  },
  onEventScheduled: {
    id: "revenant.conduit-events",
    order: 20,
    handler: (
      context: RevenantSchedulerContext,
      event: RevenantSimulationEvent,
    ): void => {
      observeConduitTraits(context, event);
      observeConduitEvent(context, event);
    },
  },
  onCooldownReset: {
    id: "revenant.conduit-cooldown-reset",
    order: 20,
    handler: (context: RevenantSchedulerContext): void => {
      context.state.profession.beguilingHazeReadyAt = context.state.time;
    },
  },
  taskHandlers: Object.freeze({
    "revenant.affinity-hit": handleConduitAffinityHit,
  }),
});
