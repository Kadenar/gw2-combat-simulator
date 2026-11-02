/** Retired stance variants are rewritten only when loading saved builds or standalone rotations. */
import type { UnvalidatedBuildRecord } from '#gw2/platform/builds/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

const RETIRED_STANCE_IDS = new Set([-1167, -1168, -1169]);
const RETIRED_STANCE_NAME = /^Primordial Stance \((Fire|Water|Air|Earth)\)$/;

function isRetiredStance(value: unknown): boolean {
  return (
    (typeof value === 'number' && RETIRED_STANCE_IDS.has(value)) ||
    (typeof value === 'string' && (RETIRED_STANCE_IDS.has(Number(value)) || RETIRED_STANCE_NAME.test(value)))
  );
}

/** Preserve command options and control entries while collapsing old cast identities before decoding. */
export function migrateElementalistStanceRotation(rotation: readonly unknown[]): readonly unknown[] {
  return rotation.map((entry) => {
    if (typeof entry === 'number') return isRetiredStance(entry) ? ID.PRIMORDIAL_STANCE : entry;

    if (typeof entry === 'string') return RETIRED_STANCE_NAME.test(entry) ? 'Primordial Stance' : entry;

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;

    const command = entry as Record<string, unknown>;

    if (command.type != null && command.type !== 'cast') return entry;

    const identity = command.skillId ?? command.id ?? command.name;

    if (!isRetiredStance(identity)) return entry;

    // Canonical commands keep only skillId as identity; the decoder still owns all other validation.
    const { id: _id, name: _name, ...fields } = command;
    return { ...fields, skillId: ID.PRIMORDIAL_STANCE };
  });
}

/** Schema six equips and casts one stance; explicit elemental glyph casts retain their identities. */
export function migrateElementalistStance(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;

  const saved = candidate as UnvalidatedBuildRecord;
  const migrated = structuredClone(saved);
  for (const field of ['selectedSkillIds', 'selectedSkills'] as const) {
    const selected = migrated[field];

    if (!selected || typeof selected !== 'object' || Array.isArray(selected)) continue;

    const slots = selected as Record<string, unknown>;
    for (const [slot, value] of Object.entries(slots)) {
      if (isRetiredStance(value)) slots[slot] = field === 'selectedSkills' ? 'Primordial Stance' : ID.PRIMORDIAL_STANCE;
    }
  }

  if (Array.isArray(migrated.rotation)) migrated.rotation = migrateElementalistStanceRotation(migrated.rotation);

  return migrated;
}
