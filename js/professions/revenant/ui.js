import { revenantCatalog } from "./catalog.js";
import { REVENANT_LEGEND_IDS as LEGEND } from "./data/ids.js";
import {
  revenantLegend,
  revenantLegendLoadout,
} from "./legend-loadout.js";
import {
  REVENANT_RELEASE_POTENTIAL_BY_LEGEND,
} from "./legend-rules.js";
import { getActiveTraits } from "./data/traits-data.js";

/**
 * Revenant adapter for the shared simulator UI.
 *
 * This module exposes the legend-based slot loadout, profession and legend
 * swap actions, contextual facet and Alliance skills, Energy and Affinity
 * resources, disabled-state explanations, and Revenant state-log rows. The
 * underlying legend and combat behavior is implemented elsewhere.
 */

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}
function specializationFrom(context = {}) {
  return context.specialization || context.config?.specialization || "Core";
}
function activeLegendFrom(context = {}) {
  return (
    stateFrom(context).activeLegendId
    || context.build?.startingLegend
    || ""
  );
}
function effectiveEnergyCost(context, skill) {
  const state = stateFrom(context);
  if (
    skill.handlerId === "revenant.beguiling-haze"
    && Number(state.beguilingHazeCharges || 0) > 0
  ) return 0;
  if (
    skill.handlerId === "revenant.upkeep"
    && (state.activeUpkeeps || []).some(upkeep => upkeep.skillId === skill.id)
  ) return 0;
  return Math.max(0, Number(skill.energyCost || 0));
}
function hasEnoughEnergy(context, skill) {
  const energy = Number(stateFrom(context).energy);
  return !Number.isFinite(energy)
    || energy >= effectiveEnergyCost(context, skill);
}
function upkeepIsActive(context, skill) {
  return skill.handlerId === "revenant.upkeep"
    && (stateFrom(context).activeUpkeeps || [])
      .some(upkeep => upkeep.skillId === skill.id);
}
function rotationEntryName(entry) {
  return typeof entry === "string" ? entry : String(entry?.name || "");
}
export function revenantTimelineSkillIcon(context = {}) {
  if (rotationEntryName(context.entry) !== "Swap Legends") return "";
  const selected = context.build?.selectedLegends || [];
  if (selected.length !== 2) return "";
  const startingIndex = Math.max(
    0,
    selected.indexOf(context.build?.startingLegend),
  );
  const priorSwaps = (context.rotation || [])
    .slice(0, Math.max(0, Number(context.index || 0)))
    .filter(entry => rotationEntryName(entry) === "Swap Legends")
    .length;
  const destination = selected[(startingIndex + priorSwaps + 1) % 2];
  return revenantLegend(destination)?.icon || "";
}
const PROFESSION_NAMES = Object.freeze({
  Core: ["Ancient Echo"],
  Herald: ["Facet of Nature"],
  Renegade: ["Heroic Command", "Citadel Bombardment", "Orders from Above"],
  Vindicator: ["Alliance Tactics", "Energy Meld"],
  Conduit: ["Cosmic Wisdom"],
});
const CONSUMES = [
  "Infuse Light",
  "Burst of Strength",
  "Elemental Blast",
  "Gaze of Darkness",
  "Chaotic Release",
  "True Nature",
];
const KURZICK = [
  "Selfless Spirit",
  "Battle Dance",
  "Tree Song",
  "Awakening",
  "Urn of Saint Viktor",
];

function ids(names) {
  return [...new Set(names
    .map(name => revenantCatalog.skillsByName.get(name)?.id)
    .filter(Number.isFinite))];
}
export function revenantEventLogRow(event) {
  if (event.type !== "revenant.state") return undefined;
  return {
    at: event.at,
    type: "Revenant",
    name: event.reason || "State",
    detail: `Energy ${Number(event.state?.energy || 0).toFixed(1)}`,
  };
}

