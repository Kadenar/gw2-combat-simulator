export interface ProfessionTraitSelection {
  readonly name?: string;
  readonly traits?: string;
  readonly disabledMinorTraits?: readonly number[];
}

interface ProfessionTraitSpecialization<TTrait> {
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
      const specialization = catalogSpecializations.find((candidate) => candidate.name === selection.name);

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
