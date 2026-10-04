import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { CastCommand } from '#gw2/platform/execution/types.js';
import type {
  AttributePreviewValues,
  ProfessionAttributePreviewContext
} from '#gw2/platform/profession-presentation/attribute-preview.js';

/** Profession hooks read the same detached build view as the Attribute Preview; no app state is exposed. */
export type SkillDamagePreviewContext = ProfessionAttributePreviewContext;

/** A profession-owned table group, such as Gunsaber, Dragon Trigger, or Harbinger Shroud. */
export interface SkillDamageGroup {
  readonly id: string;
  readonly title: string;
  readonly skillIds: readonly SkillId[];
  /** Mechanic groups sort by order, then ownership; weapon groups come first and slot skills follow mechanics. */
  readonly order?: number;
}

/** Cast-command fields an occurrence may set on its measured cast, such as a Dragon Charge release threshold. */
export type SkillDamageCastOptions = Pick<CastCommand, 'releaseAtCharges' | 'releaseDelayMs' | 'doubleEdgeOutcome'>;

/** One scaling level of an occurrence, shown as a bar in the row's variant ladder. */
export interface SkillDamageVariant {
  readonly id: string;
  readonly label: string;
  readonly cast?: Partial<SkillDamageCastOptions>;
}

/** Damage-relevant state and variants for one assumed activation, independent of prerequisite history. */
export interface SkillDamageState {
  readonly initialResource?: number;
  readonly config?: SkillDamageConfigPatch;
  readonly inputs?: import('#gw2/platform/skill-damage/types.js').DamageInputs;
  readonly assumptions?: readonly string[];
  readonly cast?: Partial<SkillDamageCastOptions>;
  readonly variants?: readonly SkillDamageVariant[];
  readonly primaryVariantId?: string;
  readonly context?: string;
}

/** Preview values for the skill damage panel, with the same detached build view as the hooks above. */
export interface SkillDamagePreviewPreparation extends SkillDamagePreviewContext {
  readonly values: Readonly<AttributePreviewValues>;
}

/**
 * Profession configuration fields merged onto every occurrence, such as initial Blight. Only fields the profession's own
 * runtime reads belong here; shared boons, buffs, and target conditions come from generic control kinds.
 */
export type SkillDamageConfigPatch = Readonly<Record<string, unknown>>;
