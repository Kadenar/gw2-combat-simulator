import {
  createFixedSlotLoadout,
} from "../../app/profession-slot-loadout.js";
import { revenantCatalog } from "./catalog.js";
import { REVENANT_LEGEND_IDS as LEGEND } from "./data/ids.js";

function id(name, legendId, preferredId = null) {
  const matches = revenantCatalog.skills.filter(skill =>
    skill.name === name && (!legendId || skill.legendId === legendId));
  return (
    matches.find(skill => skill.id === preferredId)
    || matches[0]
    || revenantCatalog.skillsByName.get(name)
  )?.id;
}

export const REVENANT_LEGENDS = Object.freeze([
  {
    id: LEGEND.ASSASSIN,
    name: "Legendary Assassin Stance",
    skillIds: [
      id("Enchanted Daggers", LEGEND.ASSASSIN),
      id("Impossible Odds", LEGEND.ASSASSIN),
      id("Phase Traversal", LEGEND.ASSASSIN),
      id("Riposting Shadows", LEGEND.ASSASSIN),
      id("Jade Winds", LEGEND.ASSASSIN, 28406),
    ],
  },
  {
    id: LEGEND.DEMON,
    name: "Legendary Demon Stance",
    skillIds: [
      id("Empowering Misery", LEGEND.DEMON, 28219),
      id("Pain Absorption", LEGEND.DEMON, 27322),
      id("Banish Enchantment", LEGEND.DEMON, 27505),
      id("Call to Anguish", LEGEND.DEMON),
      id("Embrace the Darkness", LEGEND.DEMON),
    ],
  },
  {
    id: LEGEND.DWARF,
    name: "Legendary Dwarf Stance",
    skillIds: [
      id("Soothing Stone", LEGEND.DWARF, 27372),
      id("Inspiring Reinforcement", LEGEND.DWARF),
      id("Forced Engagement", LEGEND.DWARF),
      id("Vengeful Hammers", LEGEND.DWARF, 26557),
      id("Rite of the Great Dwarf", LEGEND.DWARF),
    ],
  },
  {
    id: LEGEND.CENTAUR,
    name: "Legendary Centaur Stance",
    skillIds: [
      id("Project Tranquility", LEGEND.CENTAUR, 29148),
      id("Natural Harmony", LEGEND.CENTAUR, 27025),
      id("Purifying Essence", LEGEND.CENTAUR, 27715),
      id("Protective Solace", LEGEND.CENTAUR, 26821),
      id("Energy Expulsion", LEGEND.CENTAUR, 27356),
    ],
  },
  {
    id: LEGEND.DRAGON,
    name: "Legendary Dragon Stance",
    specialization: "Herald",
    skillIds: [
      id("Facet of Light", LEGEND.DRAGON),
      id("Facet of Strength", LEGEND.DRAGON),
      id("Facet of Elements", LEGEND.DRAGON),
      id("Facet of Darkness", LEGEND.DRAGON),
      id("Facet of Chaos", LEGEND.DRAGON),
    ],
  },
  {
    id: LEGEND.RENEGADE,
    name: "Legendary Renegade Stance",
    specialization: "Renegade",
    skillIds: [
      id("Breakrazor's Bastion", LEGEND.RENEGADE, 45686),
      id("Razorclaw's Rage", LEGEND.RENEGADE, 42949),
      id("Icerazor's Ire", LEGEND.RENEGADE, 40485),
      id("Darkrazor's Daring", LEGEND.RENEGADE, 41220),
      id("Soulcleave's Summit", LEGEND.RENEGADE),
    ],
  },
  {
    id: LEGEND.ALLIANCE,
    name: "Legendary Alliance Stance",
    specialization: "Vindicator",
    skillIds: [
      id("Selfish Spirit", LEGEND.ALLIANCE),
      id("Nomad's Advance", LEGEND.ALLIANCE),
      id("Scavenger Burst", LEGEND.ALLIANCE),
      id("Reaver's Rage", LEGEND.ALLIANCE),
      id("Spear of Archemorus", LEGEND.ALLIANCE),
    ],
  },
  {
    id: LEGEND.ENTITY,
    name: "Legendary Entity Stance",
    specialization: "Conduit",
    skillIds: [
      id("Shielding Hands", LEGEND.ENTITY),
      id("Beguiling Haze", LEGEND.ENTITY, 77141),
      id("Hex-Eater Vortex", LEGEND.ENTITY),
      id("Gladiator's Defense", LEGEND.ENTITY),
      id("Twin Moon Sweep", LEGEND.ENTITY, 76968),
    ],
  },
].map(entry => Object.freeze({
  ...entry,
  skillIds: Object.freeze(entry.skillIds.filter(Number.isFinite)),
})));

export const revenantLegendLoadout = createFixedSlotLoadout({
  id: "revenant-legends",
  label: "Legends",
  entryLabel: "Legend",
  selectionKey: "selectedLegends",
  startingKey: "startingLegend",
  selectionCount: 2,
  entries: REVENANT_LEGENDS,
  defaults: [LEGEND.ASSASSIN, LEGEND.DEMON],
});

export function revenantLegend(legendId) {
  return REVENANT_LEGENDS.find(legend => legend.id === legendId) || null;
}

