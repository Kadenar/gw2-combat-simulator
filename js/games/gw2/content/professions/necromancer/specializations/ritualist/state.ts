import type { RitualistState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../../platform/engine/profession/state.js';
import { registerNecromancerStatePreserver } from '../../core/state-reconciliation.js';

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
  registerNecromancerStatePreserver(state, () => {
    // Resolver-owned effect windows must survive scheduler snapshots that carry the same specialization state keys.
    const painfulBondUntil = state.painfulBondUntil;
    const painfulBondPulseAnchorAt = state.painfulBondPulseAnchorAt;
    const weaponSpells = state.weaponSpells;
    return () => {
      state.painfulBondUntil = painfulBondUntil;
      state.painfulBondPulseAnchorAt = painfulBondPulseAnchorAt;
      state.weaponSpells = weaponSpells;
    };
  });
  return state;
}

export const ritualistState = defineProfessionSpecializationState('Ritualist', createRitualistState);
