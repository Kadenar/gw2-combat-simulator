import { MESMER_SKILL_IDS as ID } from './ids.js';

interface DuplicateSkillNameFamily {
  readonly defaultId: number;
  readonly bySpecialization: Readonly<Record<string, number>>;
  readonly requiresSpecialization?: boolean;
}

/**
 * Current Mesmer skills that share a display name but have distinct stable IDs.
 * Name-based rotations need the active specialization to select the same skill
 * that an ID-based rotation identifies directly.
 */
const DUPLICATE_SKILL_NAME_FAMILIES: Readonly<Record<string, DuplicateSkillNameFamily>> = Object.freeze({
  'Axes of Symmetry': Object.freeze({
    defaultId: ID.TROUBADOUR_AXES_OF_SYMMETRY,
    bySpecialization: Object.freeze({
      Mirage: ID.AXES_OF_SYMMETRY,
      Troubadour: ID.TROUBADOUR_AXES_OF_SYMMETRY
    }),
    requiresSpecialization: true
  }),
  'Lingering Thoughts': Object.freeze({
    defaultId: ID.TROUBADOUR_LINGERING_THOUGHTS,
    bySpecialization: Object.freeze({
      Mirage: ID.LINGERING_THOUGHTS,
      Troubadour: ID.TROUBADOUR_LINGERING_THOUGHTS
    }),
    requiresSpecialization: true
  }),
  Bladecall: Object.freeze({
    defaultId: ID.BLADECALL,
    bySpecialization: Object.freeze({
      Troubadour: ID.TROUBADOUR_BLADECALL,
      Virtuoso: ID.BLADECALL
    })
  }),
  'Lively Lute': Object.freeze({
    defaultId: ID.LIVELY_LUTE,
    bySpecialization: Object.freeze({
      Troubadour: ID.LIVELY_LUTE
    }),
    requiresSpecialization: true
  }),
  'Harmonious Harp': Object.freeze({
    defaultId: ID.HARMONIOUS_HARP_ALTERNATE,
    bySpecialization: Object.freeze({
      Troubadour: ID.HARMONIOUS_HARP_ALTERNATE
    }),
    requiresSpecialization: true
  })
});

/**
 * Resolves a duplicated Mesmer display name with specialization context.
 * `undefined` means the name is unique; `null` means it is duplicated but the
 * supplied specialization cannot safely select a variant.
 */
export function resolveMesmerSkillIdFromDuplicateName(
  name: string,
  { specialization = '' }: { specialization?: string } = {}
): number | null | undefined {
  const family = DUPLICATE_SKILL_NAME_FAMILIES[String(name || '')];

  if (!family) return undefined;
  const specialized = family.bySpecialization[specialization];

  if (specialized != null) return specialized;
  return family.requiresSpecialization ? null : family.defaultId;
}

/** Supplies the deterministic catalog fallback for a duplicated display name. */
export function defaultMesmerSkillIdForDuplicateName(name: string): number | undefined {
  return DUPLICATE_SKILL_NAME_FAMILIES[String(name || '')]?.defaultId;
}

export const MESMER_DUPLICATE_SKILL_NAMES: readonly string[] = Object.freeze(
  Object.keys(DUPLICATE_SKILL_NAME_FAMILIES)
);
