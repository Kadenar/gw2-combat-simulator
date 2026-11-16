/** Declares Deadeye packet annotations. Types are program-wide; only the thief catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const DEADEYE_METADATA_FIELDS = Object.freeze({
  /** Malicious Ashen Assault's final strike retains its accepted marked-malice factor. */
  thiefMaliciousAshenDamageFactor: 'number',
  thiefMaliciousPoisonDurationFactor: 'number',
  thiefMaliciousSneakDurationFactor: 'number'
} as const satisfies MetadataFields);

type DeadeyeEffectMetadata = MetadataFromFields<typeof DEADEYE_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends DeadeyeEffectMetadata {}
}
