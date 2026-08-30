import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/types.js';

export const REVENANT_CORE_LEGEND_IDS = Object.freeze([LEGEND.ASSASSIN, LEGEND.DEMON, LEGEND.DWARF, LEGEND.CENTAUR]);

export const REVENANT_ELITE_LEGEND_BY_SPECIALIZATION: Readonly<Record<string, string>> = Object.freeze({
  Herald: LEGEND.DRAGON,
  Renegade: LEGEND.RENEGADE,
  Vindicator: LEGEND.ALLIANCE,
  Conduit: LEGEND.ENTITY
});

export const REVENANT_LEGEND_SPECIALIZATIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(REVENANT_ELITE_LEGEND_BY_SPECIALIZATION).map(([specialization, legendId]) => [
      legendId,
      specialization
    ])
  )
);

export const REVENANT_RELEASE_POTENTIAL_BY_LEGEND: Readonly<Record<string, string>> = Object.freeze({
  [LEGEND.ASSASSIN]: 'Release Potential: Assassin',
  [LEGEND.CENTAUR]: 'Release Potential: Monk',
  [LEGEND.DEMON]: 'Release Potential: Mesmer',
  [LEGEND.DWARF]: 'Release Potential: Warrior',
  [LEGEND.ENTITY]: 'Release Potential: Dervish'
});

export const REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND: Readonly<Record<string, SkillId>> = Object.freeze({
  [LEGEND.ASSASSIN]: ID.RELEASE_POTENTIAL_ASSASSIN,
  [LEGEND.CENTAUR]: ID.RELEASE_POTENTIAL_MONK,
  [LEGEND.DEMON]: ID.RELEASE_POTENTIAL_MESMER,
  [LEGEND.DWARF]: ID.RELEASE_POTENTIAL_WARRIOR,
  [LEGEND.ENTITY]: ID.RELEASE_POTENTIAL_DERVISH
});

export function legalRevenantLegendIds(specialization = 'Core'): string[] {
  const eliteLegend = REVENANT_ELITE_LEGEND_BY_SPECIALIZATION[specialization];
  return eliteLegend ? [...REVENANT_CORE_LEGEND_IDS, eliteLegend] : [...REVENANT_CORE_LEGEND_IDS];
}

export function isLegalRevenantLegendId(legendId: string, specialization = 'Core'): boolean {
  return legalRevenantLegendIds(specialization).includes(legendId);
}

export function normalizeRevenantLegendIds(
  selectedLegends: readonly string[] | null | undefined,
  specialization = 'Core'
): string[] {
  const legal = legalRevenantLegendIds(specialization);
  const legalIds = new Set(legal);
  const selected: string[] = [];
  for (const legendId of [...(selectedLegends || []), ...legal]) {
    if (legalIds.has(legendId) && !selected.includes(legendId) && selected.length < 2) selected.push(legendId);
  }

  return selected;
}
