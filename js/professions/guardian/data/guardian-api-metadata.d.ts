import type { CatalogEntity } from '../../../platform/engine/types.js';
import type { GuardianSkill } from '../types.js';

export interface GuardianApiTrait extends CatalogEntity {
  readonly description: string;
  readonly icon: string;
  readonly specialization: string;
  readonly tier: number;
  readonly position: number;
}

export interface GuardianApiSpecialization extends CatalogEntity {
  readonly elite: boolean;
  readonly icon: string;
  readonly background: string;
  readonly minorTraits: readonly GuardianApiTrait[];
  readonly majorTraits: readonly (readonly GuardianApiTrait[])[];
}

export const DATA_SNAPSHOT: string;
export const SPECIALIZATIONS: readonly GuardianApiSpecialization[];
export const SKILLS: readonly GuardianSkill[];
