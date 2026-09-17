import type { SkillId } from '#gw2/platform/engine/skills/types.js';

/** Leaf resource contracts keep state and mechanic consumers independent of the Mesmer family type root. */
export interface MesmerResourceCause {
  readonly kind?: string;
  readonly sourceSkillId?: SkillId;
  readonly traitId?: number;
  readonly traitName?: string;
}

export interface MesmerPendingResource {
  at: number;
  count: number;
  weapon?: string | null;
  reason?: string;
  cause?: MesmerResourceCause;
}

export interface MesmerResourceDefinition {
  singular: string;
  plural: string;
  maximum: number;
}

export interface MesmerResourceSpendDetails {
  readonly sourceSkill?: string;
  readonly rotationIndex?: number | null;
}
