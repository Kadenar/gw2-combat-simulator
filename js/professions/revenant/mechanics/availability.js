import { REVENANT_AUTOATTACK_CHAINS } from "../catalog.js";
import {
  isLegalRevenantLegendId,
  REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND,
} from "../legend-rules.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
} from "../data/ids.js";
import {
  REVENANT_HANDLER_MECHANICS as MECHANICS,
} from "./handler-mechanics.js";

const CHAIN_BY_ID = new Map();
for (const chain of REVENANT_AUTOATTACK_CHAINS) {
  chain.forEach((id, index) =>
    CHAIN_BY_ID.set(id, {
      root: chain[0],
      next: chain[index + 1] ?? null,
    }),
  );
}
const LUXON = new Set([
  ID.SELFISH_SPIRIT,
  ID.NOMADS_ADVANCE,
  ID.SCAVENGER_BURST,
  ID.REAVERS_RAGE,
  ID.SPEAR_OF_ARCHEMORUS,
]);
const KURZICK = new Set([
  ID.SELFLESS_SPIRIT,
  ID.BATTLE_DANCE,
  ID.TREE_SONG,
  ID.AWAKENING,
  ID.URN_OF_SAINT_VIKTOR,
]);
const UPKEEP_RELEASES = new Set([
  ID.RELEASE_HAMMERS,
  ID.RESIST_THE_DARKNESS,
  ID.RELINQUISH_POWER,
  ID.DISMISS_LIEUTENANT_SOULCLEAVE,
]);
const PROFESSION_SPEC = new Map([
  [ID.FACET_OF_NATURE, "Herald"],
  [ID.TRUE_NATURE, "Herald"],
  [ID.TRUE_NATURE_ID_51675, "Herald"],
  [ID.TRUE_NATURE_ID_51696, "Herald"],
  [ID.TRUE_NATURE_ID_51713, "Herald"],
  [ID.TRUE_NATURE_ID_51714, "Herald"],
  [ID.HEROIC_COMMAND, "Renegade"],
  [ID.CITADEL_BOMBARDMENT, "Renegade"],
  [ID.ORDERS_FROM_ABOVE, "Renegade"],
  [ID.ALLIANCE_TACTICS, "Vindicator"],
  [ID.ENERGY_MELD, "Vindicator"],
  [ID.ENERGY_MELD_ID_72058, "Vindicator"],
  [ID.COSMIC_WISDOM, "Conduit"],
]);
const RELEASE_POTENTIAL_IDS = new Set(
  Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND),
);
function deny(skill, code, cause, retryAt = null) {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  };
}

