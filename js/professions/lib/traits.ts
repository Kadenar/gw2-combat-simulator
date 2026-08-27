export const DEFAULT_TRAITS = '1-1-1';

export interface ProfessionTraitSelection {
  readonly name?: string;
  readonly traits?: string;
}

export interface ProfessionSpecialization<TTrait> {
  readonly name: string;
  readonly elite?: boolean;
  readonly minorTraits: readonly TTrait[];
  readonly majorTraits: readonly (readonly TTrait[])[];
}

export interface TraitMapContext {
  readonly specialization: string;
  readonly kind: 'minor' | 'major';
  readonly tier: number;
  readonly position: number;
}

export interface ProfessionTraitData<TTrait> {
  readonly specializations: readonly string[];
  readonly eliteSpecs: ReadonlySet<string>;
  readonly coreSpecs: readonly string[];
  readonly traits: readonly TTrait[];

  getActiveTraits(selections?: readonly ProfessionTraitSelection[] | null): TTrait[];
}

export interface ProfessionTraitDataOptions<TSourceTrait, TTrait> {
  readonly mapTrait: (trait: TSourceTrait, context: TraitMapContext) => TTrait;
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
export function parseTraitChoices(value?: string | null): readonly number[] {
  return String(value || '')
    .split('-')
    .map(Number);
}

/**
 * Creates the common profession trait-data contract directly from generated
 * specialization metadata.
 */
export function createProfessionTraitData<TTrait>(
  catalogSpecializations: readonly ProfessionSpecialization<TTrait>[]
): ProfessionTraitData<TTrait>;

/**
 * Creates the common profession trait-data contract while projecting generated
 * API traits into a profession-specific representation.
 *
 * This is primarily useful when a profession adds local metadata to traits,
 * such as tier, position, specialization, or stat annotations.
 */
export function createProfessionTraitData<TSourceTrait, TTrait>(
  catalogSpecializations: readonly ProfessionSpecialization<TSourceTrait>[],
  options: ProfessionTraitDataOptions<TSourceTrait, TTrait>
): ProfessionTraitData<TTrait>;

/**
 * Creates the common profession trait-data contract while projecting generated
 * API traits into a profession-specific representation.
 */
export function createProfessionTraitData<TSourceTrait, TTrait = TSourceTrait>(
  catalogSpecializations: readonly ProfessionSpecialization<TSourceTrait>[],
  options?: ProfessionTraitDataOptions<TSourceTrait, TTrait>
): ProfessionTraitData<TTrait> {
  const mapTrait = options?.mapTrait ? options.mapTrait : (trait: TSourceTrait) => trait as unknown as TTrait;

  const mappedSpecializations = catalogSpecializations.map((specialization) => ({
    name: specialization.name,
    elite: specialization.elite === true,

    minorTraits: specialization.minorTraits.map((trait, tier) =>
      mapTrait(trait, {
        specialization: specialization.name,
        kind: 'minor',
        tier,
        position: 0
      })
    ),

    majorTraits: specialization.majorTraits.map((traits, tier) =>
      traits.map((trait, position) =>
        mapTrait(trait, {
          specialization: specialization.name,
          kind: 'major',
          tier,
          position: position + 1
        })
      )
    )
  }));

  const specializations = Object.freeze(mappedSpecializations.map((specialization) => specialization.name));

  const eliteSpecs = new Set(
    mappedSpecializations.filter((specialization) => specialization.elite).map((specialization) => specialization.name)
  );

  const coreSpecs = Object.freeze(
    mappedSpecializations.filter((specialization) => !specialization.elite).map((specialization) => specialization.name)
  );

  const traits = Object.freeze(
    mappedSpecializations.flatMap((specialization) => [
      ...specialization.minorTraits,
      ...specialization.majorTraits.flat()
    ])
  );

  /**
   * Retrieves the active traits based on the selected specializations.
   * @param selections
   * @returns
   */
  function getActiveTraits(selections: readonly ProfessionTraitSelection[] | null = []): TTrait[] {
    const active: TTrait[] = [];

    for (const selection of selections || []) {
      const specialization = mappedSpecializations.find((candidate) => candidate.name === selection?.name);

      if (!specialization) continue;

      active.push(...specialization.minorTraits);
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
    specializations,
    eliteSpecs,
    coreSpecs,
    traits,
    getActiveTraits
  });
}
