/** Defines build presets and selection contracts shared by the build editor and professions. */
import type { Gw2FinalizedAttributeResult, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { CatalogEntity, Skill } from '#gw2/platform/engine/skills/types.js';

export interface ProfessionAttributeData extends Gw2FinalizedAttributeResult {
  activeTraits: CatalogEntity[];
}

export interface BuildTemplatePreset {
  readonly label: string;
  readonly build: string;
  readonly rotation?: string;
  readonly snowCrowsUrl?: string;
  readonly benchmarkDps?: number;
  readonly upToDate?: boolean;
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

export interface ProfessionSkillAvailabilityContext {
  readonly build?: Gw2CanonicalBuild;
  readonly specialization?: string;
  readonly professionState?: unknown;
}

export interface ProfessionOffhandContext {
  readonly mainHand?: string;
  readonly offHands?: readonly string[];
}

export type ProfessionIsSkillAvailable = (skill: Skill, context?: ProfessionSkillAvailabilityContext) => boolean;

export type ProfessionDefaultOffhand = (context?: ProfessionOffhandContext) => string;
