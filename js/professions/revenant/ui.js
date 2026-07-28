import { revenantCatalog } from "./catalog.js";
import { REVENANT_LEGEND_IDS as LEGEND } from "./data/ids.js";
import { revenantLegendLoadout } from "./legend-loadout.js";

function stateFrom(context = {}) {
  return context.state?.profession || context.professionState || {};
}
function specializationFrom(context = {}) {
  return context.specialization || context.config?.specialization || "Core";
}
const PROFESSION_NAMES = Object.freeze({
  Core: ["Ancient Echo"],
  Herald: ["Facet of Nature"],
  Renegade: ["Heroic Command", "Citadel Bombardment", "Orders from Above"],
  Vindicator: ["Alliance Tactics", "Energy Meld"],
  Conduit: [
    "Release Potential: Assassin",
    "Release Potential: Monk",
    "Release Potential: Mesmer",
    "Release Potential: Warrior",
    "Release Potential: Dervish",
    "Cosmic Wisdom",
  ],
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
  return names.flatMap(name =>
    revenantCatalog.skills.filter(skill => skill.name === name).map(skill => skill.id));
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
  slotLoadout: revenantLegendLoadout,
  paletteGroups: context => {
    const state = stateFrom(context);
    const spec = specializationFrom(context);
    const groups = [{
      id: "revenant-profession",
      label: "F",
      skillIds: [-4, ...ids(PROFESSION_NAMES[spec] || PROFESSION_NAMES.Core)],
      color: "#a84f54",
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