export const revenantUi = Object.freeze({
  targetHealthThresholds: (context = {}) => {
    const traits = getActiveTraits(
      context.build?.specializations || [],
    );
    return traits.some(trait => trait.name === "Swift Termination")
      ? [0.5]
      : [];
  },
  slotLoadout: revenantLegendLoadout,
  timelineSkillIcon: revenantTimelineSkillIcon,
  paletteGroups: context => {
    const state = stateFrom(context);
    const spec = specializationFrom(context);
    const legendBars = revenantLegendLoadout.view(context).bars;
    const professionNames = [...(
      PROFESSION_NAMES[spec] || PROFESSION_NAMES.Core
    )];
    if (spec === "Conduit") {
      const releasePotential =
        REVENANT_RELEASE_POTENTIAL_BY_LEGEND[activeLegendFrom(context)];
      if (releasePotential) professionNames.unshift(releasePotential);
    }
    const groups = [{
      id: "revenant-profession",
      label: "F",
      skillIds: ids(professionNames),
      skillEntries: legendBars.map(bar => ({
        skillId: -4,
        displayName: bar.compactLabel,
        fullDisplayName: bar.label,
        icon: revenantLegend(bar.id)?.icon || "",
        paletteLegendId: bar.id,
      })),
      color: "#a84f54",
      resourceAnchor: true,
    }];
    const availableConsumes = CONSUMES.flatMap(name =>
      revenantCatalog.skills.filter(skill =>
        skill.name === name && state.availableFlips?.[skill.id]).map(skill => skill.id));
    if (availableConsumes.length) {
      groups.push({
        id: "revenant-facet-consumes",
        label: "Flip",
        skillIds: availableConsumes,
        color: "#d06c72",
      });
    }
    if (
      state.activeLegendId === LEGEND.ALLIANCE
      && state.allianceSide === "kurzick"
    ) {
      groups.push({
        id: "revenant-alliance-kurzick",
        label: "Kurz",
        skillIds: ids(KURZICK),
        color: "#7696c7",
      });
    }
    return groups;
  },
  isPaletteSkillAvailable: (context, skill) => {
    if (
      skill.paletteLegendId
      && skill.paletteLegendId === activeLegendFrom(context)
    ) return false;
    if (upkeepIsActive(context, skill)) return false;
    return hasEnoughEnergy(context, skill);
  },
  paletteSkillUnavailableMessage: (context, skill) => {
    if (skill.paletteLegendId === activeLegendFrom(context)) {
      return `${skill.displayName || "Legend"} is already active`;
    }
    if (upkeepIsActive(context, skill)) {
      return `Use ${skill.flipSkillId
        ? revenantCatalog.skillsById.get(skill.flipSkillId)?.name
          || "the release skill"
        : "the release skill"} to end this upkeep`;
    }
    const cost = effectiveEnergyCost(context, skill);
    const energy = Number(stateFrom(context).energy);
    return Number.isFinite(energy) && energy < cost
      ? `Requires ${cost} Energy; currently ${energy}`
      : "";
  },
  resourceViews: context => {
    const state = stateFrom(context);
    const views = [{
      id: "energy",
      singular: "energy",
      plural: "energy",
      maximum: 100,
      value: Number(state.energy ?? context.initialEnergy ?? 50),
      startMaximum: 100,
      startValue: Number(context.initialEnergy ?? 50),
      canStart: true,
      buildKey: "initialEnergy",
      step: 1,
      displayMode: "bar",
      shortLabel: "E",
      statusLabel: "Current",
    }];
    if (specializationFrom(context) === "Conduit") {
      views.push({
        id: "affinity",
        singular: "affinity",
        plural: "affinity",
        maximum: 5,
        value: Number(state.affinity || 0),
        canStart: false,
        step: 1,
        displayMode: "bar",
        shortLabel: "Aff",
        statusLabel: "Current",
      });
    }
    return views;
  },
  eventLogRow: revenantEventLogRow,
});
