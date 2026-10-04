import type {
  AttributePreviewValues,
  ProfessionAttributePreviewContext
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { CastCommand, RotationCommand } from '#gw2/platform/execution/types.js';

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

/** Cast-command fields a probe may set on its measured cast, such as a Dragon Charge release threshold. */
export type SkillDamageCastOptions = Pick<CastCommand, 'releaseAtCharges' | 'releaseDelayMs' | 'doubleEdgeOutcome'>;

/** One scaling level of a probe, shown as a bar in the row's variant ladder. */
export interface SkillDamageVariantSetup {
  readonly id: string;
  readonly label: string;
  readonly cast?: Partial<SkillDamageCastOptions>;
}

/**
 * Profession-owned requirements for one measurable cast. The platform adds generic setup itself: chain and flip
 * predecessors, the weapon set, and the slot selection; a profession supplies only state the catalog cannot express.
 */
export interface SkillDamageProbeSetup {
  /** Commands before the measured cast. Off-target by default; on-target setup can build hit-dependent resources. */
  readonly setup?: readonly RotationCommand[];
  /** When present, discover armed procs by casting this skill, these transitions, then an equipped weapon strike. */
  readonly procFollowUpSetup?: readonly RotationCommand[];
  /** Commands after combat start in proc-only discovery, such as waiting for a periodic trait grant. */
  readonly procSetup?: readonly RotationCommand[];
  /** A state-selected variant may share flip metadata without needing its predecessor cast. */
  readonly skipPredecessors?: boolean;
  /** Starting primary resource, for example Flow before entering Dragon Trigger. */
  readonly initialResource?: number;
  /** Profession runtime fields for this probe only, for example the attunements a weapon skill requires. */
  readonly config?: SkillDamageConfigPatch;
  readonly cast?: Partial<SkillDamageCastOptions>;
  readonly variants?: readonly SkillDamageVariantSetup[];
  /** The variant shown in the row; defaults to the last variant. */
  readonly primaryVariantId?: string;
  /** Short context line under the skill name, for example "Dragon Trigger"; defaults to the slot description. */
  readonly context?: string;
}

/** Preview values for the skill damage panel, with the same detached build view as the hooks above. */
export interface SkillDamagePreviewPreparation extends SkillDamagePreviewContext {
  readonly values: Readonly<AttributePreviewValues>;
}

/**
 * Profession configuration fields merged onto every probe, such as initial Blight. Only fields the profession's own
 * runtime reads belong here; shared boons, buffs, and target conditions come from generic control kinds.
 */
export type SkillDamageConfigPatch = Readonly<Record<string, unknown>>;
