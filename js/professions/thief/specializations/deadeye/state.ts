import { THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession.js';
import { hasThiefTrait, selectedThiefTraits } from '../../core/state.js';
import type { DeadeyeState, ThiefConfig } from '../../types.js';

export function createDeadeyeState(config: ThiefConfig = {}): DeadeyeState {
  const traits = selectedThiefTraits(config);
  return {
    usesMaliciousStealthAttacks: true,
    markedTargetId: null,
    markExpiresAt: 0,
    // Bumped each time Deadeye's Mark is applied; the expiry task checks this to ignore stale scheduled expirations
    markGeneration: 0,
    malice: 0,
    // Maleficent Seven raises the cap from 5 to 7 and must be known at construction time
    maximumMalice: hasThiefTrait(traits, TRAIT.MALEFICENT_SEVEN) ? 7 : 5,
    // Fractional crit-chance accumulator; whole stacks are drained into malice when they cross 1
    maliceCriticalProgress: 0,
    // Tracks which activationIds have already had their malice effect applied to prevent multi-hit double-counting
    maliceResolvedActivations: {},
    // Prevents Maleficent Seven from firing more than once per mark application at full malice
    maleficentSevenTriggered: false,
    deadeyeRelicUntil: 0,
    // Silent Scope charge path: these mirror AntiquaryState fields so beginStealthAttack can consume them generically
    stealthAttackCharges: 0,
    stealthAttackExpiresAt: 0
  };
}

export const deadeyeState = defineProfessionSpecializationState('Deadeye', createDeadeyeState);
