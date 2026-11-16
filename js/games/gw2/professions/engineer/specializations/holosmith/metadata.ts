/** Declares Holosmith packet annotations. Types are program-wide; only the engineer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const HOLOSMITH_METADATA_FIELDS = Object.freeze({
  /** Delayed packets retain the heat-tier factors captured at emission. */
  holosmithStrikeFactor: 'number',
  holosmithConditionBaseDurationFactor: 'number',
  /** Direct strikes sample this skill's tuning at impact. */
  holosmithStrikeSkillId: 'skillId'
} as const satisfies MetadataFields);

type HolosmithEffectMetadata = MetadataFromFields<typeof HOLOSMITH_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends HolosmithEffectMetadata {}
}
