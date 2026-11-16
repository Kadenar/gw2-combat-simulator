/** Declares Conduit packet annotations. Types are program-wide; only the revenant catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const CONDUIT_METADATA_FIELDS = Object.freeze({
  /** Release packets retain the affinity multiplier sampled when they were emitted. */
  revenantReleaseConditionDurationFactor: 'number'
} as const satisfies MetadataFields);

type ConduitEffectMetadata = MetadataFromFields<typeof CONDUIT_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends ConduitEffectMetadata {}
}
