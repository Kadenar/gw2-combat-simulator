import { type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import { createFixedSlotLoadout } from '#gw2/platform/builds/slot-loadout.js';
import { REVENANT_DECLARED_SKILLS } from '#gw2/professions/revenant/data/module-data.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_LEGEND_SPECIALIZATIONS } from '#gw2/professions/revenant/data/legends.js';
import { revenantUpkeepConsumeId } from '#gw2/professions/revenant/data/upkeep-skills.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { SlotLoadoutContext } from '#gw2/platform/builds/slot-loadout.js';
import type { Gw2SlotLoadout } from '#gw2/platform/builds/types.js';
import type { RevenantCanonicalBuild } from '#gw2/professions/revenant/types.js';

interface RevenantLegend {
  readonly id: string;
  readonly name: string;
  readonly compactName: string;
  readonly icon: string;
  readonly skillIds: readonly number[];
  readonly specialization?: string;
}

interface RevenantLegendLoadoutContext extends SlotLoadoutContext {
  professionState?: {
    activeLoadoutId?: string;
    availableFlips?: SkillFlipWindows;
  };
}

function icon(name: string): string {
  return REVENANT_DECLARED_SKILLS.find((skill) => skill.name === name && skill.icon)?.icon || '';
}

function compactLegendName(name: string): string {
  return name.replace(/^Legendary\s+/, '').replace(/\s+Stance$/, '');
}

export const REVENANT_LEGENDS: readonly RevenantLegend[] = Object.freeze(
  [
    {
      id: LEGEND.ASSASSIN,
      name: 'Legendary Assassin Stance',
      icon: icon('Legendary Assassin Stance'),
      skillIds: [
        SKILL.ENCHANTED_DAGGERS,
        SKILL.IMPOSSIBLE_ODDS,
        SKILL.PHASE_TRAVERSAL,
        SKILL.RIPOSTING_SHADOWS,
        SKILL.JADE_WINDS
      ]
    },
    {
      id: LEGEND.DEMON,
      name: 'Legendary Demon Stance',
      icon: icon('Legendary Demon Stance'),
      skillIds: [
        SKILL.EMPOWERING_MISERY,
        SKILL.PAIN_ABSORPTION,
        SKILL.BANISH_ENCHANTMENT,
        SKILL.CALL_TO_ANGUISH,
        SKILL.EMBRACE_THE_DARKNESS
      ]
    },
    {
      id: LEGEND.DWARF,
      name: 'Legendary Dwarf Stance',
      icon: icon('Legendary Dwarf Stance'),
      skillIds: [
        SKILL.SOOTHING_STONE,
        SKILL.INSPIRING_REINFORCEMENT,
        SKILL.FORCED_ENGAGEMENT,
        SKILL.VENGEFUL_HAMMERS,
        SKILL.RITE_OF_THE_GREAT_DWARF
      ]
    },
    {
      id: LEGEND.CENTAUR,
      name: 'Legendary Centaur Stance',
      icon: icon('Legendary Centaur Stance'),
      skillIds: [
        SKILL.PROJECT_TRANQUILITY,
        SKILL.NATURAL_HARMONY,
        SKILL.PURIFYING_ESSENCE,
        SKILL.PROTECTIVE_SOLACE,
        SKILL.ENERGY_EXPULSION
      ]
    },
    {
      id: LEGEND.DRAGON,
      name: 'Legendary Dragon Stance',
      icon: icon('Legendary Dragon Stance'),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.DRAGON],
      skillIds: [
        SKILL.FACET_OF_LIGHT,
        SKILL.FACET_OF_STRENGTH,
        SKILL.FACET_OF_ELEMENTS,
        SKILL.FACET_OF_DARKNESS,
        SKILL.FACET_OF_CHAOS
      ]
    },
    {
      id: LEGEND.RENEGADE,
      name: 'Legendary Renegade Stance',
      icon: icon('Legendary Renegade Stance'),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.RENEGADE],
      skillIds: [
        SKILL.BREAKRAZORS_BASTION,
        SKILL.RAZORCLAWS_RAGE,
        SKILL.ICERAZORS_IRE,
        SKILL.DARKRAZORS_DARING,
        SKILL.SOULCLEAVES_SUMMIT
      ]
    },
    {
      id: LEGEND.ALLIANCE,
      name: 'Legendary Alliance Stance',
      icon: icon('Legendary Alliance Stance'),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.ALLIANCE],
      skillIds: [
        SKILL.SELFISH_SPIRIT,
        SKILL.NOMADS_ADVANCE,
        SKILL.SCAVENGER_BURST,
        SKILL.REAVERS_RAGE,
        SKILL.SPEAR_OF_ARCHEMORUS
      ]
    },
    {
      id: LEGEND.ENTITY,
      name: 'Legendary Entity Stance',
      icon: icon('Legendary Entity Stance'),
      specialization: REVENANT_LEGEND_SPECIALIZATIONS[LEGEND.ENTITY],
      skillIds: [
        SKILL.SHIELDING_HANDS,
        SKILL.BEGUILING_HAZE,
        SKILL.HEX_EATER_VORTEX,
        SKILL.GLADIATORS_DEFENSE,
        SKILL.TWIN_MOON_SWEEP
      ]
    }
  ].map((entry) =>
    Object.freeze({
      ...entry,
      compactName: compactLegendName(entry.name),
      skillIds: Object.freeze(entry.skillIds)
    })
  )
);

