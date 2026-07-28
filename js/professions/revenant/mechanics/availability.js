import {
  REVENANT_AUTOATTACK_CHAINS,
} from "../catalog.js";

const CHAIN_BY_ID = new Map();
for (const chain of REVENANT_AUTOATTACK_CHAINS) {
  chain.forEach((id, index) => CHAIN_BY_ID.set(id, {
    root: chain[0],
    next: chain[index + 1] ?? null,
  }));
}
const LUXON = new Set([
  "Selfish Spirit",
  "Nomad's Advance",
  "Scavenger Burst",
  "Reaver's Rage",
  "Spear of Archemorus",
]);
const KURZICK = new Set([
  "Selfless Spirit",
  "Battle Dance",
  "Tree Song",
  "Awakening",
  "Urn of Saint Viktor",
]);
const PROFESSION_SPEC = Object.freeze({
  "Facet of Nature": "Herald",
  "True Nature": "Herald",
  "Heroic Command": "Renegade",
  "Citadel Bombardment": "Renegade",
  "Orders from Above": "Renegade",
  "Alliance Tactics": "Vindicator",
  "Energy Meld": "Vindicator",
  "Cosmic Wisdom": "Conduit",
});
const RELEASE_BY_LEGEND = Object.freeze({
  LegendaryAssassin: "Release Potential: Assassin",
  LegendaryCentaur: "Release Potential: Monk",
  LegendaryDemon: "Release Potential: Dervish",
  LegendaryDwarf: "Release Potential: Warrior",
  LegendaryDragon: "Release Potential: Mesmer",
  LegendaryRenegade: "Release Potential: Warrior",
  LegendaryAlliance: "Release Potential: Dervish",
  LegendaryEntity: "Release Potential: Mesmer",
});

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
  if (skill.id === -4) {
    if (state.selectedLegendIds.length !== 2) {
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
    const cost = specialization === "Vindicator" ? 100 : 50;
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
  const requiredSpec = PROFESSION_SPEC[skill.name];
  if (requiredSpec && requiredSpec !== specialization) {
    return deny(
      skill,
      "revenant.wrong-specialization",
      `requires ${requiredSpec}.`,
    );
  }
  if (
    skill.name.startsWith("Release Potential:")
    && RELEASE_BY_LEGEND[state.activeLegendId] !== skill.name
  ) {
    return deny(
      skill,
      "revenant.release-variant",
      "the active legend supplies a different Release Potential variant.",
    );
  }
  if (
    skill.specialization
    && skill.type !== "Weapon"
    && skill.specialization !== specialization
  ) {
    return deny(
      skill,
      "revenant.wrong-specialization",
      `requires ${skill.specialization}.`,
    );
  }
  if (
    LUXON.has(skill.name)
    && state.activeLegendId === "LegendaryAlliance"
    && state.allianceSide !== "luxon"
  ) {
    return deny(skill, "revenant.alliance-side", "switch to the Luxon side.");
  }
  if (
    KURZICK.has(skill.name)
    && state.activeLegendId === "LegendaryAlliance"
    && state.allianceSide !== "kurzick"
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
  if (skill.facet && state.activeUpkeeps.some(upkeep =>
    upkeep.skillId === skill.id)) {
    return deny(
      skill,
      "revenant.facet-active",
      "the facet is already active; consume it instead.",
    );
  }
  const upkeepActive = state.activeUpkeeps.some(upkeep =>
    upkeep.skillId === skill.id);
  const cost = upkeepActive ? 0 : Number(skill.energyCost || 0);
  if (state.energy + context.epsilon < cost) {
    return deny(
      skill,
      "revenant.insufficient-energy",
      `requires ${cost} energy.`,
    );
  }
  const chain = CHAIN_BY_ID.get(skill.id);
  if (
    chain
    && (state.autoattackChains[chain.root] || chain.root) !== skill.id
  ) {
    return deny(
      skill,
      "revenant.autoattack-chain",
      "cast the earlier chain skill first.",
    );
  }
  return { ready: true };
}
