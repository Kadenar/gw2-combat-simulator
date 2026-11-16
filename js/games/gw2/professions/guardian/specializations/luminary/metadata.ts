/** Declares Luminary packet annotations. Types are program-wide; only the guardian catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const LUMINARY_METADATA_FIELDS = Object.freeze({
  /** Only the Gleaming Blade cast that consumed Radiant Courage receives its damage multiplier. */
  guardianRadiantCourage: 'boolean',
  /** Armament identity gates Radiant Armaments and labels its effects. */
  radiantWeapon: 'string',
  /** Automatic exits carry their presentation label without inferring it from the skill. */
  guardianAutomaticForgeExit: 'boolean'
} as const satisfies MetadataFields);

type LuminaryEffectMetadata = MetadataFromFields<typeof LUMINARY_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends LuminaryEffectMetadata {}
}
