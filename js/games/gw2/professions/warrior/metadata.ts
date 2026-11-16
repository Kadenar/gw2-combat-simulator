/** Declares warrior packet annotations. Types are program-wide; only the warrior catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const WARRIOR_METADATA_FIELDS = Object.freeze({
  /** Immutable burst inputs captured before resource spending; later hits cannot change the selected tier. */
  warriorAdrenalineSpent: 'number',
  warriorBurstTier: 'number'
} as const satisfies MetadataFields);

type WarriorEffectMetadata = MetadataFromFields<typeof WARRIOR_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends WarriorEffectMetadata {}
}
