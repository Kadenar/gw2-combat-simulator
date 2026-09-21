import type { ChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { registerNecromancerResolverFields } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

export type NecromancerWeaponSpellRecipient = ChargeGrant;

export interface NecromancerWeaponSpellState {
  readonly skillId?: SkillId;
  readonly skillName?: string;
  readonly appliedAt?: number;
  readonly expiresAt?: number;
  readonly recipients?: Record<string, NecromancerWeaponSpellRecipient>;
  /** Weapon spells that reach allies at full strength rather than the reduced allied share. */
  readonly alliesReceiveFullBenefit?: boolean;
}

export interface RitualistState {
  activeSpirits: Record<string, boolean>;
  spiritGenerations: Record<string, number>;
  spiritInitialUntil: Record<string, number>;
  spiritBusyUntil: Record<string, number>;
  spiritAutoAnchorAt: number;
  resummonedSpiritAutoCycle: boolean;
  weaponSpells: Record<string, NecromancerWeaponSpellState>;
  soulTwistingAvailable: boolean;
  pendingSoulTwistSkill?: SkillId | null;
  painfulBondUntil: number;
  painfulBondPulseAnchorAt: number;
}

/** Declares Ritualist's public compatibility fields and inactive values. */
export const RITUALIST_PUBLIC_END_STATE_KEYS = Object.freeze([
  'activeSpirits',
  'soulTwistingAvailable'
] as const satisfies readonly (keyof RitualistState)[]);

export const RITUALIST_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<RitualistState>> = Object.freeze({
  activeSpirits: {},
  soulTwistingAvailable: false
});

/** Creates Ritualist's spirit cadence, weapon-spell, and Painful Bond runtime state. */
export function createRitualistState(): RitualistState {
  const state: RitualistState = {
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
    pendingSoulTwistSkill: null,
    painfulBondUntil: 0,
    // NaN signals "no pulse scheduled yet"; first apply event sets the anchor
    painfulBondPulseAnchorAt: Number.NaN
  };
  // Preserve resolved effect cadence and per-recipient spending across scheduler snapshots.
  registerNecromancerResolverFields(state, ['painfulBondUntil', 'painfulBondPulseAnchorAt', 'weaponSpells']);
  return state;
}

export const ritualistState = defineProfessionSpecializationState('Ritualist', createRitualistState);
