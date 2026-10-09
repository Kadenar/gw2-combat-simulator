/** Defines build presets and selection contracts shared by the build editor and professions. */
import type { Gw2FinalizedAttributeResult, Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { CatalogEntity, Skill } from '#gw2/platform/skills/types.js';
import type { TargetHealthBandDps } from '#gw2/app/results/summary-metrics.js';

export interface ProfessionAttributeData extends Gw2FinalizedAttributeResult {
  activeTraits: CatalogEntity[];
}

export interface BuildTemplatePreset {
  readonly label: string;
  readonly build: string;
  readonly rotation?: string;
  readonly snowCrowsUrl?: string;
  readonly benchmarkDps?: number;
  /** Simulated non-autoattack actions per minute over the rotation execution window. */
  readonly benchmarkApm?: number;
  /** Cumulative and phase player DPS at each health band; non-killing runs use final overall DPS for 20-0%. */
  readonly benchmarkDpsByHealth?: TargetHealthBandDps;
  /** Paired preview damage measurements; APM remains shared with the live benchmark. */
  readonly patchPreview?: {
    readonly patchId: string;
    readonly benchmarkDps: number;
    readonly benchmarkDpsByHealth: TargetHealthBandDps;
  };
  readonly upToDate?: boolean;
  readonly section?: string;
}

export interface BuildTemplateSection {
  readonly section: string;
  readonly presets: readonly BuildTemplatePreset[];
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
