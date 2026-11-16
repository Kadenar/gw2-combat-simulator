/** Declares guardian packet annotations. Types are program-wide; only the guardian catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const GUARDIAN_METADATA_FIELDS = Object.freeze({
  /** Guardian symbol damage is authored independently of skill names and descriptive text. */
  guardianSymbol: 'boolean'
} as const satisfies MetadataFields);

type GuardianEffectMetadata = MetadataFromFields<typeof GUARDIAN_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends GuardianEffectMetadata {}
}
