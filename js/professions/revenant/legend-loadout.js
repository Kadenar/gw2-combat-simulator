import { createFixedSlotLoadout } from "../../app/profession-slot-loadout.js";
import { revenantCatalog } from "./catalog.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
} from "./data/ids.js";
import { REVENANT_LEGEND_SPECIALIZATIONS } from "./legend-rules.js";
import { REVENANT_HANDLER_MECHANICS } from "./mechanics/handler-mechanics.js";

function id(name, legendId, preferredId = null) {
  const matches = revenantCatalog.skills.filter(
    (skill) =>
      skill.name === name && (!legendId || skill.legendId === legendId),
  );
  return (
    matches.find((skill) => skill.id === preferredId) ||
    matches[0] ||
    revenantCatalog.skillsByName.get(name)
  )?.id;
}

function icon(name) {
  return (
    revenantCatalog.skills.find((skill) => skill.name === name && skill.icon)
      ?.icon || ""
  );
}

function compactLegendName(name) {
  return String(name)
    .replace(/^Legendary\s+/, "")
    .replace(/\s+Stance$/, "");
}

export const REVENANT_LEGENDS = Object.freeze(
  [
    {
      id: LEGEND.ASSASSIN,
      name: "Legendary Assassin Stance",
      icon: icon("Legendary Assassin Stance"),
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
      icon: icon("Legendary Demon Stance"),
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
      icon: icon("Legendary Dwarf Stance"),
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
      icon: icon("Legendary Centaur Stance"),
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
      icon: icon("Legendary Dragon Stance"),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.DRAGON],
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
      icon: icon("Legendary Renegade Stance"),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.RENEGADE],
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
      icon: icon("Legendary Alliance Stance"),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.ALLIANCE],
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
      icon: icon("Legendary Entity Stance"),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.ENTITY],
      skillIds: [
        id("Shielding Hands", LEGEND.ENTITY),
        id("Beguiling Haze", LEGEND.ENTITY, 77141),
        id("Hex-Eater Vortex", LEGEND.ENTITY),
        id("Gladiator's Defense", LEGEND.ENTITY),
        id("Twin Moon Sweep", LEGEND.ENTITY, 76968),
      ],
    },
  ].map((entry) =>
    Object.freeze({
      ...entry,
      compactName: compactLegendName(entry.name),
      skillIds: Object.freeze(entry.skillIds.filter(Number.isFinite)),
    }),
  ),
);

const baseRevenantLegendLoadout = createFixedSlotLoadout({
  id: "revenant-legends",
  label: "Legends",
  entryLabel: "Legend",
  selectionKey: "selectedLegends",
  startingKey: "startingLegend",
  selectionCount: 2,
  selectionControl: "icons",
  includeStartingSelector: false,
  formatActiveBar: false,
  entries: REVENANT_LEGENDS,
  defaults: [LEGEND.ASSASSIN, LEGEND.DEMON],
});

export const revenantLegendLoadout = Object.freeze({
  ...baseRevenantLegendLoadout,
  palettePlacement: "after-actions",
  paletteGroups(context = {}) {
    const availableFlips =
      context.professionState?.availableFlips ||
      context.state?.profession?.availableFlips ||
      {};
    return baseRevenantLegendLoadout.paletteGroups(context).map((group) => ({
      ...group,
      skillIds: group.skillIds.flatMap((skillId) => {
        const heraldFlipId =
          REVENANT_HANDLER_MECHANICS.upkeep.facetConsumeBySkillId[skillId];
        if (Number.isFinite(heraldFlipId) && availableFlips[heraldFlipId]) {
          return [heraldFlipId];
        }
        if (
          skillId === SKILL.IMPOSSIBLE_ODDS &&
          availableFlips[SKILL.RELINQUISH_POWER]
        ) {
          return [skillId, SKILL.RELINQUISH_POWER];
        }
        if (
          skillId === SKILL.CALL_TO_ANGUISH &&
          availableFlips[SKILL.UNYIELDING_IMPACT]
        ) {
          return [skillId, SKILL.UNYIELDING_IMPACT];
        }
        return [skillId];
      }),
    }));
  },
});

export function revenantLegend(legendId) {
  return REVENANT_LEGENDS.find((legend) => legend.id === legendId) || null;
}