export function revenantCastAvailability(context, skill) {
  const state = context.state.profession;
  const specialization = String(context.config.specialization || "Core");
  if (
    skill.id === ID.TRUE_STRIKE
    && !state.availableFlips[ID.TRUE_STRIKE]
  ) {
    return deny(
      skill,
      "revenant.imperial-guard-inactive",
      "channel Imperial Guard first.",
    );
  }
  if (
    skill.id === ID.IMPERIAL_GUARD
    && state.availableFlips[ID.TRUE_STRIKE]
  ) {
    return deny(
      skill,
      "revenant.true-strike-ready",
      "use or let True Strike expire first.",
    );
  }
  if (
    skill.handlerId === "revenant.beguiling-haze"
    && Number(state.beguilingHazeCharges || 0) <= 0
    && context.start < Number(state.beguilingHazeReadyAt || 0)
  ) {
    return deny(
      skill,
      "revenant.beguiling-haze-cooldown",
      "Beguiling Haze is recharging.",
      Number(state.beguilingHazeReadyAt),
    );
  }
  if (skill.id === -4) {
    if (
      state.selectedLegendIds.length !== 2
      || state.selectedLegendIds.some(
        legendId => !isLegalRevenantLegendId(legendId, specialization),
      )
    ) {
      return deny(skill, "revenant.legend-pair", "select two legal legends.");
    }
    if (context.start < state.legendSwapReadyAt) {
      return deny(
        skill,
        "revenant.legend-swap-cooldown",
        "legend swap is recharging.",
        state.legendSwapReadyAt,
      );
    }
    return { ready: true };
  }
  if (skill.id === -5) {
    const cost = specialization === "Vindicator"
      ? MECHANICS.endurance.vindicatorDodgeCost
      : MECHANICS.endurance.dodgeCost;
    return state.endurance >= cost
      ? { ready: true }
      : deny(
          skill,
          "revenant.insufficient-endurance",
          `requires ${cost} endurance.`,
        );
  }
  if (skill.legendId && skill.legendId !== state.activeLegendId) {
    return deny(
      skill,
      "revenant.inactive-legend",
      "invoke the matching legend first.",
    );
  }
  const requiredSpec = PROFESSION_SPEC.get(skill.id);
  if (requiredSpec && requiredSpec !== specialization) {
    return deny(
      skill,
      "revenant.wrong-specialization",
      `requires ${requiredSpec}.`,
    );
  }
  if (RELEASE_POTENTIAL_IDS.has(skill.id)) {
    if (specialization !== "Conduit") {
      return deny(
        skill,
        "revenant.wrong-specialization",
        "requires Conduit.",
      );
    }
    if (
      REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[state.activeLegendId]
        !== skill.id
    ) {
      return deny(
        skill,
        "revenant.release-variant",
        "the active legend supplies a different Release Potential variant.",
      );
    }
  }
  if (
    skill.specialization &&
    skill.type !== "Weapon" &&
    skill.specialization !== specialization
  ) {
    return deny(
      skill,
      "revenant.wrong-specialization",
      `requires ${skill.specialization}.`,
    );
  }
  if (
    LUXON.has(skill.id) &&
    state.activeLegendId === LEGEND.ALLIANCE &&
    state.allianceSide !== "luxon"
  ) {
    return deny(skill, "revenant.alliance-side", "switch to the Luxon side.");
  }
  if (
    KURZICK.has(skill.id) &&
    state.activeLegendId === LEGEND.ALLIANCE &&
    state.allianceSide !== "kurzick"
  ) {
    return deny(skill, "revenant.alliance-side", "switch to the Kurzick side.");
  }
  if (skill.consume && !state.availableFlips[skill.id]) {
    return deny(
      skill,
      "revenant.facet-inactive",
      "activate the matching facet first.",
    );
  }
  if (UPKEEP_RELEASES.has(skill.id) && !state.availableFlips[skill.id]) {
    return deny(
      skill,
      "revenant.upkeep-inactive",
      "activate the matching upkeep skill first.",
    );
  }
  if (
    skill.handlerId === "revenant.upkeep"
    && !skill.facet
    && state.activeUpkeeps.some(upkeep => upkeep.skillId === skill.id)
  ) {
    return deny(
      skill,
      "revenant.upkeep-active",
      "use the matching release skill.",
    );
  }
  if (
    skill.facet &&
    state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id)
  ) {
    return deny(
      skill,
      "revenant.facet-active",
      "the facet is already active; consume it instead.",
    );
  }
  const upkeepActive = state.activeUpkeeps.some(
    (upkeep) => upkeep.skillId === skill.id,
  );
  const beguilingFollowUp = (
    skill.handlerId === "revenant.beguiling-haze"
    && Number(state.beguilingHazeCharges || 0) > 0
  );
  const cost = upkeepActive || beguilingFollowUp
    ? 0
    : Number(skill.energyCost || 0);
  if (state.energy + context.epsilon < cost) {
    return deny(
      skill,
      "revenant.insufficient-energy",
      `requires ${cost} energy.`,
    );
  }
  const chain = CHAIN_BY_ID.get(skill.id);
  if (
    chain &&
    (state.autoattackChains[chain.root] || chain.root) !== skill.id
  ) {
    return deny(
      skill,
      "revenant.autoattack-chain",
      "cast the earlier chain skill first.",
    );
  }
  return { ready: true };
}
