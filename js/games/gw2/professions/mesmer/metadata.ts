/** Declares mesmer packet annotations. Types are program-wide; only the mesmer catalog admits them. */
import type { MetadataFields, MetadataFromFields } from '#gw2/platform/events/metadata.js';

export const MESMER_METADATA_FIELDS = Object.freeze({
  /** Repeat damage retains the Chronophantasma factor accepted with this phantasm batch. */
  chronophantasmaDamageFactor: 'number',
  /** Repeat strikes carry their accepted duration factor into player-owned Sharper Images procs. */
  chronophantasmaConditionDurationFactor: 'number',
  /** Initial and repeated phantasm attacks retain Bountiful Blades' accepted spawn factor. */
  bountifulBladesDamageFactor: 'number',
  cloneId: 'number',
  /** Includes procedural blades whose attribution has no canonical blade skill. */
  blade: 'boolean',
  /** Excludes repeated shatter strikes and unrelated triggered damage from shatter traits. */
  shatterTraitEligible: 'boolean'
} as const satisfies MetadataFields);

type MesmerEffectMetadata = MetadataFromFields<typeof MESMER_METADATA_FIELDS>;

declare module '#gw2/platform/events/events.js' {
  interface EffectMetadata extends MesmerEffectMetadata {}
}
