/** Declares elementalist packet annotations. Types are program-wide; only the elementalist catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const ELEMENTALIST_METADATA_FIELDS = Object.freeze({
  /** Captured Seethe bonuses survive cast cleanup and resource consumption until their packets resolve. */
  elementalistSeetheDamageFactor: 'number',
  hitboxIndex: 'number',
  smallHitboxCap: 'number',
  largeHitboxOnly: 'boolean'
} as const satisfies MetadataFields);

type ElementalistEffectMetadata = MetadataFromFields<typeof ELEMENTALIST_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends ElementalistEffectMetadata {}
}