const baseRevenantLegendLoadout = createFixedSlotLoadout<RevenantCanonicalBuild>({
  id: 'revenant-legends',
  label: 'Legends',
  entryLabel: 'Legend',
  selectionKey: 'selectedLegends',
  startingKey: 'startingLegend',
  selectionCount: 2,
  selectionControl: 'icons',
  includeStartingSelector: false,
  formatActiveBar: false,
  entries: REVENANT_LEGENDS,
  defaults: [LEGEND.ASSASSIN, LEGEND.DEMON]
});

export const revenantLegendLoadout = Object.freeze({
  ...baseRevenantLegendLoadout,
  palettePlacement: 'after-actions',
  skillChildren(context: RevenantLegendLoadoutContext, skillId: SkillId): readonly SkillId[] {
    // Loadout children follow the same selected declarations as activation and the live palette.
    if (!context.catalog) throw new Error('Revenant loadout children require the selected catalog.');
    const skill = context.catalog.skillsById.get(skillId);
    const consumeId = skill?.facet ? revenantUpkeepConsumeId(skill, String(skill.legendId ?? '')) : undefined;
    if (consumeId != null) return [consumeId];
    return Number(skillId) === SKILL.CALL_TO_ANGUISH ? [SKILL.UNYIELDING_IMPACT] : [];
  },
  paletteGroups(context: RevenantLegendLoadoutContext = {}) {
    if (!context.catalog) throw new Error('Revenant loadout palette requires the selected catalog.');
    const catalog = context.catalog;
    const availableFlips = context.professionState?.availableFlips || {};
    return baseRevenantLegendLoadout.paletteGroups(context).map((group) => ({
      ...group,
      color: group.active ? '#c4565d' : '#84343a',
      className: group.active ? 'compact-resource-palette revenant-legend-skills' : 'revenant-legend-skills-inactive',
      resourceAnchor: group.active,
      skillIds: group.skillIds.flatMap((skillId) => {
        const skill = catalog.skillsById.get(skillId);
        const heraldFlipId = skill?.facet ? revenantUpkeepConsumeId(skill, String(skill.legendId ?? '')) : undefined;
        if (heraldFlipId != null && availableFlips[heraldFlipId]) {
          return [Number(heraldFlipId)];
        }

        if (skillId === SKILL.IMPOSSIBLE_ODDS && availableFlips[SKILL.RELINQUISH_POWER]) {
          return [skillId, SKILL.RELINQUISH_POWER];
        }

        if (skillId === SKILL.CALL_TO_ANGUISH && availableFlips[SKILL.UNYIELDING_IMPACT]) {
          return [skillId, SKILL.UNYIELDING_IMPACT];
        }

        return [skillId];
      })
    }));
  }
}) satisfies Gw2SlotLoadout<RevenantCanonicalBuild>;

export function revenantLegend(legendId: string): RevenantLegend | null {
  return REVENANT_LEGENDS.find((legend) => legend.id === legendId) || null;
}
