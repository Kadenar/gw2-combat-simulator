import { MESMER_SKILL_IDS as ID } from "./ids.js";

interface DuplicateFamily {
  readonly defaultId: number;
  readonly bySpecialization: Readonly<Record<string, number>>;
  readonly requiresSpecialization?: boolean;
}

const DUPLICATE_FAMILIES: Readonly<Record<string, DuplicateFamily>> =
  Object.freeze({
    "Axes of Symmetry": Object.freeze({
      defaultId: ID.TROUBADOUR_AXES_OF_SYMMETRY,
      bySpecialization: Object.freeze({
        Mirage: ID.AXES_OF_SYMMETRY,
        Troubadour: ID.TROUBADOUR_AXES_OF_SYMMETRY,
      }),
      requiresSpecialization: true,
    }),
    "Lingering Thoughts": Object.freeze({
      defaultId: ID.TROUBADOUR_LINGERING_THOUGHTS,
      bySpecialization: Object.freeze({
        Mirage: ID.LINGERING_THOUGHTS,
        Troubadour: ID.TROUBADOUR_LINGERING_THOUGHTS,
      }),
      requiresSpecialization: true,
    }),
    Bladecall: Object.freeze({
      defaultId: ID.BLADECALL,
      bySpecialization: Object.freeze({
        Troubadour: ID.TROUBADOUR_BLADECALL,
        Virtuoso: ID.BLADECALL,
      }),
    }),
    "Lively Lute": Object.freeze({
      defaultId: ID.LIVELY_LUTE_ALTERNATE,
      bySpecialization: Object.freeze({
        Troubadour: ID.LIVELY_LUTE_ALTERNATE,
      }),
      requiresSpecialization: true,
    }),
    "Harmonious Harp": Object.freeze({
      defaultId: ID.HARMONIOUS_HARP_ALTERNATE,
      bySpecialization: Object.freeze({
        Troubadour: ID.HARMONIOUS_HARP_ALTERNATE,
      }),
      requiresSpecialization: true,
    }),
  });

/**
 * Resolves only Mesmer's duplicate legacy display-name families.
 *
 * `undefined` means the name is not duplicated. `null` means it is duplicated
 * but the supplied build context cannot select a safe variant.
 */
export function resolveMesmerLegacySkillId(
  name: string,
  { specialization = "" }: { specialization?: string } = {},
): number | null | undefined {
  const family = DUPLICATE_FAMILIES[String(name || "")];
  if (!family) return undefined;
  const specialized = family.bySpecialization[specialization];
  if (specialized != null) return specialized;
  return family.requiresSpecialization ? null : family.defaultId;
}

export function defaultMesmerLegacySkillId(name: string): number | undefined {
  return DUPLICATE_FAMILIES[String(name || "")]?.defaultId;
}

export const MESMER_DUPLICATE_SKILL_NAMES: readonly string[] = Object.freeze(
  Object.keys(DUPLICATE_FAMILIES),
);
