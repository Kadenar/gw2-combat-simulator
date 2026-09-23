import type { SkillId, StrikeTick, StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Leaf shatter contracts let Core and specialization mechanics share results without importing the family type root. */
export interface MesmerShatterDefinition {
  readonly balanceProfileId?: SkillId;
  readonly slot: number;
  readonly kind: string;
  readonly resolver: string;
  readonly coefficients: readonly number[];
  readonly minimumResource?: number;
  readonly consumesResources?: boolean;
  readonly resetBySignetOfIllusions?: boolean;
  readonly ticks?: readonly (readonly StrikeTick[])[];
  readonly rechargeReductionPerSource?: number;
  readonly resourceSpendProgress?: number;
  readonly damageAtMs?: number;
}

export interface MesmerShatterTraitHit {
  readonly at: number;
  readonly count: number;
}

export interface MesmerShatterResolverRequest {
  readonly skill: MesmerSkill;
  readonly shatter: MesmerShatter;
  readonly at: number;
  readonly castStart: number;
  readonly spent: number;
}

export interface MesmerShatterResolution {
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly spent: number;
  readonly traitHits: readonly MesmerShatterTraitHit[];
}

/** Compiled tiers retain their resource index even when a patch removes an attack. */
export interface MesmerShatter extends Omit<MesmerShatterDefinition, 'coefficients' | 'ticks'> {
  readonly strikes: readonly (StrikeEffect | undefined)[];
  readonly conditionAtMs?: readonly (readonly number[])[];
}
