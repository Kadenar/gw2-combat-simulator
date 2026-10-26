import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Leaf shatter contracts let Core and specialization mechanics share results without importing the family type root. */
export interface MesmerShatterDefinition {
  readonly slot: number;
  readonly kind: string;
  readonly resolver: string;
  readonly tierCount: number;
  readonly conditionAtMs?: readonly (readonly number[])[];
  readonly minimumResource?: number;
  readonly consumesResources?: boolean;
  readonly resetBySignetOfIllusions?: boolean;
  readonly resourceSpendProgress?: number;
  readonly damageAtMs?: number;
}

export interface MesmerShatterTraitHit {
  readonly at: number;
  readonly count: number;
}

export interface MesmerShatterResolverRequest {
  readonly delivery: EffectDelivery;
  readonly skill: MesmerSkill;
  readonly shatter: MesmerShatter;
  readonly at: number;
  readonly castStart: number;
  readonly spent: number;
}

export interface MesmerShatterResolution {
  readonly delivery: EffectDelivery;
  readonly skill: MesmerSkill;
  readonly at: number;
  readonly spent: number;
  readonly traitHits: readonly MesmerShatterTraitHit[];
}

/** Compiled tiers retain their resource index even when a patch removes an attack. */
export interface MesmerShatter extends MesmerShatterDefinition {
  readonly strikes: readonly (StrikeEffect | undefined)[];
}
