/** Declares engineer packet annotations. Types are program-wide; only the engineer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const ENGINEER_METADATA_FIELDS = Object.freeze({
  engineerMech: 'boolean'
} as const satisfies MetadataFields);

type EngineerEffectMetadata = MetadataFromFields<typeof ENGINEER_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends EngineerEffectMetadata {}
}
