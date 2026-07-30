import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from "./revenant-api-metadata.js";
import type { RevenantApiTrait } from "./revenant-api-metadata.js";
import type { RevenantSpecializationSelection } from "../types.js";

export const SPECIALIZATIONS = CATALOG_SPECIALIZATIONS.map(
  (specialization) => specialization.name,
);

export const ELITE_SPECS = new Set(
  CATALOG_SPECIALIZATIONS.filter((specialization) => specialization.elite).map(
    (specialization) => specialization.name,
  ),
);

export const CORE_SPECS = CATALOG_SPECIALIZATIONS.filter(
  (specialization) => !specialization.elite,
).map((specialization) => specialization.name);

export const TRAITS = CATALOG_SPECIALIZATIONS.flatMap((specialization) => [
  ...specialization.minorTraits,
  ...specialization.majorTraits.flat(),
]);

export function getActiveTraits(
  specializations: readonly RevenantSpecializationSelection[] = [],
): RevenantApiTrait[] {
  const active: RevenantApiTrait[] = [];
  for (const selection of specializations) {
    const specialization = CATALOG_SPECIALIZATIONS.find(
      (candidate) => candidate.name === selection?.name,
    );
    if (!specialization) continue;
    active.push(...specialization.minorTraits);
    const picks = String(selection.traits || "")
      .split("-")
      .map(Number);
    for (let tier = 0; tier < 3; tier += 1) {
      const trait = specialization.majorTraits[tier]?.[picks[tier] - 1];
      if (trait) active.push(trait);
    }
  }
  return active;
}
