import type { SkillId } from '#gw2/platform/engine/types.js';

import type { MesmerResourceSpendDetails, MesmerShatterResolution } from '#gw2/content/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

export interface MesmerContinuumAmmo {
  charges: number;
  maximum: number;
  rechargeDuration: number;
  nextRechargeRemaining: number | null;
}

export interface MesmerContinuumSnapshot {
  splitId: SkillId;
  splitReady: number | undefined;
  openAt: number;
  remainingCooldowns: Map<SkillId, number>;
  ammo: Map<SkillId, MesmerContinuumAmmo>;
  autoattackChains: Record<string, SkillId>;
  expiresAt: number;
}

export interface MesmerChronomancerState {
  continuum: MesmerContinuumSnapshot | null;
  timeBombUntil: number;
}

export interface MesmerContinuumController {
  beginContinuumSplit(
    skill: MesmerSkill,
    at: number,
    spendDetails?: MesmerResourceSpendDetails
  ): MesmerShatterResolution;
  restoreContinuum(at: number, reason: string): void;
}
