import {
  professionCoreState,
  professionSpecializationState,
} from "../../../../platform/engine/profession.js";
/**
 * Revenant dodge execution.
 *
 * Pays the core or Vindicator endurance cost, snapshots the new resource
 * state, and emits the selected dodge replacement's delayed strike from the
 * immutable profile in this specialization's mechanics module.
 */
import { emitRevenantState } from "../../core/shared.js";
import { VINDICATOR_MECHANICS as MECHANICS } from "./mechanics.js";
import { REVENANT_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasRevenantTrait } from "../../core/state.js";
import { emitRevenantBoon } from "../../core/boons.js";
import { revenantCombatActive } from "../../core/legend.js";
import type {
  RevenantCastContext,
  RevenantDodge,
  RevenantSchedulerContext,
  RevenantSkill,
} from "../../types.js";

/** Applies Energy Meld's selected Vindicator trait package. */
export function performEnergyMeld(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = professionSpecializationState(context, "Vindicator");
  const coreState = professionCoreState(context);
  const profile = MECHANICS.endurance.energyMeld;
  const at = context.effectiveEnd;
  const songOfArboreum = hasRevenantTrait(
    context.config,
    TRAIT.SONG_OF_ARBOREUM,
  );
  coreState.endurance = Math.min(
    coreState.maximumEndurance,
    coreState.endurance +
      (
        songOfArboreum
          ? profile.songOfArboreumEndurance
          : profile.endurance
      ),
  );
  coreState.enduranceUpdatedAt = at;
  if (hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE)) {
    state.reaversCurseUntil = at + profile.reaversCurseDuration;
  }
  if (
    hasRevenantTrait(context.config, TRAIT.ANGSIYANS_TRUST) &&
    revenantCombatActive(context, at)
  ) {
    coreState.energy = Math.min(
      coreState.maximumEnergy,
      coreState.energy + profile.angsiyansTrustEnergy,
    );
  }
  if (songOfArboreum) {
    emitRevenantBoon(
      context,
      skill,
      "vigor",
      profile.songOfArboreumVigorDuration,
      1,
      { at, sourceId: TRAIT.SONG_OF_ARBOREUM },
    );
  }
  emitRevenantState(context, at, "energy-meld");
}

/** Toggles the active Luxon/Kurzick Alliance skill side. */
export function switchAllianceTactics(
  context: RevenantCastContext,
): void {
  const state = professionSpecializationState(context, "Vindicator");
  const at = context.effectiveEnd;
  state.allianceSide = state.allianceSide === "luxon" ? "kurzick" : "luxon";
  emitRevenantState(context, at, "alliance-tactics");
}

/** Emits the configured Vindicator dodge replacement at cast completion. */
export function completeVindicatorDodge(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  start: number,
): void {
  const state = professionSpecializationState(context, "Vindicator");
  const dodge = state.selectedDodge;
  const dodgeByName = MECHANICS.endurance.dodgeByName as Partial<
    Record<RevenantDodge, { readonly coefficient: number; readonly hits: number }>
  >;
  const effect = dodgeByName[dodge];
  if (!effect || !(Number(effect.coefficient) > 0)) return;
  const at = start + MECHANICS.endurance.dodgeStrikeDelay;
  const reaversCurse =
    hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE) &&
    Number(state.reaversCurseUntil || 0) + context.epsilon >= at;
  if (reaversCurse) state.reaversCurseUntil = 0;
  const previousForerunnerUntil = Number(
    state.forerunnerOfDeathUntil || 0,
  );
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: dodge,
    name: dodge,
    coefficient:
      Number(effect.coefficient) *
      (
        reaversCurse
          ? MECHANICS.endurance.energyMeld
            .reaversCurseDodgeDamageMultiplier
          : 1
      ),
    hits: Number(effect.hits || 1),
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    forerunnerOfDeathActive:
      previousForerunnerUntil > at,
  });
  if (
    dodge === "Death Drop" &&
    hasRevenantTrait(context.config, TRAIT.FORERUNNER_OF_DEATH)
  ) {
    state.forerunnerOfDeathUntil =
      at + MECHANICS.endurance.forerunnerOfDeathDuration;
    context.emit({
      type: "buff",
      at,
      source: "revenant",
      sourceId: TRAIT.FORERUNNER_OF_DEATH,
      actorType: "player",
      skillId: TRAIT.FORERUNNER_OF_DEATH,
      skillName: "Forerunner of Death",
      name: "Forerunner of Death",
      kind: "forerunner-of-death",
      duration: MECHANICS.endurance.forerunnerOfDeathDuration,
      stacks: 1,
    });
  }
  emitRevenantState(context, at, "vindicator-dodge-impact");
}
