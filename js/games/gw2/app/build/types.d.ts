/** Defines build presets, loadout views, and selection contracts shared by the build editor and professions. */
import type { Gw2FinalizedAttributeResult, Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';
import type { CatalogEntity, CanonicalCatalog, SkillId, Skill } from '#gw2/platform/engine/skills/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { ProfessionPaletteGroup } from '#gw2/platform/engine/profession/types.js';

export interface ProfessionAttributeData extends Gw2FinalizedAttributeResult {
  activeTraits: CatalogEntity[];
}

export interface BuildTemplatePreset extends SchedulerRecord {
  readonly label: string;
  readonly build: string;
  readonly rotation?: string;
  readonly snowCrowsUrl?: string;
  readonly benchmarkDps?: number;
  readonly section?: string | null;
}

export interface BuildTemplateSection {
  readonly section?: string | null;
  readonly presets?: readonly BuildTemplatePreset[];
}

export interface BuildTemplateSelection {
  readonly build: string;
  readonly signature: string;
}

export interface ProfessionSpecializationTrait extends CatalogEntity {
  readonly icon: string;
  readonly description: string;
}

export interface ProfessionSpecialization extends CatalogEntity {
  readonly icon: string;
  readonly elite: boolean;
  readonly minorTraits: readonly ProfessionSpecializationTrait[];
  readonly majorTraits: readonly (readonly ProfessionSpecializationTrait[])[];
}

export interface ProfessionSlotLoadout extends SchedulerRecord {
  readonly startingKey: string;
  readonly palettePlacement?: string;
  normalizeBuild(
    build: Gw2ApplicationBuild,
    context: {
      readonly build: Gw2ApplicationBuild;
      readonly specialization: string;
      readonly professionState?: unknown;
      readonly catalog: CanonicalCatalog;
    }
  ): Partial<Gw2ApplicationBuild> & SchedulerRecord;
  selectedSkillIds(context: {
    readonly build: Gw2ApplicationBuild;
    readonly specialization: string;
    readonly professionState?: unknown;
    readonly catalog: CanonicalCatalog;
  }): readonly SkillId[];
  skillChildren?(context: ProfessionSlotLoadoutContext, skillId: SkillId): readonly SkillId[];
  paletteGroups(context: ProfessionSlotLoadoutContext): ProfessionPaletteGroup[];
  unavailableReason(skill: Skill, context: ProfessionSlotLoadoutContext): string;
  view(context: ProfessionSlotLoadoutContext): ProfessionSlotLoadoutView;
  updateBuild(
    build: Gw2ApplicationBuild,
    selectorKey: string,
    value: string,
    context: ProfessionSlotLoadoutContext
  ): Gw2ApplicationBuild;
}

export interface ProfessionSlotLoadoutContext {
  readonly build: Gw2ApplicationBuild;
  readonly specialization: string;
  readonly professionState?: unknown;
  readonly catalog: CanonicalCatalog;
}

export interface ProfessionSlotLoadoutOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: string;
  readonly disabled?: boolean;
}

export interface ProfessionSlotLoadoutSelector {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly ProfessionSlotLoadoutOption[];
}

export interface ProfessionSlotLoadoutBar {
  readonly id: string;
  readonly label: string;
  readonly compactLabel?: string;
  readonly icon?: string;
  readonly active: boolean;
  readonly skillIds: readonly SkillId[];
}

export interface ProfessionSlotLoadoutView {
  readonly label: string;
  readonly selectionControl: string;
  readonly formatActiveBar: boolean;
  readonly selectors: readonly ProfessionSlotLoadoutSelector[];
  readonly bars: readonly ProfessionSlotLoadoutBar[];
}

export interface ProfessionSkillAvailabilityContext {
  readonly build?: Gw2ApplicationBuild;
  readonly specialization?: string;
  readonly professionState?: unknown;
}

export interface ProfessionOffhandContext {
  readonly mainHand?: string;
  readonly offHands?: readonly string[];
}

export type ProfessionIsSkillAvailable = (skill: Skill, context?: ProfessionSkillAvailabilityContext) => boolean;

export type ProfessionDefaultOffhand = (context?: ProfessionOffhandContext) => string;
