/** Declares Troubadour packet annotations. Types are program-wide; only the mesmer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const TROUBADOUR_METADATA_FIELDS = Object.freeze({
  /** Crescendo samples instrument count and effectiveness together at its scheduled strike. */
  crescendoInstrumentCount: 'number',
  crescendoEffectiveness: 'number'
} as const satisfies MetadataFields);

type TroubadourEffectMetadata = MetadataFromFields<typeof TROUBADOUR_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends TroubadourEffectMetadata {}
}
