import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './warrior-api-metadata.js';
import type { WarriorApiTrait } from './warrior-api-metadata.js';

export interface WarriorSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

export const TRAITS: readonly WarriorApiTrait[] = Object.freeze(
  CATALOG_SPECIALIZATIONS.flatMap((specialization) => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat()
  ])
);

export function getActiveTraits(specializations: readonly WarriorSpecializationSelection[] = []): WarriorApiTrait[] {
  const active: WarriorApiTrait[] = [];
  for (const selected of specializations) {
    const specialization = CATALOG_SPECIALIZATIONS.find((candidate) => candidate.name === selected?.name);
    if (!specialization) continue;
    active.push(...specialization.minorTraits);
    const choices = String(selected.traits || '')
      .split('-')
      .map((value) => Number(value));
    for (let tier = 0; tier < specialization.majorTraits.length; tier += 1) {
      const choice = choices[tier];
      if (choice >= 1 && choice <= 3) {
        const trait = specialization.majorTraits[tier]?.[choice - 1];
        if (trait) active.push(trait);
      }
    }
  }
  return active;
}
