/** Declares necromancer packet annotations. Types are program-wide; only the necromancer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const NECROMANCER_METADATA_FIELDS = Object.freeze({
  dhuumfireDuration: 'number',
  dhuumfireInterval: 'number',
  /** Devouring Darkness shares its pre-application observation across independent impacts. */
  necromancerConditionCount: 'number',
  /** Addle retains its activation-time shard gate while impacts use live resource state. */
  necromancerAddleImmobilize: 'boolean',
  necromancerShroudSkillOne: 'boolean'
} as const satisfies MetadataFields);

type NecromancerEffectMetadata = MetadataFromFields<typeof NECROMANCER_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends NecromancerEffectMetadata {}
}
