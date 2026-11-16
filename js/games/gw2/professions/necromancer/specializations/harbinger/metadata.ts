/** Declares Harbinger packet annotations. Types are program-wide; only the necromancer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const HARBINGER_METADATA_FIELDS = Object.freeze({
  necromancerBlight: 'number'
} as const satisfies MetadataFields);

type HarbingerEffectMetadata = MetadataFromFields<typeof HARBINGER_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends HarbingerEffectMetadata {}
}
