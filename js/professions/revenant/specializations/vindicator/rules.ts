import {
  professionCoreState,
  professionSpecializationState,
} from "../../../../platform/engine/profession.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { professionStaticRulesApplied } from "../../../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { denyRevenantSkill } from "../../core/availability.js";
import { emitRevenantBoon } from "../../core/boons.js";
import { revenantCombatActive } from "../../core/legend.js";
import { hasRevenantTrait } from "../../core/state.js";
import {
  revenantPlayer,
  revenantRuntimeCoreState,
  revenantRuntimeSpecializationState,
} from "../../core/attribute-rules.js";
import { VINDICATOR_MECHANICS as MECHANICS } from "./mechanics.js";
import { completeVindicatorDodge } from "./dodge.js";
import {
  modifyVindicatorCastDuration,
  modifyVindicatorRechargeDuration,
} from "./traits.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2Stats,
} from "../../../../platform/gw2/types.js";
import type {
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  RevenantPrecastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";

function enduranceNotFull(context: Gw2ModifierContext): boolean {
  const state = revenantRuntimeCoreState(context);
  const maximum = Number(state.maximumEndurance || 0);
  return maximum > 0 && Number(state.endurance || 0) < maximum - 1e-9;
}

export const vindicatorModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "revenant.leviathan-strength",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "multiply",
      factor: MECHANICS.endurance.leviathanStrengthStrikeMultiplier,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.LEVIATHAN_STRENGTH) &&
        enduranceNotFull(context),
    },
    {
      id: "revenant.forerunner-of-death",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: MECHANICS.endurance.forerunnerOfDeathStrikeBonus,
      when: (context) =>
        revenantPlayer(context) &&
        hasTrait(context, TRAIT.FORERUNNER_OF_DEATH) &&
        (
          context.event?.forerunnerOfDeathActive != null
            ? Boolean(context.event.forerunnerOfDeathActive)
            : Number(
                revenantRuntimeSpecializationState(context)
                  .forerunnerOfDeathUntil || 0,
              ) > context.time
        ),
    },
  ]);

function modifyVindicatorAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2Stats,
): Gw2Stats {
  const modified = { ...attributes };
  if (
    hasTrait(context, TRAIT.EMPIRE_DIVIDED) &&
    !professionStaticRulesApplied(context.config) &&
    Number(context.config?.playerHealthFraction ?? 1) >
      MECHANICS.endurance.empireDividedHealthThreshold
  ) {
    modified.power =
      Number(modified.power || 0) + MECHANICS.endurance.empireDividedPower;
  }
  return modified;
}

function observeVindicatorEvent(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (event.type === "revenant.state" && event.reason === "dodge") {
    const skill = context.catalog.skillsById.get(ID.DODGE) as
      | RevenantSkill
      | undefined;
    if (skill) completeVindicatorDodge(context, skill, event.at);
    return;
  }
  if (event.type !== "sigil_swap") return;
  const state = professionSpecializationState(context, "Vindicator");
  const coreState = professionCoreState(context);
  if (coreState.activeLegendId === LEGEND.ALLIANCE) {
    state.allianceSide =
      context.config.allianceSide === "kurzick" ? "kurzick" : "luxon";
  }
  if (
    coreState.activeLegendId !== LEGEND.ALLIANCE ||
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
  coreState.endurance = Math.min(
    coreState.maximumEndurance,
    coreState.endurance +
      song.enduranceOnCast +
      song.endurancePerHit,
  );
  coreState.enduranceUpdatedAt = event.at;
}

export const vindicatorAttributeRules = Object.freeze({
  modifierRules: vindicatorModifierRules,
  modifyAttributes: modifyVindicatorAttributes,
});

const LUXON = new Set<SkillId>([
  ID.SELFISH_SPIRIT,
  ID.NOMADS_ADVANCE,
  ID.SCAVENGER_BURST,
  ID.REAVERS_RAGE,
  ID.SPEAR_OF_ARCHEMORUS,
]);
const KURZICK = new Set<SkillId>([
  ID.SELFLESS_SPIRIT,
  ID.BATTLE_DANCE,
  ID.TREE_SONG,
  ID.AWAKENING,
  ID.URN_OF_SAINT_VIKTOR,
]);

function vindicatorCastAvailability(
  context: RevenantPrecastContext,
  skill: RevenantSkill,
) {
  const state = professionSpecializationState(context, "Vindicator");
  const wrongSide =
    professionCoreState(context).activeLegendId === LEGEND.ALLIANCE &&
    (
      (LUXON.has(skill.id) && state.allianceSide !== "luxon") ||
      (KURZICK.has(skill.id) && state.allianceSide !== "kurzick")
    );
  return wrongSide
    ? denyRevenantSkill(
        skill,
        "revenant.alliance-side",
        `switch to the ${
          LUXON.has(skill.id) ? "Luxon" : "Kurzick"
        } side.`,
      )
    : { ready: true as const };
}

export const vindicatorCastRules = Object.freeze({
  availability: {
    id: "revenant.vindicator-availability",
    order: 20,
    handler: vindicatorCastAvailability,
  },
  modifyCastDuration: modifyVindicatorCastDuration,
  modifyRechargeDuration: modifyVindicatorRechargeDuration,
});
export const vindicatorSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "revenant.vindicator-dodge",
    order: 20,
    handler: observeVindicatorEvent,
  },
});
