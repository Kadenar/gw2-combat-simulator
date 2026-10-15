import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import type { RangerConfig, RangerPetDefinition } from '#gw2/professions/ranger/types.js';

/** Build defaults and stale-selection fallbacks share one starting pet per slot. */
export const RANGER_DEFAULT_PET_NAMES = Object.freeze(['Pig', 'Lynx'] as const);

const RANGER_PETS_BY_NAME: ReadonlyMap<string, RangerPetDefinition> = new Map(
  RANGER_PETS.map((pet) => [pet.name, pet])
);

/** Resolve a pet identity; unknown names fall back to the first catalog pet so stale state still has a companion. */
export function rangerPetByName(name: string | undefined): RangerPetDefinition {
  return (name ? RANGER_PETS_BY_NAME.get(name) : undefined) ?? RANGER_PETS[0]!;
}

/** Saved builds and UI selections accept only names present in the generated pet catalog. */
export function isRangerPetName(name: unknown): name is string {
  return typeof name === 'string' && RANGER_PETS_BY_NAME.has(name);
}

/** The configured pet for one slot, using that slot's default when the build has no choice. */
export function selectedRangerPet(
  config: Pick<RangerConfig, 'selectedPet' | 'selectedPet2'> = {},
  slot: 1 | 2 = 1
): RangerPetDefinition {
  return rangerPetByName((slot === 2 ? config.selectedPet2 : config.selectedPet) || RANGER_DEFAULT_PET_NAMES[slot - 1]);
}
