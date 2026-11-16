/** Declares Ritualist packet annotations. Types are program-wide; only the necromancer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const RITUALIST_METADATA_FIELDS = Object.freeze({
  /** Essence Blast keeps the spirit count accepted before later spirit lifetime changes. */
  activeSpirits: 'number'
} as const satisfies MetadataFields);

type RitualistEffectMetadata = MetadataFromFields<typeof RITUALIST_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends RitualistEffectMetadata {}
}
