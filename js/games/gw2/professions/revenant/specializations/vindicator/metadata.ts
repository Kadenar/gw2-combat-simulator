/** Declares Vindicator packet annotations. Types are program-wide; only the revenant catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const VINDICATOR_METADATA_FIELDS = Object.freeze({
  /** Landing packets retain the consumed Reaver's Curse factor and the pre-landing Forerunner state. */
  reaversCurseDamageFactor: 'number',
  forerunnerOfDeathActive: 'boolean'
} as const satisfies MetadataFields);

type VindicatorEffectMetadata = MetadataFromFields<typeof VINDICATOR_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends VindicatorEffectMetadata {}
}
