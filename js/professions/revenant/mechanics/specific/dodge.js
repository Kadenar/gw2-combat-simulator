/**
 * Revenant dodge execution.
 *
 * Pays the core or Vindicator endurance cost, snapshots the new resource
 * state, and emits the selected dodge replacement's delayed strike from the
 * immutable profile in handler-mechanics.js.
 */
import { emitRevenantState } from "./shared.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { REVENANT_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasRevenantTrait } from "../../state.js";
import { emitRevenantBoon } from "./conduit.js";
import { revenantCombatActive } from "./legend.js";

/** Applies Energy Meld's selected Vindicator trait package. */
export function performEnergyMeld(context, skill) {
  const state = context.state.profession;
  const profile = MECHANICS.endurance.energyMeld;
  const at = context.effectiveEnd;
  const songOfArboreum = hasRevenantTrait(
    context.config,
    TRAIT.SONG_OF_ARBOREUM,
  );
  state.endurance = Math.min(
    state.maximumEndurance,
    Number(state.endurance || 0) +
      (
        songOfArboreum
          ? profile.songOfArboreumEndurance
          : profile.endurance
      ),
  );
  state.enduranceUpdatedAt = at;
  if (hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE)) {
    state.reaversCurseUntil = at + profile.reaversCurseDuration;
  }
  if (
    hasRevenantTrait(context.config, TRAIT.ANGSIYANS_TRUST) &&
    revenantCombatActive(context, at)
  ) {
    state.energy = Math.min(
      state.maximumEnergy,
      Number(state.energy || 0) + profile.angsiyansTrustEnergy,
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

/** Executes the configured dodge replacement as a complete skill profile. */
export function performRevenantDodge(context, skill) {
  const state = context.state.profession;
  const cost =
    context.config.specialization === "Vindicator"
      ? MECHANICS.endurance.vindicatorDodgeCost
      : MECHANICS.endurance.dodgeCost;
  state.endurance = Math.max(0, state.endurance - cost);
  emitRevenantState(context, context.start, "dodge");
  const dodge = state.selectedDodge;
  const effect = MECHANICS.endurance.dodgeByName[dodge];
  if (!(Number(effect?.coefficient) > 0)) return;
  const at = context.start + MECHANICS.endurance.dodgeStrikeDelay;
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
