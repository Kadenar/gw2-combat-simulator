/** Declares thief packet annotations. Types are program-wide; only the thief catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const THIEF_METADATA_FIELDS = Object.freeze({
  venomProcEffectIndex: 'number',
  /** Recall owns malice and dual-wield procs while each axe keeps its projectile attribution. */
  recallSkillId: 'skillId',
  /** Falling Spider retains the factor earned by its predecessor at cast acceptance. */
  thiefFallingSpiderDamageFactor: 'number'
} as const satisfies MetadataFields);

type ThiefEffectMetadata = MetadataFromFields<typeof THIEF_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends ThiefEffectMetadata {}
}
