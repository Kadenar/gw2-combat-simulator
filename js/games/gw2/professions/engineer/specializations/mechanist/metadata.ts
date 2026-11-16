/** Declares Mechanist packet annotations. Types are program-wide; only the engineer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const MECHANIST_METADATA_FIELDS = Object.freeze({
  /** Basic mech strikes qualify for the Mechanist trait proc. */
  mechBasicAttack: 'boolean'
} as const satisfies MetadataFields);

type MechanistEffectMetadata = MetadataFromFields<typeof MECHANIST_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends MechanistEffectMetadata {}
}
