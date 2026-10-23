import type { ProfessionAppState } from '#gw2/app/types.js';
import type { ProvisionalParameter } from '#gw2/integrations/patches/authoring/patches.js';
import { provisionalValue } from '#gw2/integrations/patches/authoring/provisional-values.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';

export interface PreviewAssumptionValue {
  readonly parameter: ProvisionalParameter;
  readonly value: number;
  readonly defaultValue: number;
  readonly custom: boolean;
}

export interface PreviewAssumptionGroup {
  readonly traitId: string;
  readonly name: string;
  readonly specialization: string;
  readonly selected: boolean;
  readonly values: PreviewAssumptionValue[];
}

/** Display fractional bonuses as percentages while keeping session values in canonical units. */
export function displayAssumptionValue(parameter: ProvisionalParameter, value: number): number {
  return Number((value * (parameter.unit === '%' ? 100 : 1)).toFixed(6));
}

export function canonicalAssumptionValue(parameter: ProvisionalParameter, value: number): number {
  return Number((value / (parameter.unit === '%' ? 100 : 1)).toFixed(6));
}

/** Limit controls to equipped trait lines, retaining unselected traits within those lines for preview tuning. */
export function previewAssumptionGroups(app: ProfessionAppState): PreviewAssumptionGroup[] {
  const preview = app.profession?.preview;
  const declaration = preview?.professions?.[app.contentId];

  if (!preview || !declaration?.provisional?.length) return [];

  const defaults = app.profession.resolvePatch({ id: preview.id }).catalog;
  const catalog = app.patch.id === preview.id ? app.patch.catalog : defaults;
  const specializations = new Set(app.build.specializations.map(({ name }) => name));
  const selected = new Set(selectedTraits(catalog, app.build.specializations).map((trait) => String(trait.id)));
  const groups = new Map<string, PreviewAssumptionGroup>();
  for (const parameter of declaration.provisional) {
    if (!specializations.has(parameter.specialization)) continue;

    let group = groups.get(parameter.traitId);

    if (!group) {
      group = {
        traitId: parameter.traitId,
        name: catalog.traits.find((trait) => String(trait.id) === parameter.traitId)!.name,
        specialization: parameter.specialization,
        selected: selected.has(parameter.traitId),
        values: []
      };
      groups.set(parameter.traitId, group);
    }

    const value = provisionalValue(catalog, parameter);
    const defaultValue = provisionalValue(defaults, parameter);
    group.values.push({ parameter, value, defaultValue, custom: value !== defaultValue });
  }

  return [...groups.values()];
}

/** Count only equipped-trait inputs; editing an unused trait must not mark the current result as customized. */
export function previewAssumptionCounts(groups: readonly PreviewAssumptionGroup[]): { total: number; custom: number } {
  const values = groups.filter((group) => group.selected).flatMap((group) => group.values);
  return { total: values.length, custom: values.filter((value) => value.custom).length };
}
