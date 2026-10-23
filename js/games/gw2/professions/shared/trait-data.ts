import type { CanonicalCatalog, CatalogEntity } from '#gw2/platform/skills/types.js';

export interface ProfessionTraitSelection {
  readonly name?: string;
  readonly traits?: string;
  readonly disabledMinorTraits?: readonly number[];
}

export interface ProfessionTraitSpecialization<TTrait> {
  readonly name: string;
  readonly minorTraits: readonly TTrait[];
  readonly majorTraits: readonly (readonly TTrait[])[];
}

interface ProfessionTraitData<TTrait> {
  readonly traits: readonly TTrait[];

  getActiveTraits(selections?: readonly ProfessionTraitSelection[] | null): TTrait[];
}

/**
 * Parses the canonical GW2 trait selection format.
 *
 * Example:
 *   "1-2-3" -> [1, 2, 3]
 *
 * Invalid or missing selections produce NaN entries, which are ignored by
 * active-trait resolution.
 */
function parseTraitChoices(value?: string | null): readonly number[] {
  return (value || '').split('-').map(Number);
}

/**
 * Creates the common profession trait-data contract directly from generated
 * specialization metadata.
 */
export function createProfessionTraitData<TTrait>(
  catalogSpecializations: readonly ProfessionTraitSpecialization<TTrait>[]
): ProfessionTraitData<TTrait> {
  // Index the immutable layout once; catalog overlays reuse the same specialization array.
  const byName = new Map(catalogSpecializations.map((specialization) => [specialization.name, specialization]));
  const traits = Object.freeze(
    catalogSpecializations.flatMap((specialization) => [
      ...specialization.minorTraits,
      ...specialization.majorTraits.flat()
    ])
  );

  /**
   * Retrieves the active traits based on the selected specializations.
   */
  function getActiveTraits(selections: readonly ProfessionTraitSelection[] | null = []): TTrait[] {
    const active: TTrait[] = [];

    for (const selection of selections || []) {
      const specialization = selection.name ? byName.get(selection.name) : undefined;

      if (!specialization) continue;

      // Minor traits default to active, but explicit opt-outs must also remove their simulation effects.
      active.push(...specialization.minorTraits.filter((_, tier) => !selection.disabledMinorTraits?.includes(tier)));
      const picks = parseTraitChoices(selection.traits);

      for (let tier = 0; tier < specialization.majorTraits.length; tier += 1) {
        const choice = picks[tier];

        if (!(choice >= 1 && choice <= 3)) continue;

        const trait = specialization.majorTraits[tier]?.[choice - 1];

        if (trait) {
          active.push(trait);
        }
      }
    }

    return active;
  }

  return Object.freeze({
    traits,
    getActiveTraits
  });
}

const selectedTraitIndexes = new WeakMap<object, ProfessionTraitData<CatalogEntity>>();

/** Resolve saved positions against the selected patch, sharing an index across catalogs with the same layout. */
export function selectedTraits(
  catalog: Pick<CanonicalCatalog, 'specializations'>,
  selections?: readonly ProfessionTraitSelection[] | null
): CatalogEntity[] {
  let index = selectedTraitIndexes.get(catalog.specializations);

  if (!index) {
    index = createProfessionTraitData(
      catalog.specializations as unknown as readonly ProfessionTraitSpecialization<CatalogEntity>[]
    );
    selectedTraitIndexes.set(catalog.specializations, index);
  }

  return index.getActiveTraits(selections);
}
