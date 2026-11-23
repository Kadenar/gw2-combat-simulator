import type {
  AttributePreviewValues,
  ProfessionAttributePreviewContext
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { DamageInputs, SkillDamageCastOptions } from '#gw2/platform/skill-damage/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

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

/** Each bar measures one variant with its own damage inputs and cast options. */
export interface SkillDamageVariant {
  readonly id: string;
  readonly label: string;
  readonly inputs?: DamageInputs;
  readonly cast?: Partial<SkillDamageCastOptions>;
}

/** Damage-relevant state and variants for one assumed activation, independent of prerequisite history. */
export interface SkillDamageState {
  /** Selector inputs resolve to one concrete payload in the detached preview context. */
  readonly resolvedSkillId?: SkillId;
  readonly initialResource?: number;
  readonly config?: SkillDamageConfigPatch;
  readonly inputs?: DamageInputs;
  readonly assumptions?: readonly string[];
  readonly cast?: Partial<SkillDamageCastOptions>;
  readonly variants?: readonly SkillDamageVariant[];
  /** Named alternatives, such as weapons, opt into a titled list. Without it, variants are scaling levels in a bar chart. */
  readonly variantComparison?: { readonly title: string };
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
