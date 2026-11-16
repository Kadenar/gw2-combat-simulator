/** Catalogs validate packet annotations with the declaring profession family's field kinds. */
import type { EffectMetadata } from '#gw2/platform/events/events.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

type MetadataKind = 'boolean' | 'number' | 'skillId' | 'string';

export type MetadataFields = Readonly<Record<string, MetadataKind>>;

type MetadataValue<T extends MetadataKind> = T extends 'boolean'
  ? boolean
  : T extends 'number'
    ? number
    : T extends 'skillId'
      ? SkillId
      : string;

export type MetadataFromFields<T extends MetadataFields> = {
  readonly [K in keyof T]?: MetadataValue<T[K]>;
};

/** Shared fields are interpreted by platform code or written by more than one profession family. */
export const SHARED_METADATA_FIELDS = Object.freeze({
  triggeredByAlly: 'number',
  spiritAttackType: 'string',
  /** Generic effect-selection tags; their values belong to the author. */
  trigger: 'string',
  packetKind: 'string'
} as const satisfies MetadataFields);

const KINDS: ReadonlySet<unknown> = new Set<MetadataKind>(['boolean', 'number', 'skillId', 'string']);

/** One declaring module owns each key, even when two declarations use the same value kind. */
export function combineMetadataFields(
  contributions: readonly { readonly owner: string; readonly fields?: MetadataFields }[]
): MetadataFields {
  const fields: Record<string, MetadataKind> = {};
  const owners = new Map<string, string>();
  for (const { owner, fields: contribution } of contributions) {
    for (const [field, kind] of Object.entries(contribution ?? {})) {
      const prior = owners.get(field);

      if (prior) throw new TypeError(`Duplicate effect metadata field ${field} in ${prior} and ${owner}.`);

      if (!field || field === '__proto__' || !KINDS.has(kind)) {
        throw new TypeError(`Invalid effect metadata declaration ${field} in ${owner}.`);
      }

      fields[field] = kind;
      owners.set(field, owner);
    }
  }

  return Object.freeze(fields);
}

/** Checks every supplied value and detaches annotations before catalog or runtime ownership begins. */
export function normalizeEffectMetadata(value: unknown, fields: MetadataFields): EffectMetadata | undefined {
  if (value == null) return undefined;

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Effect metadata must be an object.');
  }

  // One detached copy also captures accessor values once before their kinds are checked.
  const metadata = { ...value } as Record<string, unknown>;
  for (const field in metadata) {
    const fieldValue = metadata[field];
    switch (fields[field]) {
      case 'string':
        if (typeof fieldValue !== 'string' || !fieldValue)
          throw new TypeError(`Effect metadata ${field} must be a non-empty string.`);

        break;
      case 'number':
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue))
          throw new TypeError(`Effect metadata ${field} must be a finite number.`);

        break;
      case 'boolean':
        if (typeof fieldValue !== 'boolean') throw new TypeError(`Effect metadata ${field} must be a boolean.`);

        break;
      case 'skillId':
        if (
          !(typeof fieldValue === 'string' && fieldValue) &&
          !(typeof fieldValue === 'number' && Number.isFinite(fieldValue))
        )
          throw new TypeError(`Effect metadata ${field} must be a non-empty string or finite number skill ID.`);

        break;
      default: {
        // Report every key this switch would reject; the current field always matches.
        const unknownFields = Object.keys(metadata).filter((key) => !KINDS.has(fields[key]));
        throw new TypeError(
          `Effect metadata has unsupported field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}`
        );
      }
    }
  }

  return Object.freeze(metadata);
}
