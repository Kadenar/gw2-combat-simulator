/** Declares Willbender packet annotations. Types are program-wide; only the guardian catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const WILLBENDER_METADATA_FIELDS = Object.freeze({
  /** Only virtue flame strikes qualify for flame-specific damage and Burning reactions. */
  willbenderFlames: 'boolean'
} as const satisfies MetadataFields);

type WillbenderEffectMetadata = MetadataFromFields<typeof WILLBENDER_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends WillbenderEffectMetadata {}
}
