import type { MesmerConfig } from '#gw2/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export interface MesmerContinuumAmmo {
  charges: number;
  maximum: number;
  rechargeDuration: number;
  nextRechargeRemaining: number | null;
  lockoutRemaining: number;
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

export function createChronomancerState(_config: Partial<MesmerConfig> = {}): MesmerChronomancerState {
  return {
    continuum: null,
    timeBombUntil: 0
  };
}

export const chronomancerState = defineProfessionSpecializationState('Chronomancer', createChronomancerState);
