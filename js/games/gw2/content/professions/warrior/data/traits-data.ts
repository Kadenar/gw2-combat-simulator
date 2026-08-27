import { SPECIALIZATIONS as CATALOG_SPECIALIZATIONS } from './warrior-api-metadata.js';
import type { WarriorApiTrait } from './warrior-api-metadata.js';
import { createProfessionTraitData } from '../../lib/traits.js';

export interface WarriorSpecializationSelection {
  readonly name?: string;
  readonly traits?: string;
}

const traitData = createProfessionTraitData<WarriorApiTrait>(CATALOG_SPECIALIZATIONS);

export const TRAITS: readonly WarriorApiTrait[] = Object.freeze([...traitData.traits]);

export function getActiveTraits(specializations: readonly WarriorSpecializationSelection[] = []): WarriorApiTrait[] {
  return traitData.getActiveTraits(specializations);
}
