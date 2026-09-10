import type { RitualistState } from '#gw2/professions/necromancer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { registerNecromancerResolverFields } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';

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
