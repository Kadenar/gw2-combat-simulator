/** Declares revenant packet annotations. Types are program-wide; only the revenant catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const REVENANT_METADATA_FIELDS = Object.freeze({
  /** Skill-owned bonuses retain their impact, detonation, or acceptance sample through damage resolution. */
  revenantAbyssalRazeDamageFactor: 'number',
  revenantBlossomingAuraDamageFactor: 'number',
  legendId: 'string'
} as const satisfies MetadataFields);

type RevenantEffectMetadata = MetadataFromFields<typeof REVENANT_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends RevenantEffectMetadata {}
}
