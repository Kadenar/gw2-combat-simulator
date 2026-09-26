import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export interface NecromancerWeaponSpellState {
  readonly generation: number;
  readonly skillId?: SkillId;
  readonly skillName?: string;
  readonly appliedAt?: number;
  readonly recipients?: Record<string, ChargeGrant>;
  /** Weapon spells that reach allies at full strength rather than the reduced allied share. */
  readonly alliesReceiveFullBenefit?: boolean;
}

export interface RitualistState {
  weaponSpellGeneration: number;
  painfulBondGeneration: number;
  activeSpirits: Record<string, boolean>;
  spiritGenerations: Record<string, number>;
  spiritInitialUntil: Record<string, number>;
  spiritBusyUntil: Record<string, number>;
  spiritAutoAnchorAt: number;
  resummonedSpiritAutoCycle: boolean;
  weaponSpells: Record<string, NecromancerWeaponSpellState>;
  soulTwistingAvailable: boolean;
  painfulBondUntil: number;
  painfulBondPulseAnchorAt: number;
}

/** Declares Ritualist's public compatibility fields and inactive values. */
export const RITUALIST_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  activeSpirits: {},
  soulTwistingAvailable: false
} satisfies Partial<RitualistState>);

/** Creates Ritualist's spirit cadence, weapon-spell, and Painful Bond runtime state. */
export function createRitualistState(): RitualistState {
  const state: RitualistState = {
    weaponSpellGeneration: 0,
    painfulBondGeneration: 0,
    activeSpirits: {},
    spiritGenerations: {},
    spiritInitialUntil: {},
    spiritBusyUntil: {},
    // NaN signals "no anchor established yet"; first summon computes it from firstSpiritAttackDelay
    spiritAutoAnchorAt: Number.NaN,
    // true only between a re-summon and the next anchor computation (uses shorter resummonedSpiritAttackDelay)
    resummonedSpiritAutoCycle: false,
    weaponSpells: {},
    soulTwistingAvailable: false,
    painfulBondUntil: 0,
    // NaN signals "no pulse scheduled yet"; first apply event sets the anchor
    painfulBondPulseAnchorAt: Number.NaN
  };
  return state;
}

export const ritualistState = defineProfessionSpecializationState('Ritualist', createRitualistState);
