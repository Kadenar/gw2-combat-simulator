import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
/**
 * Owns cast-local interfaces shared by the Core Mesmer effect pipeline.
 * Catalog skill shapes live under `data/`; profession runtime interfaces live in the profession `types.ts`.
 */
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerCastDetails {
  clarityConsumed?: boolean;
  taleEligible?: boolean;
  earlyResourceAt?: number | null;
  earlyResourceOwnerId?: string;
  resourceScheduledDuringCast?: boolean;
  reservedShatterResources?: boolean;
  shatterSpendCommitted?: boolean;
  shatterSpent?: number | null;
}

export interface MesmerExceptionalProfileOptions {
  readonly delivery?: EffectDelivery;
  readonly clarityConsumed?: boolean;
  readonly phantasmSummonAt?: number;
  readonly playerEffectEnd?: number;
}

export interface MesmerSkillEffectController {
  schedule(skill: MesmerSkill, at: number, castStart?: number, options?: MesmerExceptionalProfileOptions): void;
  scheduleResources(skill: MesmerSkill, at: number, castStart?: number, delivery?: EffectDelivery): void;
}
