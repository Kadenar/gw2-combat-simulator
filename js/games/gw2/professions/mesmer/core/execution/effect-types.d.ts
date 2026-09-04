/**
 * Owns cast-local interfaces shared by the Core Mesmer effect pipeline.
 * Catalog skill shapes live under `data/`; profession runtime interfaces live in the profession `types.d.ts`.
 */
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export interface MesmerActiveEmission {
  readonly skill: MesmerSkill;
  readonly effectiveEnd: number;
  readonly activationId: string;
}

export interface MesmerCastDetails {
  clarityConsumed?: boolean;
  earlyResourceAt?: number | null;
  earlyResourceOwnerId?: string;
  resourceScheduledDuringCast?: boolean;
  reservedShatterResources?: boolean;
  shatterSpendCommitted?: boolean;
  shatterSpent?: number | null;
}

export interface MesmerExceptionalProfileOptions {
  readonly clarityConsumed?: boolean;
  readonly phantasmSummonAt?: number;
  readonly playerEffectEnd?: number;
  readonly skipDirectResource?: boolean;
}

export interface MesmerSkillEffectController {
  consumeClarity(skill: MesmerSkill, castStart: number): boolean;
  complete(skill: MesmerSkill, at: number, castStart?: number): void;
  schedule(skill: MesmerSkill, at: number, castStart?: number, options?: MesmerExceptionalProfileOptions): void;
  scheduleSpecial(skill: MesmerSkill, at: number, castStart?: number): void;
  scheduleResources(skill: MesmerSkill, at: number, castStart?: number): void;
}
